from uuid import UUID
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from app.core.dependencies import DbSession, CurrentUser
from app.core.enums import SessionStatus, BookingStatus, UserRole
from app.models.booking import Session, Booking
from app.schemas.booking import SessionRead, LiveKitTokenResponse
from app.core.config import settings
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

    # Only the student or teacher of this booking can view it
    if current_user.id not in (booking.student_id, booking.teacher_id):
        raise HTTPException(status_code=403, detail="Not your session")
    return session


@router.post("/{session_id}/join", response_model=LiveKitTokenResponse)
async def join_session(session_id: UUID, current_user: CurrentUser, db: DbSession):
    """
    Generate a LiveKit JWT for the requesting user.

    - Creates the LiveKit room on first join if it doesn't exist yet.
    - Records teacher_joined_at / student_joined_at timestamps.
    - Transitions session to IN_PROGRESS when both parties have tokens issued.
    """
    session, booking = await _get_session_with_booking(db, session_id)

    # Access control — only participants of this booking
    if current_user.id not in (booking.student_id, booking.teacher_id):
        raise HTTPException(status_code=403, detail="Not your session")

    # Booking must be active
    if booking.status != BookingStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="Booking is not active")

    # Session must be scheduled or already in progress
    if session.status not in (SessionStatus.SCHEDULED, SessionStatus.IN_PROGRESS):
        raise HTTPException(
            status_code=400,
            detail=f"Session cannot be joined in status '{session.status.value}'",
        )

    # Create the LiveKit room if this is the first join
    if not session.livekit_room_name:
        room_name = await create_room(str(session_id))
        session.livekit_room_name = room_name
        await db.flush()
    else:
        room_name = session.livekit_room_name

    # Record join timestamp
    now = datetime.now(tz=timezone.utc)
    is_teacher = current_user.id == booking.teacher_id
    if is_teacher and not session.teacher_joined_at:
        session.teacher_joined_at = now
    elif not is_teacher and not session.student_joined_at:
        session.student_joined_at = now
    await db.flush()

    # Generate signed LiveKit token
    display_name = f"{current_user.first_name} {current_user.last_name}"
    token = generate_room_token(
        user_id=str(current_user.id),
        session_id=str(session_id),
        display_name=display_name,
        is_teacher=is_teacher,
    )

    return LiveKitTokenResponse(
        token=token,
        room_name=room_name,
        livekit_url=settings.LIVEKIT_URL,
    )


@router.post("/{session_id}/complete", response_model=SessionRead)
async def complete_session(session_id: UUID, current_user: CurrentUser, db: DbSession):
    """
    Teacher explicitly marks a session as completed.

    Triggers:
      - Session status → COMPLETED, actual_end_at recorded.
      - Booking.completed_sessions incremented.
      - If all sessions done → Booking status → COMPLETED.
      - TeacherSubject.total_sessions_completed incremented.
      - SESSION_RELEASE transaction created (escrow → platform ledger).
      - LiveKit room torn down.
    """
    session, booking = await _get_session_with_booking(db, session_id)

    # Only the teacher can mark a session complete
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
    await db.flush()

    # Update booking counters
    booking.completed_sessions += 1
    if booking.completed_sessions >= booking.total_sessions:
        booking.status = BookingStatus.COMPLETED
    await db.flush()

    # Increment TeacherSubject experience
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

    # Tear down LiveKit room
    if session.livekit_room_name:
        try:
            await end_room(session.livekit_room_name)
        except Exception:
            pass  # Room may already be closed — not fatal

    return session


@router.post("/{session_id}/reschedule", response_model=SessionRead)
async def reschedule_session(session_id: UUID, current_user: CurrentUser, db: DbSession):
    """Reschedule a SCHEDULED session to a new time (both parties must agree)."""
    ...