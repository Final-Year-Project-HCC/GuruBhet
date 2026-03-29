from uuid import UUID
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from app.core.config import settings
from app.core.dependencies import DbSession, CurrentUser
from app.core.enums import SessionStatus, BookingStatus
from app.models.booking import Session, Booking
from app.schemas.booking import SessionRead, LiveKitTokenResponse
from app.utils.livekit import create_room, generate_room_token, end_room

router = APIRouter()


async def _get_session_with_booking(db: DbSession, session_id: UUID) -> tuple[Session, Booking]:
    result = await db.execute(
        select(Session)
        .options(joinedload(Session.booking))
        .where(Session.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session, session.booking


@router.get("/{session_id}", response_model=SessionRead)
async def get_session(session_id: UUID, current_user: CurrentUser, db: DbSession):
    session, booking = await _get_session_with_booking(db, session_id)
    if current_user.id not in (booking.student_id, booking.teacher_id):
        raise HTTPException(status_code=403, detail="Not your session")
    return session


@router.post("/{session_id}/complete", response_model=SessionRead)
async def complete_session(session_id: UUID, current_user: CurrentUser, db: DbSession):
    """Teacher marks a session as completed and tears down the LiveKit room."""
    session, booking = await _get_session_with_booking(db, session_id)

    if current_user.id != booking.teacher_id:
        raise HTTPException(status_code=403, detail="Only the teacher can complete a session")

    if session.status != SessionStatus.IN_PROGRESS:
        raise HTTPException(
            status_code=400,
            detail=f"Session is not in progress (current: {session.status.value})",
        )

    now = datetime.now(tz=timezone.utc)
    session.status = SessionStatus.COMPLETED
    session.actual_end_at = now
    
    # Calculate and store duration_seconds if both start and end times exist
    if session.actual_start_at:
        duration = (now - session.actual_start_at).total_seconds()
        session.duration_seconds = int(duration)
    
    await db.flush()

    # Update booking counters
    booking.completed_sessions += 1
    if booking.completed_sessions >= booking.total_sessions:
        booking.status = BookingStatus.COMPLETED
    await db.flush()

    # Increment teacher experience counter
    from app.repositories.teacher_subject_repo import TeacherSubjectRepository
    ts_repo = TeacherSubjectRepository(db)
    await ts_repo.increment_completed_sessions(
        teacher_id=booking.teacher_id,
        subject_id=booking.subject_id,
    )

    # Create SESSION_RELEASE ledger entry
    from app.models.payment import Transaction
    from app.core.enums import TransactionType, TransactionReason
    db.add(Transaction(
        user_id=booking.teacher_id,
        amount=booking.rate_per_session,
        type=TransactionType.CREDIT,
        reason=TransactionReason.SESSION_RELEASE,
        booking_id=booking.id,
    ))
    await db.flush()

    # Tear down the LiveKit room
    if session.livekit_room_name:
        try:
            await end_room(session.livekit_room_name)
        except Exception:
            pass  # Room may already be closed — not fatal

    # Clean up Redis keys (pending session, room state)
    from app.utils.livekit import clear_pending_session_key
    from app.db.redis import cache_delete
    await clear_pending_session_key(str(booking.id))
    await cache_delete(f"session_room_state:{session_id}")
    
    # Emit Socket.IO event to notify both participants
    try:
        from app.core.socketio import sio
        await sio.emit(
            "session_completed",
            {
                "session_id": str(session_id),
                "booking_id": str(booking.id),
                "duration_seconds": session.duration_seconds,
                "completed_at": now.isoformat(),
            },
            room=session.livekit_room_name,  # Broadcast to everyone in room
        )
    except Exception:
        pass  # Socket.IO may not be available in all contexts

    # Trigger Celery tasks for post-session actions
    from app.tasks.payment_tasks import process_session_billing
    from app.tasks.notification_tasks import send_session_complete_notification
    process_session_billing.delay(str(session_id), str(booking.id))
    send_session_complete_notification.delay(str(session_id), str(booking.id))

    return session


@router.post("/{session_id}/cancel", response_model=SessionRead)
async def cancel_session(session_id: UUID, current_user: CurrentUser, db: DbSession):
    """
    Cancel a session.
    
    Refund Logic:
    - If TEACHER cancels: Student gets refunded for this session
    - If STUDENT cancels: No refund, teacher keeps all fees
    """
    session, booking = await _get_session_with_booking(db, session_id)

    if current_user.id not in (booking.student_id, booking.teacher_id):
        raise HTTPException(status_code=403, detail="Not your session")

    if session.status not in (SessionStatus.READY, SessionStatus.IN_PROGRESS):
        raise HTTPException(
            status_code=400,
            detail=f"Session cannot be cancelled in status {session.status.value}",
        )

    # Determine who is cancelling
    is_teacher_cancelling = current_user.id == booking.teacher_id

    # Cancel the session
    now = datetime.now(tz=timezone.utc)
    session.status = SessionStatus.CANCELLED_BY_TEACHER if is_teacher_cancelling else SessionStatus.CANCELLED_BY_STUDENT
    session.actual_end_at = now

    await db.flush()

    # Handle refund logic based on who cancelled
    if is_teacher_cancelling:
        # TODO: Queue Celery task to refund student for this session
        # refund_amount = booking.rate_per_session
        pass
    else:
        # Student cancelled - no refund, teacher keeps fees
        # TODO: Could optionally log this for analytics
        pass

    # Tear down the LiveKit room if it exists
    if session.livekit_room_name:
        try:
            await end_room(session.livekit_room_name)
        except Exception:
            pass  # Room may already be closed — not fatal

    # Clean up Redis keys
    from app.utils.livekit import clear_pending_session_key
    from app.db.redis import cache_delete
    await clear_pending_session_key(str(booking.id))
    await cache_delete(f"session_room_state:{session_id}")

    # Emit Socket.IO event to notify both participants
    try:
        from app.core.socketio import sio
        await sio.emit(
            "session_cancelled",
            {
                "session_id": str(session_id),
                "booking_id": str(booking.id),
                "cancelled_by": "teacher" if is_teacher_cancelling else "student",
                "cancelled_at": now.isoformat(),
            },
            room=session.livekit_room_name or f"booking:{booking.id}",
        )
    except Exception:
        pass  # Socket.IO may not be available in all contexts

    await db.commit()
    return session







