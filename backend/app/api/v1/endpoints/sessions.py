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
    1. If session duration has been reached + leniency time: Delete room
    2. If session duration not reached: Set Redis key and notify student
    3. Common completion logic handled by webhook when room_finished arrives
    
    Note: All session completion logic (marking COMPLETED, updating booking, etc.)
    is handled by the room_finished webhook handler.
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
    
    # Calculate leniency in seconds
    session_duration_minutes = booking.session_duration_minutes
    leniency_minutes_per_15min = settings.LIVEKIT_ROOM_LENIENCY_MINUTES_PER_15MIN
    total_leniency_minutes = (session_duration_minutes / 15) * leniency_minutes_per_15min
    total_leniency_seconds = total_leniency_minutes * 60
    
    # Required duration in seconds
    required_duration_seconds = session_duration_minutes * 60
    
    # Check if session duration + leniency has been reached
    if elapsed_seconds >= (required_duration_seconds + total_leniency_seconds):
        # Auto-complete: Mark session COMPLETED, then delete room
        # Webhook will handle common completion logic when room_finished arrives
        session.status = SessionStatus.COMPLETED
        session.actual_end_at = now
        await db.flush()
        
        if session.livekit_room_name:
            # end_room is idempotent - handles errors internally
            await end_room(session.livekit_room_name)
        
        await db.commit()
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
    
    # Mark session COMPLETED, then delete the room
    # Webhook will handle common completion logic when room_finished arrives
    session.status = SessionStatus.COMPLETED
    session.actual_end_at = now
    await db.flush()
    
    if session.livekit_room_name:
        # end_room is idempotent - handles errors internally
        await end_room(session.livekit_room_name)
    
    # Clean up Redis key
    await cache_delete(redis_key)
    
    await db.commit()
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
    
    Flow:
    1. Set session status (CANCELLED_BY_TEACHER or CANCELLED_BY_STUDENT)
    2. Delete the room if it exists
    3. Webhook will handle common logic (Socket.IO event, etc.)
    
    Refund Logic:
    - If TEACHER cancels: TODO - Student gets refunded for this session
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
        # end_room is idempotent - handles errors internally
        await end_room(session.livekit_room_name)

    await db.commit()
    return session


