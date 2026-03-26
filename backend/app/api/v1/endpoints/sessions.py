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


@router.post("/{session_id}/join", response_model=LiveKitTokenResponse)
async def join_session(session_id: UUID, current_user: CurrentUser, db: DbSession):
    """
    Generate a LiveKit JWT for the requesting user.
    Creates the LiveKit room on first join.
    """
    session, booking = await _get_session_with_booking(db, session_id)

    if current_user.id not in (booking.student_id, booking.teacher_id):
        raise HTTPException(status_code=403, detail="Not your session")

    if booking.status != BookingStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="Booking is not active")

    if session.status not in (SessionStatus.SCHEDULED, SessionStatus.IN_PROGRESS):
        raise HTTPException(
            status_code=400,
            detail=f"Session cannot be joined in status '{session.status.value}'",
        )

    # Create the LiveKit room on first join
    if not session.livekit_room_name:
        room_name = await create_room(str(session_id))
        session.livekit_room_name = room_name
        await db.flush()
    else:
        room_name = session.livekit_room_name

    # Record join timestamps
    now = datetime.now(tz=timezone.utc)
    is_teacher = current_user.id == booking.teacher_id
    if is_teacher and not session.teacher_joined_at:
        session.teacher_joined_at = now
    elif not is_teacher and not session.student_joined_at:
        session.student_joined_at = now
    await db.flush()

    token = generate_room_token(
        user_id=str(current_user.id),
        session_id=str(session_id),
        display_name=f"{current_user.first_name} {current_user.last_name}",
        is_teacher=is_teacher,
    )

    return LiveKitTokenResponse(
        token=token,
        room_name=room_name,
        livekit_url=settings.LIVEKIT_URL,
    )


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


@router.post("/{session_id}/reschedule", response_model=SessionRead)
async def reschedule_session(session_id: UUID, current_user: CurrentUser, db: DbSession):
    """Reschedule a SCHEDULED session to a new time (both parties must agree)."""
    ...







