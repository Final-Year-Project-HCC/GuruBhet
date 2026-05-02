import logging
from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, HTTPException, Path, BackgroundTasks
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from app.core.dependencies import CurrentUser, DbSession, RequireProfessionalTeacher
from app.models.user import User
from app.core.enums import SessionStatus
from app.db.redis import cache_delete, cache_get, cache_set
from app.models.booking import Booking, Session
from app.schemas.booking import SessionRead
from app.services.session_service import handle_session_completion

router = APIRouter()
logger = logging.getLogger(__name__)


def _compute_elapsed_seconds(session, now=None) -> float:
    """Return elapsed seconds since session start.

    Uses `actual_start_at` if present, otherwise falls back to `created_at`.
    `now` can be provided for deterministic testing.
    """
    from datetime import datetime

    now = now or datetime.now(tz=UTC)
    start_time = session.actual_start_at or session.created_at
    return (now - start_time).total_seconds()


async def _get_session_with_booking(
    db: DbSession, session_id: Annotated[UUID, Path(..., alias="sessionId")]
) -> tuple[Session, Booking]:
    result = await db.execute(
        select(Session).options(joinedload(Session.booking)).where(Session.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session, session.booking


@router.get("/{session_id}", response_model=SessionRead)
async def get_session(
    session_id: Annotated[UUID, Path(..., alias="sessionId")],
    current_user: CurrentUser,
    db: DbSession,
):
    session, booking = await _get_session_with_booking(db, session_id)
    if current_user.id not in (booking.student_id, booking.teacher_id):
        raise HTTPException(status_code=403, detail="Not your session")
    return session


@router.post("/{session_id}/request-session-completion", response_model=SessionRead)
async def request_session_completion(
    session_id: UUID,
    current_user: Annotated[User, RequireProfessionalTeacher],
    db: DbSession,
    background_tasks: BackgroundTasks,
):
    """
    Teacher requests to complete a session prematurely or at the end of duration.

    Flow:
    1. If session duration has been reached: Session is completed immediately
    2. If session duration not reached: Redis key is set, socket event sent to student for approval
    3. If Redis key already exists: Request fails with 409
    """
    session, booking = await _get_session_with_booking(db, session_id)

    if current_user.id != booking.teacher_id:
        raise HTTPException(
            status_code=403, detail="Only the teacher can request session completion"
        )

    if session.status != SessionStatus.IN_PROGRESS:
        raise HTTPException(
            status_code=400,
            detail=f"Session is not in progress (current: {session.status.value})",
        )

    now = datetime.now(tz=UTC)
    elapsed_seconds = _compute_elapsed_seconds(session, now=now)
    required_duration_seconds = booking.session_duration_minutes * 60

    if elapsed_seconds >= required_duration_seconds:
        # Auto-complete: session duration has been reached
        await handle_session_completion(
            session=session,
            booking=booking,
            db=db,
            completion_status=SessionStatus.COMPLETED,
            background_tasks=background_tasks,  # ✅ was missing
        )
        await db.commit()
        return session

    # Premature completion: check if a request already exists
    redis_key = f"premature_session_completion:{session_id}"
    existing_request = await cache_get(redis_key)

    if existing_request:
        raise HTTPException(
            status_code=409,
            detail="A premature session completion request already exists for this session",
        )

    await cache_set(
        redis_key, {"session_id": str(session_id), "requested_at": now.isoformat()}, ttl=60
    )

    try:
        from app.core.socketio import get_socketio_manager

        sio_manager = get_socketio_manager()
        if sio_manager:
            remaining_seconds = int(required_duration_seconds - elapsed_seconds)
            background_tasks.add_task(
                sio_manager.emit_to_user,
                user_id=booking.student_id,
                event="premature_session_completion_requested",
                data={
                    "session_id": str(session_id),
                    "booking_id": str(booking.id),
                    "requested_at": now.isoformat(),
                    "remaining_duration_seconds": remaining_seconds,
                },
            )
    except Exception as exc:
        logger.warning(f"Failed to emit premature_session_completion_requested event: {exc}")

    await db.commit()
    return session


@router.post("/{session_id}/accept-premature-session-completion", response_model=SessionRead)
async def accept_premature_session_completion(
    db: DbSession,
    session_id: UUID,
    current_user: CurrentUser,
    background_tasks: BackgroundTasks,
):
    """
    Student accepts the teacher's request for premature session completion.

    Flow:
    1. Check Redis key exists (teacher actually requested premature completion)
    2. Mark session COMPLETED via common handler (queues session_finished side effects)
    3. Remove Redis key
    4. Emit premature_session_completion_accepted to teacher
    """
    session, booking = await _get_session_with_booking(db, session_id)

    if current_user.id != booking.student_id:
        raise HTTPException(
            status_code=403, detail="Only the student can accept session completion"
        )

    if session.status != SessionStatus.IN_PROGRESS:
        raise HTTPException(
            status_code=400,
            detail=f"Session is not in progress (current: {session.status.value})",
        )

    redis_key = f"premature_session_completion:{session_id}"
    existing_request = await cache_get(redis_key)

    if not existing_request:
        raise HTTPException(
            status_code=400,
            detail="No pending premature session completion request found",
        )

    now = datetime.now(tz=UTC)

    await cache_delete(redis_key)

    await handle_session_completion(
        session=session,
        booking=booking,
        db=db,
        completion_status=SessionStatus.COMPLETED,
        background_tasks=background_tasks,  # ✅ was missing
    )

    try:
        from app.core.socketio import get_socketio_manager

        sio_manager = get_socketio_manager()
        if sio_manager:
            background_tasks.add_task(
                sio_manager.emit_to_user,
                user_id=booking.teacher_id,
                event="premature_session_completion_accepted",
                data={
                    "session_id": str(session_id),
                    "booking_id": str(booking.id),
                    "accepted_at": now.isoformat(),
                },
            )
    except Exception as exc:
        logger.warning(f"Failed to emit completion notification to teacher: {exc}")

    await db.commit()
    return session


@router.post("/{session_id}/reject-premature-session-completion", response_model=SessionRead)
async def reject_premature_session_completion(
    session_id: UUID,
    current_user: CurrentUser,
    db: DbSession,
    background_tasks: BackgroundTasks,
):
    """
    Student rejects the teacher's request for premature session completion.

    Flow:
    1. Check Redis key exists
    2. Remove Redis key
    3. Emit premature_session_completion_rejected to teacher
    """
    session, booking = await _get_session_with_booking(db, session_id)

    if current_user.id != booking.student_id:
        raise HTTPException(
            status_code=403, detail="Only the student can reject session completion"
        )

    if session.status != SessionStatus.IN_PROGRESS:
        raise HTTPException(
            status_code=400,
            detail=f"Session is not in progress (current: {session.status.value})",
        )

    redis_key = f"premature_session_completion:{session_id}"
    existing_request = await cache_get(redis_key)

    if not existing_request:
        raise HTTPException(
            status_code=400,
            detail="No pending premature session completion request found",
        )

    now = datetime.now(tz=UTC)

    await cache_delete(redis_key)

    try:
        from app.core.socketio import get_socketio_manager

        sio_manager = get_socketio_manager()
        if sio_manager:
            background_tasks.add_task(
                sio_manager.emit_to_user,
                user_id=booking.teacher_id,
                event="premature_session_completion_rejected",
                data={
                    "session_id": str(session_id),
                    "booking_id": str(booking.id),
                    "rejected_at": now.isoformat(),
                    "message": f"{current_user.full_name} has rejected the completion request.",
                },
            )
    except Exception as exc:
        logger.warning(f"Failed to emit premature_session_completion_rejected event: {exc}")

    await db.commit()
    return session


@router.post("/{session_id}/cancel", response_model=SessionRead)
async def cancel_session(
    session_id: UUID,
    current_user: CurrentUser,
    db: DbSession,
    background_tasks: BackgroundTasks,  # ✅ was missing entirely
):
    """
    Cancel a session.
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

    is_teacher_cancelling = current_user.id == booking.teacher_id
    cancel_status = (
        SessionStatus.CANCELLED_BY_TEACHER
        if is_teacher_cancelling
        else SessionStatus.CANCELLED_BY_STUDENT
    )

    await handle_session_completion(
        session=session,
        booking=booking,
        db=db,
        completion_status=cancel_status,
        background_tasks=background_tasks,  # ✅ was missing
    )

    await db.commit()
    return session