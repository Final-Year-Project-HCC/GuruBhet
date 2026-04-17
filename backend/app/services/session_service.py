import logging
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import select
from sqlalchemy.orm import joinedload
from uuid import UUID
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import BackgroundTasks
from app.models.booking import Session, Booking
from app.models.payment import Transaction
from app.core.enums import (
    SessionStatus,
    TransactionType,
    TransactionReason,
    BookingStatus,
    UserRole,
)
from app.repositories.teacher_subject_repo import TeacherSubjectRepository
from app.models.booking import Session

logger = logging.getLogger(__name__)


# --- SIDE EFFECT LOGIC (POST-COMMIT) ---

async def _run_side_effects(session_id: str, student_id: str, teacher_id: str, status: SessionStatus):
    """
    Executed as a FastAPI BackgroundTask ONLY after DB commit success.
    This handles all external service integrations.
    """
    room_name = f"session-{session_id}"

    # 1. Socket.IO Notifications
    try:
        from app.core.socketio import get_socketio_manager
        sio = get_socketio_manager()
        if sio:
            # status may be an Enum with `.value` or a plain value (tests pass object())
            status_value = getattr(status, "value", status)
            payload = {"session_id": session_id, "status": status_value}
            await sio.emit_to_user(student_id, "session_finished", payload)
            await sio.emit_to_user(teacher_id, "session_finished", payload)
    except Exception as e:
        logger.warning(f"SocketIO background task failed: {e}")

    # 2. LiveKit Room Cleanup
    try:
        from app.utils.livekit import end_room
        await end_room(room_name)
    except Exception as e:
        logger.warning(f"LiveKit cleanup failed: {e}")

    # 3. Heavy Background Processing (Celery)
    if status == SessionStatus.COMPLETED:
        try:
            pass
            # We will later uncomment after properly figuring this out
            # from app.tasks.payment_tasks import process_session_billing
            # process_session_billing.delay(session_id, booking_id)
        except Exception as e:
            logger.warning(f"Celery task dispatch failed: {e}")


# --- THE SERVICE HANDLER ---

async def handle_session_completion(
    session: Session,
    booking: Booking,
    db: AsyncSession,
    completion_status: SessionStatus,
    background_tasks: Optional["BackgroundTasks"] = None,
) -> None:
    """
    Updates the session state and prepares the ledger entry.

    If 'background_tasks' is provided, the side effects are queued to run
    after the response is sent and the DB transaction is committed.
    """
    now = datetime.now(tz=timezone.utc)

    # 1. IDEMPOTENCY GUARD
    if session.status != SessionStatus.IN_PROGRESS:
        logger.info(f"Session {session.id} already {session.status}. Skipping.")
        return

    # 2. PREPARE STATE CHANGES
    session.status = completion_status
    session.actual_end_at = session.actual_end_at or now

    # Handle Teacher Credit (Enforces Step 1 UniqueConstraint)
    if completion_status in (SessionStatus.COMPLETED, SessionStatus.CANCELLED_BY_STUDENT):
        db.add(Transaction(
            user_id=booking.teacher_id,
            amount=booking.rate_per_session,
            type=TransactionType.CREDIT,
            reason=TransactionReason.SESSION_RELEASE,
            booking_id=booking.id,
            session_id=session.id,
        ))

    booking.completed_sessions += 1
    if booking.completed_sessions >= booking.total_sessions:
        booking.status = BookingStatus.COMPLETED

    # Update Teacher XP
    ts_repo = TeacherSubjectRepository(db)
    await ts_repo.increment_completed_sessions(
        teacher_id=booking.teacher_id,
        subject_id=booking.subject_id,
    )

    # 3. ENFORCE INTEGRITY (FLUSH)
    # This triggers the UniqueConstraint check immediately.
    # If this fails, the route's exception handler will catch the error and rollback.
    await db.flush()

    # 4. QUEUE SIDE EFFECTS
    # Since we've flushed successfully, we can safely queue the background tasks.
    if background_tasks:
        background_tasks.add_task(
            _run_side_effects,
            str(session.id),
            str(booking.student_id),  # ✅ was missing str()
            str(booking.teacher_id),  # ✅ was missing str()
            completion_status,
        )





async def get_session_for_completion(db: AsyncSession, session_id: UUID) -> Optional[Session]:
    """
    Fetches a session with its booking using a write lock (FOR UPDATE).
    If another worker has locked this row, this call will wait (block) 
    until the other worker commits or rolls back.
    """
    stmt = (
        select(Session)
        .options(
            joinedload(Session.booking) # Eager load for the service handler
        )
        .where(Session.id == session_id)
        .with_for_update() # <--- THE LOCK
    )
    result = await db.execute(stmt)
    
    # .unique() is necessary when using joinedload with scalars in async
    return result.unique().scalar_one_or_none()


async def fetch_sessions_for_user(
    db: AsyncSession,
    user_id: UUID,
    role: UserRole,
    in_progress: bool = True,
) -> list[Session]:
    """
    Fetch sessions for a given user (student or teacher).

    - `role` determines whether to filter by booking.student_id or booking.teacher_id
    - `in_progress=True` filters to sessions with status IN_PROGRESS
    Returns a list of `Session` ORM objects with the `booking` relationship loaded.
    """
    stmt = (
        select(Session)
        .join(Booking, Session.booking)
        .options(joinedload(Session.booking))
    )

    if role == UserRole.STUDENT:
        stmt = stmt.where(Booking.student_id == user_id)
    else:
        stmt = stmt.where(Booking.teacher_id == user_id)

    if in_progress:
        stmt = stmt.where(Session.status == SessionStatus.IN_PROGRESS)

    stmt = stmt.order_by(Session.created_at.desc())

    result = await db.execute(stmt)
    return result.scalars().all()