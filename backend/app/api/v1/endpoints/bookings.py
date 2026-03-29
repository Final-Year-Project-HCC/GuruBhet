from uuid import UUID
from datetime import datetime, timezone, timedelta
from decimal import Decimal
import logging
from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from app.core.dependencies import DbSession, CurrentUser
from app.core.enums import BookingStatus, UserRole, SessionStatus
from app.models.booking import Booking, Session
from app.models.subject import Subject
from app.schemas.booking import (
    BookingRequestCreate, BookingApproveRequest,
    BookingRead, BookingCancelRequest, LiveKitTokenResponse, SessionRead
)
from app.schemas.payment import EsewaPaymentInitResponse
from app.utils.livekit import (
    create_room, generate_room_token, 
    set_pending_session_key, get_pending_session_key, clear_pending_session_key,
)
from app.utils.presence import (
    is_user_online, set_session_request_pending, get_session_request_pending,
    clear_session_request_pending,
)
from app.db.redis import cache_get, cache_set
from app.models.communication import Message, MessageType, MessageStatus
from app.tasks.session_request_tasks import (
    create_session_request_message, create_offline_notification_message,
    handle_session_request_timeout_task,
)
from app.tasks.livekit_tasks import cleanup_expired_livekit_room
from app.core.socketio import get_socketio_manager

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/request", response_model=BookingRead, status_code=201)
async def create_booking_request(
    body: BookingRequestCreate, current_user: CurrentUser, db: DbSession
):
    """
    Step 1: Student creates a booking request.
    
    Request specifies teacher, subject, number of sessions, rate per session, and session duration.
    Session duration must be a multiple of 15 minutes.
    Booking starts in PENDING_APPROVAL status awaiting teacher approval.
    """
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(status_code=403, detail="Only students can create booking requests")

    # Verify subject exists
    subject_result = await db.execute(
        select(Subject).where(Subject.id == body.subject_id)
    )
    subject = subject_result.scalar_one_or_none()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    total_amount = body.rate_per_session * Decimal(body.total_sessions)

    booking = Booking(
        student_id=current_user.id,
        teacher_id=body.teacher_id,
        subject_id=body.subject_id,
        total_sessions=body.total_sessions,
        rate_per_session=body.rate_per_session,
        session_duration_minutes=body.session_duration_minutes,
        total_amount=total_amount,
        escrow_amount=Decimal("0"),  # Not captured yet
        status=BookingStatus.PENDING_APPROVAL,
    )
    db.add(booking)
    await db.flush()
    await db.refresh(booking)
    return booking


@router.post("/{booking_id}/approve", response_model=BookingRead)
async def approve_booking_request(
    booking_id: UUID, body: BookingApproveRequest, current_user: CurrentUser, db: DbSession
):
    """
    Step 2: Teacher approves the booking request.
    
    Booking moves from PENDING_APPROVAL to PENDING_PAYMENT.
    Student will then initiate payment (no session scheduling needed).
    Sessions are created on-demand when both parties start a session.
    """
    if current_user.role != UserRole.TEACHER:
        raise HTTPException(status_code=403, detail="Only teachers can approve bookings")

    result = await db.execute(select(Booking).where(Booking.id == booking_id))
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if booking.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your booking to approve")

    if booking.status != BookingStatus.PENDING_APPROVAL:
        raise HTTPException(
            status_code=400, detail=f"Booking cannot be approved in status {booking.status.value}"
        )

    booking.status = BookingStatus.PENDING_PAYMENT
    booking.teacher_approved_at = datetime.now(tz=timezone.utc)
    booking.teacher_approval_notes = body.notes
    await db.flush()
    await db.refresh(booking)
    return booking


@router.post("/{booking_id}/initiate-payment", response_model=EsewaPaymentInitResponse)
async def initiate_payment(booking_id: UUID, current_user: CurrentUser, db: DbSession):
    """
    Step 3: Student initiates payment for the booking.
    
    Booking must be in PENDING_PAYMENT status.
    Returns eSewa payment params — frontend redirects to eSewa.
    On success, eSewa callback activates the booking.
    Sessions are created on-demand; no pre-scheduling required.
    """
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(status_code=403, detail="Only students can pay for bookings")

    result = await db.execute(select(Booking).where(Booking.id == booking_id))
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if booking.student_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your booking")

    if booking.status != BookingStatus.PENDING_PAYMENT:
        raise HTTPException(
            status_code=400, detail=f"Booking cannot be paid in status {booking.status.value}"
        )

    # Return eSewa payment init params (this would call eSewa API)
    # For now, return a placeholder response
    return EsewaPaymentInitResponse(
        transaction_uuid=str(booking.id),  # Placeholder
        total_amount=str(booking.total_amount),
        esewa_url="https://esewa.com.np",  # Placeholder
    )


@router.post("/{booking_id}/request-session", response_model=dict)
async def request_session(booking_id: UUID, current_user: CurrentUser, db: DbSession):
    """
    Step 4a: Teacher requests a new session with PRESENCE CHECK.
    
    ✓ PRESENCE CHECK: Verifies student is online before proceeding
    ✓ MESSAGING: Creates notification messages for all outcomes
    ✓ EXPIRATION: Sets up unified 60-second expiration handling via Redis TTL
    ✓ IN_PROGRESS CHECK: Rejects request if session already in progress (use /sync instead)
    
    Flow:
    1. Verify booking exists and is ACTIVE
    2. Check if a session is already IN_PROGRESS
       - If yes: Return 409 Conflict, direct to use /sync endpoint
       - If no: Proceed to step 3
    3. Check student is ONLINE (presence check)
       - If offline: Create error message, return 480 Subscriber Offline
       - If online: Proceed to step 4
    4. Set Redis key with 60-second TTL for handshake window
    5. Create session request message
    6. Set up expiration handler via Redis TTL + background task
    7. Emit Socket.IO event to student
    8. Return success with session counts
    
    Args:
        booking_id: UUID of the booking
        current_user: Teacher making the request
        db: Database session
    
    Returns:
        {
            "status": "ready",
            "completed_sessions": int,
            "total_sessions": int,
            "remaining_sessions": int,
            "message": str,
            "online_status": "online"
        }
    
    Raises:
        403: Only teachers can request sessions
        403: Not your booking
        400: Booking not ACTIVE
        409: Session already in progress (use /sync to reconnect)
        400: All sessions completed
        480: Student is offline (SUBSCRIBER_OFFLINE)
    """
    # ── Step 1: Verify teacher and booking ──
    if current_user.role != UserRole.TEACHER:
        raise HTTPException(status_code=403, detail="Only teachers can request sessions")

    result = await db.execute(select(Booking).where(Booking.id == booking_id))
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if booking.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your booking")

    if booking.status != BookingStatus.ACTIVE:
        raise HTTPException(
            status_code=400, detail=f"Booking must be ACTIVE to request sessions (current: {booking.status.value})"
        )
    
    # ── Check if a session is already in progress ──
    in_progress_session = await db.execute(
        select(Session).where(
            (Session.booking_id == booking_id) &
            (Session.status == SessionStatus.IN_PROGRESS)
        )
    )
    if in_progress_session.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail="A session is already in progress for this booking. Use /sync to reconnect."
        )
    
    # ── Step 2: Check completed sessions ──
    sessions_result = await db.execute(
        select(Session).where(Session.booking_id == booking.id)
    )
    sessions = sessions_result.scalars().all()
    completed = sum(1 for s in sessions if s.status in (SessionStatus.COMPLETED, SessionStatus.CANCELLED_BY_STUDENT, SessionStatus.CANCELLED_BY_TEACHER))
    
    if completed >= booking.total_sessions:
        raise HTTPException(
            status_code=400, detail=f"All {booking.total_sessions} sessions have been completed"
        )
    # ── Step 3: Check student presence (PRESENCE CHECK) ──
    student_online = await is_user_online(booking.student_id, use_redis=True)
    
    if not student_online:
        # Student is offline - create error message and return 480
        await create_offline_notification_message(
            booking_id=booking_id,
            teacher_id=current_user.id,
            student_id=booking.student_id,
            db=db,
        )
        await db.commit()
        
        logger = logging.getLogger(__name__)
        logger.info(
            f"Session request rejected: student offline. "
            f"Teacher={current_user.id}, Student={booking.student_id}, Booking={booking_id}"
        )
        
        # Return 480 Subscriber Offline
        raise HTTPException(
            status_code=480,
            detail="Student is currently offline. Please try again when they are online."
        )



    # ── Step 4: Set up Redis keys with 60-second TTL ──
    # This key's expiration will trigger the background handler
    await set_pending_session_key(str(booking_id))

    # ── Step 5: Create session request notification message ──
    request_message = await create_session_request_message(
        booking_id=booking_id,
        teacher_id=current_user.id,
        student_id=booking.student_id,
        db=db,
    )
    
    # ── Step 5b: Queue Celery task to handle 60-second timeout ──
    # After 60s, check if message status is still ONGOING, if so mark as MISSED
    handle_session_request_timeout_task.apply_async(
        args=[str(booking_id), str(request_message.id)],
        countdown=60
    )
    
    # ── Step 6: Emit Socket.IO event to student ──
    sio_manager = get_socketio_manager()
    if sio_manager:
        await sio_manager.emit_to_user(
            user_id=booking.student_id,
            event="session_request",
            data={
                "booking_id": str(booking_id),
                "teacher_id": str(current_user.id),
                "teacher_name": current_user.full_name,
                "subject": booking.subject.name if booking.subject else "Unknown",
                "session_number": completed + 1,
                "total_sessions": booking.total_sessions,
                "duration_minutes": booking.session_duration_minutes,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "message": f"{current_user.full_name} has requested a session. You have 60 seconds to accept.",
            },
        )

    # Commit all messages to database
    await db.commit()

    # ── Step 7: Return success ──
    return {
        "status": "ready",
        "completed_sessions": completed,
        "total_sessions": booking.total_sessions,
        "remaining_sessions": booking.total_sessions - completed,
        "online_status": "online",
        "expiration_seconds": 60,
        "message": "Session request sent. Student has 60 seconds to accept."
    }




@router.post("/{booking_id}/accept-session", response_model=LiveKitTokenResponse)
async def accept_session_request(booking_id: UUID, current_user: CurrentUser, db: DbSession):
    """
    Step 4b: Student accepts the session request.
    
    IMPORTANT: Session is CREATED here when student accepts, not before.
    This ensures we only create sessions when we're certain they will happen.
    
    Flow:
    1. Verify Redis key exists (60-second window) — if expired, return 410 Gone
    2. Get next session number from booking
    3. CREATE Session record in database with status READY
    4. Create LiveKit room (webhook will transition to IN_PROGRESS and set actual_start_at)
    5. Clear Redis key
    6. Emit socket event to teacher with their LiveKit token
    7. Return LiveKit token for student to join
    
    Returns:
      - 200 OK with LiveKit token, room name, and URL if successful
      - 410 Gone if session acceptance window expired
      - 404 Not found if booking or message not found
    """
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(status_code=403, detail="Only students can accept sessions")

    result = await db.execute(select(Booking).where(Booking.id == booking_id))
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if booking.student_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your booking")

    # ── Check Redis key (60-second handshake window) ──
    pending = await get_pending_session_key(str(booking_id))
    if not pending:
        # Redis key expired — student took >60 seconds to accept
        raise HTTPException(
            status_code=410,
            detail="Session acceptance window expired. Teacher must request again."
        )
    
    # ── CREATE Session record NOW (on acceptance) ──
    # Get count of completed sessions
    sessions_result = await db.execute(
        select(Session).where(Session.booking_id == booking.id)
    )
    sessions = sessions_result.scalars().all()
    completed = sum(1 for s in sessions if s.status in (SessionStatus.COMPLETED, SessionStatus.CANCELLED_BY_STUDENT, SessionStatus.CANCELLED_BY_TEACHER) )
    
    if completed >= booking.total_sessions:
        raise HTTPException(
            status_code=400, detail=f"All {booking.total_sessions} sessions have been completed"
        )

    # Calculate next session number
    session_number = len(sessions) + 1
    
    # Create the Session record
    session = Session(
        booking_id=booking.id,
        session_number=session_number,
        status=SessionStatus.READY,
        teacher_initiated_at=datetime.now(tz=timezone.utc),
        student_accepted_at=datetime.now(tz=timezone.utc),
    )
    db.add(session)
    await db.flush()
    await db.refresh(session)
    
    # Update session_id in response (the one created)
    actual_session_id = session.id

    # Create LiveKit room on acceptance
    # Note: webhook will set status to IN_PROGRESS and actual_start_at when room_started event fires
    room_name = await create_room(str(actual_session_id), booking.session_duration_minutes)
    session.livekit_room_name = room_name
    await db.flush()
    
    # ── Schedule cleanup task for when session expires ──
    # Room will be deleted after: session_duration_minutes + leniency buffer
    # This ensures room_finished event fires at the expected time regardless of participant presence
    from app.core.config import settings
    leniency_multiplier = settings.LIVEKIT_ROOM_LENIENCY_MINUTES_PER_15MIN
    leniency_minutes = (booking.session_duration_minutes // 15) * leniency_multiplier
    total_timeout_minutes = booking.session_duration_minutes + leniency_minutes
    total_timeout_seconds = int(total_timeout_minutes * 60)
    
    cleanup_task = cleanup_expired_livekit_room.apply_async(
        args=[str(actual_session_id)],
        countdown=total_timeout_seconds,
    )
    
    logger.info(
        f"Scheduled LiveKit room cleanup for session {actual_session_id} "
        f"in {total_timeout_minutes} minutes ({total_timeout_seconds}s)",
        extra={
            "session_id": str(actual_session_id),
            "booking_id": str(booking_id),
            "timeout_minutes": total_timeout_minutes,
            "timeout_seconds": total_timeout_seconds,
            "task_id": cleanup_task.id,
        }
    )
    
    # ── Update message status to ACCEPTED (Case 2) ──
    # Fetch the current ONGOING session request for this booking and participants
    message_result = await db.execute(
        select(Message).where(
            Message.booking_id == booking_id,
            Message.sender_id == booking.teacher_id,
            Message.receiver_id == booking.student_id,
            Message.message_type == MessageType.SESSION_REQUEST,
            Message.status == MessageStatus.ONGOING,
        ).order_by(Message.created_at.desc()).limit(1)
    )
    request_message = message_result.scalar_one_or_none()
    if request_message:
        request_message.status = MessageStatus.ACCEPTED
        await db.flush()
    
    # ── Clear Redis key after successful acceptance ──
    await clear_pending_session_key(str(booking_id))
    
    # ── Emit Socket.IO event to teacher with their token ──
    from app.core.socketio import get_socketio_manager
    from app.core.config import settings
    
    sio_manager = get_socketio_manager()
    if sio_manager:
        # Generate token for teacher
        teacher_token = generate_room_token(
            user_id=str(booking.teacher_id),
            session_id=str(actual_session_id),
            display_name=f"{booking.teacher.first_name} {booking.teacher.last_name}",
            is_teacher=True,
        )
        
        # Emit event to teacher
        await sio_manager.emit_to_user(
            user_id=booking.teacher_id,
            event="session_ready",
            data={
                "token": teacher_token,
                "room_name": session.livekit_room_name,
                "livekit_url": settings.LIVEKIT_URL,
            }
        )
    
    await db.refresh(session)
    
    # Return student's token in HTTP response
    student_token = generate_room_token(
        user_id=str(current_user.id),
        session_id=str(actual_session_id),
        display_name=f"{current_user.first_name} {current_user.last_name}",
        is_teacher=False,
    )
    
    from app.core.config import settings
    return LiveKitTokenResponse(
        token=student_token,
        room_name=session.livekit_room_name,
        livekit_url=settings.LIVEKIT_URL,
    )


@router.post("/{booking_id}/reject-session")
async def reject_session_request(booking_id: UUID, current_user: CurrentUser, db: DbSession):
    """
    Step 4c: Student explicitly rejects the session request.
    
    Case 3 handler: Student rejects within 60-second window.
    
    Flow:
    1. Verify Redis key exists (60-second window)
    2. Update session request message status to REJECTED
    3. Clear Redis key
    4. Emit socket event to teacher with rejection notification
    5. Return success response
    
    Returns:
        {
            "status": "rejected",
            "booking_id": UUID,
            "message": "Session request rejected."
        }
    
    Raises:
        403: Only students can reject sessions
        404: Booking not found
        403: Not student's booking
        410: Session rejection window expired (>60 seconds)
    """
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(status_code=403, detail="Only students can reject sessions")

    result = await db.execute(select(Booking).where(Booking.id == booking_id))
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if booking.student_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your booking")

    # ── Check Redis key (60-second rejection window) ──
    pending = await get_pending_session_key(str(booking_id))
    if not pending:
        # Redis key expired — student took >60 seconds to reject
        raise HTTPException(
            status_code=410,
            detail="Session rejection window expired. Teacher must request again."
        )
    
    # ── Update message status to REJECTED (Case 3) ──
    # Fetch the current ONGOING session request for this booking and participants
    message_result = await db.execute(
        select(Message).where(
            Message.booking_id == booking_id,
            Message.sender_id == booking.teacher_id,
            Message.receiver_id == booking.student_id,
            Message.message_type == MessageType.SESSION_REQUEST,
            Message.status == MessageStatus.ONGOING,
        ).order_by(Message.created_at.desc()).limit(1)
    )
    request_message = message_result.scalar_one_or_none()
    if not request_message:
        raise HTTPException(status_code=404, detail="Session request message not found")
    
    request_message.status = MessageStatus.REJECTED
    await db.flush()
    
    # ── Clear Redis key after rejection ──
    await clear_pending_session_key(str(booking_id))
    
    # ── Emit Socket.IO event to teacher with rejection notification ──
    from app.core.socketio import get_socketio_manager
    sio_manager = get_socketio_manager()
    if sio_manager:
        await sio_manager.emit_to_user(
            user_id=booking.teacher_id,
            event="session_rejected",
            data={
                "booking_id": str(booking_id),
                "student_id": str(current_user.id),
                "student_name": current_user.full_name,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "message": f"{current_user.full_name} has rejected your session request.",
            }
        )
    
    await db.commit()
    
    return {
        "status": "rejected",
        "booking_id": str(booking_id),
        "message": "Session request rejected."
    }


@router.get("/", response_model=list[BookingRead])
async def list_my_bookings(current_user: CurrentUser, db: DbSession):
    """List bookings for the current user (student or teacher view)."""
    if current_user.role == UserRole.STUDENT:
        result = await db.execute(
            select(Booking).where(Booking.student_id == current_user.id).order_by(Booking.created_at.desc())
        )
    elif current_user.role == UserRole.TEACHER:
        result = await db.execute(
            select(Booking).where(Booking.teacher_id == current_user.id).order_by(Booking.created_at.desc())
        )
    else:
        raise HTTPException(status_code=403, detail="Not authorized")

    bookings = result.scalars().all()
    return bookings


@router.get("/{booking_id}", response_model=BookingRead)
async def get_booking(booking_id: UUID, current_user: CurrentUser, db: DbSession):
    """Get a specific booking; must be student or teacher in the booking."""
    result = await db.execute(select(Booking).where(Booking.id == booking_id))
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if current_user.id not in (booking.student_id, booking.teacher_id):
        raise HTTPException(status_code=403, detail="Not your booking")

    return booking

@router.get("/{booking_id}/sync", response_model=LiveKitTokenResponse)
async def sync_session(booking_id: UUID, current_user: CurrentUser, db: DbSession):
    """
    Sync endpoint for Socket.IO reconnection/page refresh recovery.
    
    Both teacher and student can call this to get a fresh LiveKit token
    and check if they're still within the session window (with leniency buffer).
    
    Leniency Formula:
      For a session with duration D minutes, 
      allow LIVEKIT_ROOM_LENIENCY_MINUTES_PER_15MIN extra minute per 15 minutes:
      leniency_buffer = (D // 15) * LIVEKIT_ROOM_LENIENCY_MINUTES_PER_15MIN minutes
      Allow access if: current_time <= (session_end + leniency_buffer)
    
    Flow:
      1. Verify booking is ACTIVE
      2. Find the most recent session for this booking
      3. Check SessionStatus - if COMPLETED or CANCELLED_BY_*, deny access
      4. Verify session is IN_PROGRESS
      5. Verify current time is within session window + leniency
      6. Record join timestamp if needed
      7. Return fresh LiveKit token
    
    Returns:
      - 200 OK with fresh LiveKit token if valid
      - 403 Forbidden if session window + leniency has expired
      - 410 Gone if session not found, completed, cancelled, or not in progress
    
    Side effects:
      - Records join timestamp if not already recorded
    """
    from app.core.config import settings
    
    # Fetch booking
    booking_result = await db.execute(select(Booking).where(Booking.id == booking_id))
    booking = booking_result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Verify user is part of this booking
    if current_user.id not in (booking.student_id, booking.teacher_id):
        raise HTTPException(status_code=403, detail="Not your booking")
    
    # Verify booking is ACTIVE
    if booking.status != BookingStatus.ACTIVE:
        raise HTTPException(
            status_code=410,
            detail=f"Booking is no longer active. Status: {booking.status.value}"
        )
    
    # Find the current session for this booking
    # Note: webhook guarantees actual_start_at is set when status is IN_PROGRESS
    session_result = await db.execute(
        select(Session).where(Session.booking_id == booking_id)
        .order_by(Session.created_at.desc())
        .limit(1)
    )
    session = session_result.scalar_one_or_none()
    
    if not session:
        raise HTTPException(status_code=410, detail="No session found")
    
    # Check if session is still active (IN_PROGRESS)
    # If session is COMPLETED or CANCELLED_BY_*, deny access
    if session.status == SessionStatus.COMPLETED:
        raise HTTPException(
            status_code=410,
            detail="Session has been completed"
        )
    elif session.status in (SessionStatus.CANCELLED_BY_TEACHER, SessionStatus.CANCELLED_BY_STUDENT):
        raise HTTPException(
            status_code=410,
            detail=f"Session was cancelled by {session.status.value.split('_')[2]}"
        )
    elif session.status != SessionStatus.IN_PROGRESS:
        raise HTTPException(
            status_code=410,
            detail=f"Session is not in progress. Current status: {session.status.value}"
        )
    
    # Session is IN_PROGRESS - calculate leniency buffer for time-based access control
    session_duration_minutes = booking.session_duration_minutes
    leniency_multiplier = settings.LIVEKIT_ROOM_LENIENCY_MINUTES_PER_15MIN
    leniency_minutes = (session_duration_minutes // 15) * leniency_multiplier
    
    # Webhook guarantees actual_start_at is set (room_started event sets it)
    session_end = session.actual_start_at + timedelta(minutes=session_duration_minutes)
    allowed_end_time = session_end + timedelta(minutes=leniency_minutes)
    
    # Check if current time is within window + leniency
    now = datetime.now(tz=timezone.utc)
    if now > allowed_end_time:
        raise HTTPException(
            status_code=403,
            detail=f"Session window expired. Window closed at {allowed_end_time.isoformat()}"
        )
    
    # Record join timestamp if not already recorded
    is_teacher = current_user.id == booking.teacher_id
    if is_teacher and not session.teacher_joined_at:
        session.teacher_joined_at = now
    elif not is_teacher and not session.student_joined_at:
        session.student_joined_at = now
    
    await db.flush()
    
    # Generate fresh LiveKit token
    token = generate_room_token(
        user_id=str(current_user.id),
        session_id=str(session.id),
        display_name=f"{current_user.first_name} {current_user.last_name}",
        is_teacher=is_teacher,
    )
    
    return LiveKitTokenResponse(
        token=token,
        room_name=session.livekit_room_name,
        livekit_url=settings.LIVEKIT_URL,
    )


@router.post("/{booking_id}/cancel", response_model=BookingRead)
async def cancel_booking(
    booking_id: UUID, body: BookingCancelRequest, current_user: CurrentUser, db: DbSession
):
    """
    Cancel a booking.
    
    Logic:
    - If PENDING_APPROVAL or PENDING_PAYMENT: cancel immediately (no refund needed)
    - If ACTIVE: cancel and trigger refund for uncompleted sessions
    - If COMPLETED or already CANCELLED: raise error (cannot cancel)
    """
    result = await db.execute(select(Booking).where(Booking.id == booking_id))
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if current_user.id not in (booking.student_id, booking.teacher_id):
        raise HTTPException(status_code=403, detail="Not your booking")
    
    if booking.status in (BookingStatus.COMPLETED, BookingStatus.CANCELLED_BY_STUDENT, BookingStatus.CANCELLED_BY_TEACHER):
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot cancel booking in status {booking.status.value}"
        )
    # Only trigger refund if booking was ACTIVE (money was already taken)
    if booking.status == BookingStatus.ACTIVE:
        # TODO: queue Celery task for refund
        pass

    if current_user.id == booking.student_id:
        booking.status = BookingStatus.CANCELLED_BY_STUDENT
    elif current_user.id == booking.teacher_id:
        booking.status = BookingStatus.CANCELLED_BY_TEACHER
 
    booking.cancellation_reason = body.reason
    booking.cancelled_at = datetime.now(tz=timezone.utc)
    
    await db.flush()
    await db.refresh(booking)
    return booking
