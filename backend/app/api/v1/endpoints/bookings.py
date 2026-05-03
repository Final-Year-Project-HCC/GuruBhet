import logging
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Path, Request, BackgroundTasks, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.dependencies import CurrentUser, DbSession, RequireProfessionalTeacher
from app.models.user import User
from app.models.teacher import TeacherProfile
from app.core.enums import BookingStatus, SessionStatus, UserRole
from app.core.exceptions import (
    BookingConflictError,
    BookingNotFoundError,
    InvalidStatusTransitionError,
    PermissionDeniedError,
    SubjectNotFoundError,
    ValidationError,
    LiveKitError,
)
from app.core.config import settings
from app.core.socketio import get_socketio_manager
from app.models.booking import Booking, Session
from app.models.communication import Message, MessageStatus, MessageType, Notification, NotificationType
from app.models.subject import Subject
from app.schemas.booking import (
    BookingCancelRequest,
    BookingRead,
    BookingRequestCreate,
    LiveKitTokenResponse,
)
from app.tasks.livekit_tasks import cleanup_expired_livekit_room
from app.tasks.session_request_tasks import (
    create_offline_notification_message,
    create_session_request_message,
    handle_session_request_timeout_task,
)
from app.utils.livekit import (
    create_room,
    generate_room_token,
)
from app.utils.presence import (
    set_session_request_pending as set_pending_session_key,
    get_session_request_pending as get_pending_session_key,
    clear_session_request_pending as clear_pending_session_key,
)
from app.services.session_service import handle_session_completion, _schedule_rating_reminder
from app.utils.livekit_url import get_livekit_url_for_client
from app.utils.presence import is_user_online

router = APIRouter()
logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────────────────────────────────────
# Step 1: Student creates a booking request
# ──────────────────────────────────────────────────────────────────────────────

@router.post("/request", response_model=BookingRead, status_code=201)
async def create_booking_request(
    body: BookingRequestCreate, current_user: CurrentUser, db: DbSession,
    background_tasks: BackgroundTasks
):
    """Student creates a booking request. Starts in PENDING_APPROVAL."""
    if current_user.role != UserRole.STUDENT:
        raise PermissionDeniedError(detail="Only students can create booking requests")

    subject_result = await db.execute(select(Subject).where(Subject.id == body.subject_id))
    subject = subject_result.scalar_one_or_none()
    if not subject:
        raise SubjectNotFoundError(subject_id=str(body.subject_id))

    total_amount = body.rate_per_session * Decimal(body.total_sessions)

    booking = Booking(
        student_id=current_user.id,
        teacher_id=body.teacher_id,
        subject_id=body.subject_id,
        total_sessions=body.total_sessions,
        rate_per_session=body.rate_per_session,
        session_duration_minutes=body.session_duration_minutes,
        total_amount=total_amount,
        escrow_amount=Decimal("0"),
        status=BookingStatus.PENDING_APPROVAL,
    )
    db.add(booking)
    await db.flush()
    await db.refresh(booking)

    sio_manager = get_socketio_manager()
    if sio_manager:
        background_tasks.add_task(
            sio_manager.emit_to_user,
            user_id=booking.teacher_id,
            event="booking_requested",
            data={
                "studentName": current_user.full_name,
                "subjectName": subject.name,
            },
        )

    return booking


# ──────────────────────────────────────────────────────────────────────────────
# Step 2: Teacher approves the booking request
# ──────────────────────────────────────────────────────────────────────────────

@router.post("/{booking_id}/approve", response_model=BookingRead)
async def approve_booking_request(
    booking_id: UUID,
    current_user: Annotated[User, RequireProfessionalTeacher],
    db: DbSession,
    background_tasks: BackgroundTasks,
):
    """Teacher approves booking. Moves PENDING_APPROVAL → PENDING_PAYMENT."""
    if current_user.role != UserRole.TEACHER:
        raise PermissionDeniedError(detail="Only teachers can approve bookings")

    result = await db.execute(
        select(Booking)
        .options(selectinload(Booking.subject))
        .where(Booking.id == booking_id)
        .with_for_update()
    )
    booking = result.scalar_one_or_none()
    if not booking:
        raise BookingNotFoundError(booking_id=str(booking_id))

    if booking.teacher_id != current_user.id:
        raise PermissionDeniedError(detail="Cannot approve booking you don't own")

    if booking.status != BookingStatus.PENDING_APPROVAL:
        raise InvalidStatusTransitionError(
            detail=f"Booking cannot be approved in status {booking.status.value}",
            context={"current_status": booking.status.value, "required_status": "PENDING_APPROVAL"},
        )

    booking.status = BookingStatus.PENDING_PAYMENT
    booking.teacher_approved_at = datetime.now(tz=UTC)

    sio_manager = get_socketio_manager()
    if sio_manager:
        background_tasks.add_task(
            sio_manager.emit_to_user,
            user_id=booking.student_id,
            event="booking_accepted",
            data={
                "subjectName": booking.subject.name if booking.subject else "Unknown",
            },
        )

    return booking


# ──────────────────────────────────────────────────────────────────────────────
# Step 3: Student initiates payment
# ──────────────────────────────────────────────────────────────────────────────

@router.post("/{booking_id}/initiate-payment")
async def initiate_payment(
    booking_id: UUID,
    current_user: CurrentUser,
    db: DbSession,
    background_tasks: BackgroundTasks,
):
    """
    Student initiates payment. Moves PENDING_PAYMENT → ACTIVE.

    TODO: Replace bypass with real eSewa payment integration.
    """
    if current_user.role != UserRole.STUDENT:
        raise PermissionDeniedError(detail="Only students can pay for bookings")

    result = await db.execute(
        select(Booking)
        .where(Booking.id == booking_id)
        .with_for_update()
    )
    booking = result.scalar_one_or_none()
    if not booking:
        raise BookingNotFoundError(booking_id=str(booking_id))

    if booking.student_id != current_user.id:
        raise PermissionDeniedError(detail="Cannot pay for booking you didn't create")

    if booking.status != BookingStatus.PENDING_PAYMENT:
        raise InvalidStatusTransitionError(
            detail=f"Booking cannot be paid in status {booking.status.value}",
            context={"current_status": booking.status.value, "required_status": "PENDING_PAYMENT"},
        )

    # DEVELOPMENT BYPASS — remove once real payment webhook activates the booking
    booking.status = BookingStatus.ACTIVE

    sio_manager = get_socketio_manager()
    if sio_manager:
        background_tasks.add_task(
            sio_manager.emit_to_user,
            user_id=booking.teacher_id,
            event="booking_paid",
            data={
                "studentName": current_user.full_name,
            },
        )
        
    return {"message": "Payment successful"}


# ──────────────────────────────────────────────────────────────────────────────
# Step 4a: Teacher requests a session
# ──────────────────────────────────────────────────────────────────────────────

@router.post("/{booking_id}/request-session", response_model=dict)
async def request_session(
    db: DbSession,
    booking_id: UUID,
    current_user: Annotated[User, RequireProfessionalTeacher],
    background_tasks: BackgroundTasks,
    request: Request,
):
    """
    Teacher requests a new session.

    ✓ PRESENCE CHECK: Verifies student is online before proceeding
    ✓ MESSAGING: Creates notification messages for all outcomes
    ✓ EXPIRATION: Sets up unified 60-second expiration handling via Redis TTL
    ✓ IN_PROGRESS CHECK: Rejects if session already in progress (use /sync instead)
    ✓ LOCKING: Booking row locked to prevent duplicate session creation
    """
    if current_user.role != UserRole.TEACHER:
        raise PermissionDeniedError(detail="Only teachers can request sessions")

    # Lock booking row to prevent concurrent session requests
    result = await db.execute(
        select(Booking)
        .options(selectinload(Booking.subject))
        .where(Booking.id == booking_id)
        .with_for_update()
    )
    booking = result.scalar_one_or_none()
    if not booking:
        raise BookingNotFoundError(booking_id=str(booking_id))

    if booking.teacher_id != current_user.id:
        raise PermissionDeniedError(detail="Cannot request sessions for booking you don't own")

    if booking.status != BookingStatus.ACTIVE:
        raise InvalidStatusTransitionError(
            detail=f"Booking must be ACTIVE to request sessions (current: {booking.status.value})",
            context={"current_status": booking.status.value, "required_status": "ACTIVE"},
        )

    # ── Ghost Guard: redirect if session already in progress ──
    in_progress_result = await db.execute(
        select(Session)
        .where(
            (Session.booking_id == booking_id) &
            (Session.status == SessionStatus.IN_PROGRESS)
        )
        .with_for_update()
    )
    session = in_progress_result.scalar_one_or_none()

    if session:
        teacher_token = generate_room_token(
            user_id=str(current_user.id),
            session_id=str(session.id),
            display_name=f"{current_user.first_name} {current_user.last_name}",
            is_teacher=True,
        )
        return {
            "status": "already_in_progress",
            "already_exists": True,
            "token": teacher_token,
            "room_name": session.livekit_room_name,
            "livekit_url": get_livekit_url_for_client(request),
            "message": "A session is already in progress. Redirecting you to the room...",
        }

    # ── Conflict checks (read-only, no lock needed) ──
    teacher_active = await db.execute(
        select(Session)
        .join(Booking, Session.booking_id == Booking.id)
        .where(
            (Booking.teacher_id == current_user.id) &
            (Session.status == SessionStatus.IN_PROGRESS) &
            (Booking.id != booking_id)
        )
    )
    if teacher_active.scalars().first():
        raise BookingConflictError(
            detail="You already have another session in progress in a different booking.",
            context={"conflict_type": "teacher_session_in_progress"},
        )

    student_active = await db.execute(
        select(Session)
        .join(Booking, Session.booking_id == Booking.id)
        .where(
            (Booking.student_id == booking.student_id) &
            (Session.status == SessionStatus.IN_PROGRESS)
        )
    )
    if student_active.scalars().first():
        raise BookingConflictError(
            detail="The student is currently in another session.",
            context={"conflict_type": "student_session_in_progress"},
        )

    # ── Check completed sessions ──
    sessions_result = await db.execute(
        select(Session).where(Session.booking_id == booking.id)
    )
    sessions = sessions_result.scalars().all()
    completed = sum(
        1 for s in sessions
        if s.status in (
            SessionStatus.COMPLETED,
            SessionStatus.CANCELLED_BY_STUDENT,
            SessionStatus.CANCELLED_BY_TEACHER,
        )
    )

    if completed >= booking.total_sessions:
        raise InvalidStatusTransitionError(
            detail=f"All {booking.total_sessions} sessions have been completed",
            context={"completed_sessions": completed, "total_sessions": booking.total_sessions},
        )

    # ── Presence check ──
    student_online = await is_user_online(booking.student_id, use_redis=False)

    if not student_online:
        await create_offline_notification_message(
            booking_id=booking_id,
            teacher_id=current_user.id,
            student_id=booking.student_id,
            db=db,
        )
        # Explicit commit required: we want the offline notification persisted
        # even though we're about to raise — SessionManager would rollback on exception.
        await db.commit()
        raise HTTPException(
            detail="Student is currently offline. Please try again when they are online.",
            status_code=480,
        )

    # ── Create session request message ──
    request_message = await create_session_request_message(
        booking_id=booking_id,
        teacher_id=current_user.id,
        student_id=booking.student_id,
        db=db,
    )

    # ── Redis key: set inline (NOT background task) ──
    # The Celery timeout task reads this key immediately after dispatch.
    # It must be set before the task runs, so it cannot be deferred.
    await set_pending_session_key(
        booking_id=booking_id,
        teacher_id=current_user.id,
        student_id=booking.student_id,
        ttl=60
    )

    # ── Side effects (run after successful commit via BackgroundTasks) ──
    background_tasks.add_task(
        handle_session_request_timeout_task.apply_async,
        args=[str(booking_id), str(request_message.id)],
        countdown=60,
    )

    sio_manager = get_socketio_manager()
    if sio_manager:
        background_tasks.add_task(
            sio_manager.emit_to_user,
            user_id=booking.student_id,
            event="session_requested",
            data={
                "bookingId": str(booking_id),
                "teacherId": str(current_user.id),
                "teacherName": current_user.full_name,
                "subjectName": booking.subject.name if booking.subject else "Unknown",
                "sessionNumber": completed + 1,
                "totalSessions": booking.total_sessions,
                "durationMinutes": booking.session_duration_minutes,
                "timestamp": datetime.now(UTC).isoformat(),
                "message": f"{current_user.full_name} has requested a session.",
            },
        )

    return {
        "status": "ready",
        "already_exists": False,
        "completed_sessions": completed,
        "total_sessions": booking.total_sessions,
        "remaining_sessions": booking.total_sessions - completed,
        "online_status": "online",
        "expiration_seconds": 60,
        "message": "Session request sent. Student has 60 seconds to accept.",
    }


# ──────────────────────────────────────────────────────────────────────────────
# Step 4b: Student accepts the session request
# ──────────────────────────────────────────────────────────────────────────────

@router.post("/{booking_id}/accept-session", response_model=LiveKitTokenResponse)
async def accept_session_request(
    booking_id: UUID,
    current_user: CurrentUser,
    db: DbSession,
    request: Request,
    background_tasks: BackgroundTasks,
):
    """
    Student accepts the session request. Session is CREATED here.

    ✓ LOCKING: Booking row locked to prevent duplicate session creation
    ✓ GHOST GUARD: Redirects if session already exists
    ✓ LIVEKIT: Room created before commit; failure rolls back the session
    """
    if current_user.role != UserRole.STUDENT:
        raise PermissionDeniedError(detail="Only students can accept sessions")

    # Lock booking row to prevent two concurrent accepts creating two sessions
    result = await db.execute(
        select(Booking)
        .options(selectinload(Booking.teacher).selectinload(TeacherProfile.user))
        .where(Booking.id == booking_id)
        .with_for_update()
    )
    booking = result.scalar_one_or_none()
    if not booking:
        raise BookingNotFoundError(booking_id=str(booking_id))

    if booking.student_id != current_user.id:
        raise PermissionDeniedError(detail="Cannot accept sessions for a booking you don't own")

    # ── Ghost Guard: redirect if session already in progress ──
    existing_result = await db.execute(
        select(Session)
        .where(Session.booking_id == booking_id)
        .where(Session.status == SessionStatus.IN_PROGRESS)
        .limit(1)
    )
    existing_session = existing_result.scalar_one_or_none()

    if existing_session:
        token = generate_room_token(
            user_id=str(current_user.id),
            session_id=str(existing_session.id),
            display_name=f"{current_user.first_name} {current_user.last_name}",
            is_teacher=False,
        )
        return LiveKitTokenResponse(
            token=token,
            room_name=existing_session.livekit_room_name,
            livekit_url=get_livekit_url_for_client(request),
            actual_start_at=existing_session.actual_start_at,
            session_duration_minutes=booking.session_duration_minutes,
            already_exists=True,
        )

    # ── Handshake check (60-second window) ──
    pending = await get_pending_session_key(str(booking_id))
    if not pending:
        raise HTTPException(
            detail="Session acceptance window expired. Teacher must request again.",
            status_code=410,
        )

    # ── Session capacity check (row-locked to avoid races) ──
    # We use a SELECT of the max(session_number) with FOR UPDATE instead of
    # loading all Session rows and using len(sessions). This avoids scanning
    # many rows and acquires a row lock to serialize concurrent creators,
    # preventing race conditions that could assign the same session_number.
    # Select the current max session_number for this booking and lock rows
    max_sn_result = await db.execute(
        select(Session.session_number)
        .where(Session.booking_id == booking.id)
        .order_by(Session.session_number.desc())
        .limit(1)
        .with_for_update()
    )
    max_session_number = max_sn_result.scalar_one_or_none() or 0

    if max_session_number >= booking.total_sessions:
        raise HTTPException(
            status_code=400,
            detail="All scheduled sessions for this booking are exhausted."
        )

    # ── Mark message as accepted ──
    message_result = await db.execute(
        select(Message)
        .where(
            Message.booking_id == booking.id,
            Message.sender_id == booking.teacher_id,
            Message.receiver_id == booking.student_id,
            Message.message_type == MessageType.SESSION_REQUEST,
            Message.status == MessageStatus.ONGOING,
        )
        .order_by(Message.created_at.desc())
        .limit(1)
    )
    request_message = message_result.scalar_one_or_none()
    if request_message:
        request_message.status = MessageStatus.ACCEPTED

    # ── Create session record ──
    now = datetime.now(tz=UTC)
    new_session = Session(
        booking_id=booking.id,
        session_number=max_session_number + 1,
        status=SessionStatus.IN_PROGRESS,
        teacher_initiated_at=now,
        student_accepted_at=now,
        actual_start_at=now,
    )
    db.add(new_session)

    # flush() is required here to get new_session.id before the LiveKit API call
    await db.flush()
    actual_session_id = new_session.id

    if request_message:
        request_message.session_id = actual_session_id
        await db.flush()

    # ── Create LiveKit room (external call; failure rolls back via exception) ──
    try:
        room_name = await create_room(
            f"session-{actual_session_id}",
            settings.LIVEKIT_EMPTY_TIMEOUT_SECONDS,
            settings.LIVEKIT_MAX_PARTICIPANTS,
        )
        new_session.livekit_room_name = room_name
    except Exception as e:
        logger.error(f"LiveKit room creation failed: {e}")
        raise LiveKitError(cause=e)

    # ── Side effects (run after successful commit via BackgroundTasks) ──
    background_tasks.add_task(clear_pending_session_key, str(booking_id))

    leniency = (booking.session_duration_minutes // 15) * settings.LIVEKIT_ROOM_LENIENCY_MINUTES_PER_15MIN
    total_seconds = (booking.session_duration_minutes + leniency) * 60

    sio_manager = get_socketio_manager()
    if sio_manager:
        teacher_token = generate_room_token(
            user_id=str(booking.teacher_id),
            session_id=str(actual_session_id),
            display_name=f"{booking.teacher.user.first_name} {booking.teacher.user.last_name}",
            is_teacher=True,
        )
        background_tasks.add_task(
            sio_manager.emit_to_user,
            user_id=booking.teacher_id,
            event="session_request_accepted",
            data={
                "bookingId": str(booking_id),
                "sessionId": str(actual_session_id),
                "token": teacher_token,
                "roomName": new_session.livekit_room_name,
                "liveKitUrl": get_livekit_url_for_client(request),
                "actualStartAt": new_session.actual_start_at.isoformat() if new_session.actual_start_at else None,
                "sessionDurationMinutes": booking.session_duration_minutes,
                "leniencyMinutes": leniency,
            },
        )
    background_tasks.add_task(
        cleanup_expired_livekit_room.apply_async,
        args=[str(actual_session_id)],
        countdown=total_seconds,
    )

    student_token = generate_room_token(
        user_id=str(current_user.id),
        session_id=str(actual_session_id),
        display_name=f"{current_user.first_name} {current_user.last_name}",
        is_teacher=False,
    )

    return LiveKitTokenResponse(
        token=student_token,
        room_name=f"session-{actual_session_id}",
        livekit_url=get_livekit_url_for_client(request),
        actual_start_at=new_session.actual_start_at,
        session_duration_minutes=booking.session_duration_minutes,
        already_exists=False,
    )


# ──────────────────────────────────────────────────────────────────────────────
# Step 4c: Student rejects the session request
# ──────────────────────────────────────────────────────────────────────────────

@router.post("/{booking_id}/reject-session")
async def reject_session_request(
    db: DbSession,
    booking_id: Annotated[UUID, Path(..., alias="bookingId")],
    current_user: CurrentUser,
    background_tasks: BackgroundTasks,
):
    """Student rejects the session request within the 60-second window."""
    if current_user.role != UserRole.STUDENT:
        raise PermissionDeniedError(detail="Only students can reject sessions")

    result = await db.execute(select(Booking).where(Booking.id == booking_id))
    booking = result.scalar_one_or_none()
    if not booking:
        raise BookingNotFoundError(booking_id=str(booking_id))

    if booking.student_id != current_user.id:
        raise PermissionDeniedError(detail="Not your booking")

    # ── Handshake check (60-second window) ──
    pending = await get_pending_session_key(str(booking_id))
    if not pending:
        raise HTTPException(
            detail="Session rejection window expired. Teacher must request again.",
            status_code=410,
        )

    # ── Mark message as rejected ──
    message_result = await db.execute(
        select(Message)
        .where(
            Message.booking_id == booking_id,
            Message.sender_id == booking.teacher_id,
            Message.receiver_id == booking.student_id,
            Message.message_type == MessageType.SESSION_REQUEST,
            Message.status == MessageStatus.ONGOING,
        )
        .order_by(Message.created_at.desc())
        .limit(1)
    )
    request_message = message_result.scalar_one_or_none()
    if not request_message:
        raise HTTPException(detail="Session request message not found", status_code=404)

    request_message.status = MessageStatus.REJECTED

    # ── Side effects (run after successful commit via BackgroundTasks) ──
    background_tasks.add_task(clear_pending_session_key, str(booking_id))

    sio_manager = get_socketio_manager()
    if sio_manager:
        background_tasks.add_task(
            sio_manager.emit_to_user,
            user_id=booking.teacher_id,
            event="session_request_rejected",
            data={
                "bookingId": str(booking_id),
                "studentId": str(current_user.id),
                "studentName": current_user.full_name,
                "timestamp": datetime.now(UTC).isoformat(),
                "reason": "Student has rejected the session request.",
                "message": f"{current_user.full_name} has rejected the session request.",
            },
        )

    return {
        "status": "rejected",
        "booking_id": str(booking_id),
        "message": "Session request rejected.",
    }


# ──────────────────────────────────────────────────────────────────────────────
# Read endpoints
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/", response_model=list[BookingRead])
async def list_my_bookings(current_user: CurrentUser, db: DbSession):
    """List bookings for the current user."""
    if current_user.role == UserRole.STUDENT:
        result = await db.execute(
            select(Booking)
            .where(Booking.student_id == current_user.id)
            .order_by(Booking.created_at.desc())
        )
    elif current_user.role == UserRole.TEACHER:
        result = await db.execute(
            select(Booking)
            .where(Booking.teacher_id == current_user.id)
            .order_by(Booking.created_at.desc())
        )
    else:
        raise PermissionDeniedError(detail="Not authorized")

    return result.scalars().all()


@router.get("/{booking_id}", response_model=BookingRead)
async def get_booking(booking_id: UUID, current_user: CurrentUser, db: DbSession):
    """Get a specific booking."""
    result = await db.execute(select(Booking).where(Booking.id == booking_id))
    booking = result.scalar_one_or_none()
    if not booking:
        raise BookingNotFoundError(booking_id=str(booking_id))

    if current_user.id not in (booking.student_id, booking.teacher_id):
        raise PermissionDeniedError(detail="Not your booking")

    return booking


# ──────────────────────────────────────────────────────────────────────────────
# Sync: reconnection recovery
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/{booking_id}/sync", response_model=LiveKitTokenResponse)
async def sync_session(
    booking_id: UUID,
    current_user: CurrentUser,
    db: DbSession,
    request: Request,
):
    """
    Returns a fresh LiveKit token if the session is still within its valid window.
    Used for reconnection / page refresh recovery.
    """
    booking_result = await db.execute(select(Booking).where(Booking.id == booking_id))
    booking = booking_result.scalar_one_or_none()
    if not booking:
        raise BookingNotFoundError(booking_id=str(booking_id))

    is_teacher = current_user.id == booking.teacher_id
    is_student = current_user.id == booking.student_id

    if not (is_teacher or is_student):
        raise PermissionDeniedError(
            detail="Access denied: You are not a participant in this booking."
        )

    if booking.status != BookingStatus.ACTIVE:
        raise HTTPException(
            detail=f"Booking is no longer active. Status: {booking.status.value}",
            status_code=410,
        )

    session_result = await db.execute(
        select(Session)
        .where(Session.booking_id == booking_id)
        .order_by(Session.created_at.desc())
        .limit(1)
    )
    session = session_result.scalar_one_or_none()

    if not session or session.status != SessionStatus.IN_PROGRESS:
        raise HTTPException(detail="No active session in progress.", status_code=410)

    duration = booking.session_duration_minutes
    leniency = getattr(settings, "LIVEKIT_ROOM_LENIENCY_MINUTES_PER_15MIN", 2)
    cutoff = (session.actual_start_at or session.created_at) + timedelta(
        minutes=duration + (duration // 15 * leniency)
    )

    if datetime.now(tz=UTC) > cutoff:
        raise HTTPException(detail="Session window has expired.", status_code=410)

    # Record join timestamp if not already set
    now = datetime.now(tz=UTC)
    if is_teacher and not session.teacher_joined_at:
        session.teacher_joined_at = now
    elif is_student and not session.student_joined_at:
        session.student_joined_at = now

    token = generate_room_token(
        user_id=str(current_user.id),
        session_id=str(session.id),
        display_name=f"{current_user.first_name} {current_user.last_name}",
        is_teacher=is_teacher,
    )

    return LiveKitTokenResponse(
        token=token,
        room_name=session.livekit_room_name,
        livekit_url=get_livekit_url_for_client(request),
        actual_start_at=session.actual_start_at,
        session_duration_minutes=booking.session_duration_minutes,
        already_exists=True,
    )


# ──────────────────────────────────────────────────────────────────────────────
# Cancel booking
# ──────────────────────────────────────────────────────────────────────────────

@router.post("/{booking_id}/cancel", response_model=BookingRead)
async def cancel_booking(
    booking_id: UUID,
    body: BookingCancelRequest,
    current_user: CurrentUser,
    db: DbSession,
    background_tasks: BackgroundTasks,
):
    """
    Cancel a booking, terminating any active session.

    ✓ LOCKING: Booking + active session rows locked atomically
    ✓ FINANCIALS: Teacher credited if student cancels
    ✓ SIDE EFFECTS: Socket notifications run after successful commit
    """
    # Lock booking row to prevent concurrent cancellations
    result = await db.execute(
        select(Booking)
        .where(Booking.id == booking_id)
        .with_for_update()
    )
    booking = result.scalar_one_or_none()
    if not booking:
        raise BookingNotFoundError(booking_id=str(booking_id))

    is_student = current_user.id == booking.student_id
    is_teacher = current_user.id == booking.teacher_id

    if not (is_student or is_teacher):
        raise PermissionDeniedError(detail="Not your booking.")

    if booking.status in (
        BookingStatus.COMPLETED,
        BookingStatus.CANCELLED_BY_STUDENT,
        BookingStatus.CANCELLED_BY_TEACHER,
    ):
        raise ValidationError(
            detail=f"Cannot cancel a booking in status {booking.status.value}"
        )

    # ── Lock and fetch active session separately ──
    # selectinload cannot apply with_for_update to child rows.
    # We fetch and lock the active session explicitly to prevent the webhook
    # or Celery from completing it concurrently mid-cancellation.
    active_session_result = await db.execute(
        select(Session)
        .where(
            (Session.booking_id == booking_id) &
            (Session.status == SessionStatus.IN_PROGRESS)
        )
        .with_for_update()
    )
    active_session = active_session_result.scalar_one_or_none()

    if active_session:
        completion_status = (
            SessionStatus.CANCELLED_BY_STUDENT if is_student
            else SessionStatus.CANCELLED_BY_TEACHER
        )
        await handle_session_completion(
            session=active_session,
            booking=booking,
            db=db,
            completion_status=completion_status,
            background_tasks=background_tasks,
        )

    # ── Refund remaining unused sessions ──
    if booking.status == BookingStatus.ACTIVE:
        remaining_sessions = booking.total_sessions - booking.completed_sessions
        if remaining_sessions > 0:
            # TODO: integrate payment gateway refund
            logger.info(
                f"Booking {booking.id} cancelled. "
                f"{remaining_sessions} session(s) pending refund."
            )

    # ── Finalize booking ──
    booking.status = (
        BookingStatus.CANCELLED_BY_STUDENT if is_student
        else BookingStatus.CANCELLED_BY_TEACHER
    )
    booking.cancellation_reason = body.reason
    booking.cancelled_at = datetime.now(tz=UTC)

    # ── Rating prompt (only if the student had at least one completed session) ──
    if booking.completed_sessions > 0:
        booking.completed_at = booking.completed_at or datetime.now(tz=UTC)
        db.add(Notification(
            user_id=booking.student_id,
            notification_type=NotificationType.RATE_YOUR_TEACHER,
            title="How was your teacher?",
            message="Your booking has ended. Rate your teacher within 7 days.",
            booking_id=booking.id,
        ))
        background_tasks.add_task(
            _schedule_rating_reminder,
            str(booking.id),
            str(booking.student_id),
        )

    # ── Side effects (run after successful commit via BackgroundTasks) ──
    background_tasks.add_task(clear_pending_session_key, str(booking_id))

    sio_manager = get_socketio_manager()
    if sio_manager:
        other_user_id = booking.teacher_id if is_student else booking.student_id
        background_tasks.add_task(
            sio_manager.emit_to_user,
            user_id=other_user_id,
            event="booking_rejected",
            data={
                "bookingId": str(booking.id),
                "reason": body.reason,
                "cancelledBy": "student" if is_student else "teacher",
            },
        )
        if booking.completed_sessions > 0:
            background_tasks.add_task(
                sio_manager.emit_to_user,
                user_id=booking.student_id,
                event="booking_completed",
                data={"bookingId": str(booking.id), "teacherId": str(booking.teacher_id)},
            )

    return booking