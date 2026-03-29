from uuid import UUID
from datetime import datetime, timezone
import logging

from fastapi import APIRouter, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from app.core.config import settings
from app.core.dependencies import DbSession, CurrentUser
from app.core.enums import SessionStatus, BookingStatus
from app.models.booking import Session, Booking
from app.schemas.booking import SessionRead, LiveKitTokenResponse
from app.utils.livekit import create_room, generate_room_token, end_room
from app.db.redis import cache_set, cache_get, cache_delete

router = APIRouter()
logger = logging.getLogger(__name__)


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


async def _complete_session(
    session: Session,
    booking: Booking,
    db: DbSession,
    session_id: UUID,
    now: datetime,
):
    """
    Complete a session and perform all associated actions.
    
    This helper is reused by both auto-completion and accept-session-completion flows.
    """
    # Complete the session
    session.status = SessionStatus.COMPLETED
    session.actual_end_at = now
    
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

    duration_seconds = int((now - session.actual_start_at).total_seconds())


    # Emit Socket.IO event to both teacher and student
    try:
        from app.core.socketio import sio
        event_data = {
            "session_id": str(session_id),
            "booking_id": str(booking.id),
            "duration_seconds": duration_seconds,
            "completed_at": now.isoformat(),
        }
        # Send to teacher
        await sio.emit(
            "session-ended",
            event_data,
            room=f"user:{booking.teacher_id}",
        )
        # Send to student
        await sio.emit(
            "session-ended",
            event_data,
            room=f"user:{booking.student_id}",
        )
    except Exception:
        pass  # Socket.IO may not be available in all contexts

    # TODO: Trigger Celery tasks for post-session actions
    # from app.tasks.payment_tasks import process_session_billing
    # from app.tasks.notification_tasks import send_session_complete_notification
    # process_session_billing.delay(str(session_id), str(booking.id))
    # send_session_complete_notification.delay(str(session_id), str(booking.id))

    await db.commit()


@router.get("/{session_id}", response_model=SessionRead)
async def get_session(session_id: UUID, current_user: CurrentUser, db: DbSession):
    session, booking = await _get_session_with_booking(db, session_id)
    if current_user.id not in (booking.student_id, booking.teacher_id):
        raise HTTPException(status_code=403, detail="Not your session")
    return session





@router.post("/{session_id}/request-session-completion", response_model=SessionRead)
async def request_session_completion(session_id: UUID, current_user: CurrentUser, db: DbSession):
    """
    Teacher requests to complete a session prematurely or at the end of duration.
    
    Flow:
    1. If session duration has been reached: Session is completed immediately
    2. If session duration not reached: Redis key is set, socket event sent to student for approval
    3. If Redis key already exists: Request fails with 409
    """
    session, booking = await _get_session_with_booking(db, session_id)

    if current_user.id != booking.teacher_id:
        raise HTTPException(status_code=403, detail="Only the teacher can request session completion")

    if session.status != SessionStatus.IN_PROGRESS:
        raise HTTPException(
            status_code=400,
            detail=f"Session is not in progress (current: {session.status.value})",
        )

    now = datetime.now(tz=timezone.utc)
    elapsed_seconds = (now - session.actual_start_at).total_seconds()
    
    # Required duration in seconds
    required_duration_seconds = booking.session_duration_minutes * 60
    
    # Check if session duration has been reached
    if elapsed_seconds >= required_duration_seconds:
        # Auto-complete: Session duration has been reached
        await _complete_session(session, booking, db, session_id, now)
        return session
    
    # Premature completion: Check if a request already exists
    redis_key = f"premature_session_completion:{session_id}"
    existing_request = await cache_get(redis_key)
    
    if existing_request:
        raise HTTPException(
            status_code=409,
            detail="A premature session completion request already exists for this session",
        )
    
    # Set Redis key with 60-second TTL to mark premature completion request
    await cache_set(redis_key, {"session_id": str(session_id), "requested_at": now.isoformat()}, ttl=60)
    
    # Emit Socket.IO event to student
    try:
        from app.core.socketio import get_socketio_manager
        sio_manager = get_socketio_manager()
        if sio_manager:
            remaining_seconds = int(required_duration_seconds - elapsed_seconds)
            await sio_manager.emit_to_user(
                user_id=booking.student_id,
                event="premature_session_completion_requested",
                data={
                    "session_id": str(session_id),
                    "booking_id": str(booking.id),
                    "requested_at": now.isoformat(),
                    "remaining_duration_seconds": remaining_seconds,
                }
            )
    except Exception as exc:
        logger.warning(f"Failed to emit premature_session_completion_requested event: {exc}")

    await db.commit()
    return session


@router.post("/{session_id}/accept-premature-session-completion", response_model=SessionRead)
async def accept_premature_session_completion(session_id: UUID, current_user: CurrentUser, db: DbSession):
    """
    Student accepts the teacher's request for premature session completion.
    
    Flow:
    1. Check Redis key exists (teacher actually requested premature completion)
    2. Mark session COMPLETED
    3. Delete the room (webhook will handle common completion logic)
    4. Remove Redis key
    
    Note: Status assignment happens here, webhook handles common tasks.
    """
    session, booking = await _get_session_with_booking(db, session_id)

    if current_user.id != booking.student_id:
        raise HTTPException(status_code=403, detail="Only the student can accept session completion")

    if session.status != SessionStatus.IN_PROGRESS:
        raise HTTPException(
            status_code=400,
            detail=f"Session is not in progress (current: {session.status.value})",
        )

    # Check if Redis key exists
    redis_key = f"premature_session_completion:{session_id}"
    existing_request = await cache_get(redis_key)
    
    if not existing_request:
        raise HTTPException(
            status_code=400,
            detail="No pending premature session completion request found",
        )

    now = datetime.now(tz=timezone.utc)
    
    # Clean up Redis keys
    await cache_delete(redis_key)  # Remove the premature completion request key
    
    # Complete the session using the helper function
    await _complete_session(session, booking, db, session_id, now)
    
    return session


@router.post("/{session_id}/reject-premature-session-completion", response_model=SessionRead)
async def reject_premature_session_completion(session_id: UUID, current_user: CurrentUser, db: DbSession):
    """
    Student rejects the teacher's request for premature session completion.
    
    Flow:
    1. Check Redis key exists
    2. Remove Redis key
    3. Emit premature-session-completion-rejected event to teacher
    """
    session, booking = await _get_session_with_booking(db, session_id)

    if current_user.id != booking.student_id:
        raise HTTPException(status_code=403, detail="Only the student can reject session completion")

    if session.status != SessionStatus.IN_PROGRESS:
        raise HTTPException(
            status_code=400,
            detail=f"Session is not in progress (current: {session.status.value})",
        )

    # Check if Redis key exists
    redis_key = f"premature_session_completion:{session_id}"
    existing_request = await cache_get(redis_key)
    
    if not existing_request:
        raise HTTPException(
            status_code=400,
            detail="No pending premature session completion request found",
        )

    now = datetime.now(tz=timezone.utc)
    
    # Remove the Redis key
    await cache_delete(redis_key)
    
    # Emit Socket.IO event to teacher
    try:
        from app.core.socketio import sio
        await sio.emit(
            "premature-session-completion-rejected",
            {
                "session_id": str(session_id),
                "booking_id": str(booking.id),
                "rejected_at": now.isoformat(),
            },
            room=f"user:{booking.teacher_id}",  # Send to teacher
        )
    except Exception:
        pass  # Socket.IO may not be available in all contexts

    await db.commit()
    return session


@router.post("/{session_id}/cancel", response_model=SessionRead)
async def cancel_session(session_id: UUID, current_user: CurrentUser, db: DbSession):
    """
    Cancel a session.
    We will implement Cancel with dispute and without dispute later
    Refund Logic:
    - If TEACHER cancels: TODO - Student gets refunded for this session
    - If STUDENT cancels: No refund, teacher keeps all fees
    """
    session, booking = await _get_session_with_booking(db, session_id)

    if current_user.id not in (booking.student_id, booking.teacher_id):
        raise HTTPException(status_code=403, detail="Not your session")

    if session.status != SessionStatus.IN_PROGRESS:
        raise HTTPException(
            status_code=400,
            detail=f"Session cannot be cancelled in status {session.status.value}",
        )

    # Determine who is cancelling and set status accordingly
    is_teacher_cancelling = current_user.id == booking.teacher_id
    now = datetime.now(tz=timezone.utc)
    
    session.status = SessionStatus.CANCELLED_BY_TEACHER if is_teacher_cancelling else SessionStatus.CANCELLED_BY_STUDENT
    session.actual_end_at = now
    await db.flush()

    # Handle refund logic based on who cancelled
    if is_teacher_cancelling:
        # TODO: Queue Celery task to refund student for this session
        pass
    else:
        # Student cancelled - no refund, teacher keeps fees
        pass

    # Delete the LiveKit room if it exists
    # Webhook will handle common logic (Socket.IO event, but NO transaction)
    if session.livekit_room_name:
        try:
            await end_room(session.livekit_room_name)
        except Exception:
            pass  # Room may already be closed — not fatal

    # Emit Socket.IO event to notify both participants
    try:
        from app.core.socketio import sio
        event_data = {
            "session_id": str(session_id),
            "booking_id": str(booking.id),
            "cancelled_by": "teacher" if is_teacher_cancelling else "student",
            "cancelled_at": now.isoformat(),
        }
        # Send to teacher
        await sio.emit(
            "session_cancelled",
            event_data,
            room=f"user:{booking.teacher_id}",
        )
        # Send to student
        await sio.emit(
            "session_cancelled",
            event_data,
            room=f"user:{booking.student_id}",
        )
    except Exception:
        pass  # Socket.IO may not be available in all contexts

    await db.commit()
    return session


