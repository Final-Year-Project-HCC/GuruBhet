import logging
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Header, HTTPException, Request
from livekit.api import WebhookReceiver, TokenVerifier
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from app.core.config import settings
from app.core.dependencies import DbSession
from app.core.enums import SessionStatus, BookingStatus
from app.models.booking import Session, Booking

logger = logging.getLogger(__name__)

router = APIRouter()


def _session_id_from_room(room_name: str) -> str | None:
    if room_name.startswith("session-"):
        return room_name[len("session-"):]
    return None


async def _get_session_and_booking(
    db: DbSession,
    room_name: str,
) -> tuple[Session, Booking] | tuple[None, None]:
    if not _session_id_from_room(room_name):
        return None, None
    result = await db.execute(
        select(Session)
        .options(joinedload(Session.booking))
        .where(Session.livekit_room_name == room_name)
    )
    session = result.scalar_one_or_none()
    if not session:
        return None, None
    return session, session.booking




_receiver = WebhookReceiver(
    TokenVerifier(
        api_key=settings.LIVEKIT_API_KEY,
        api_secret=settings.LIVEKIT_API_SECRET,
    )
)


@router.post("/webhook")
async def livekit_webhook(
    request: Request,
    db: DbSession,
    authorization: str = Header(...),
):
    """
    LiveKit POSTs signed events here on every room lifecycle change.

    Events handled:
      room_started       → session IN_PROGRESS, record actual_start_at
      room_finished      → session COMPLETED, record actual_end_at
      participant_joined → record teacher_joined_at / student_joined_at
      participant_left   → detect no-show if other party never joined
    """
    body = await request.body()

    try:
        event = _receiver.receive(body.decode(), authorization)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid LiveKit webhook signature")

    now = datetime.now(tz=timezone.utc)

    # ── room_started ──────────────────────────────────────────────────────────
    if event.event == "room_started" and event.room:
        session, _ = await _get_session_and_booking(db, event.room.name)
        # Transition from READY to IN_PROGRESS when room starts
        if session and session.status == SessionStatus.READY:
            session.status = SessionStatus.IN_PROGRESS
            session.actual_start_at = now
            await db.flush()

    # ── room_finished ─────────────────────────────────────────────────────────
    elif event.event == "room_finished" and event.room:
        session, booking = await _get_session_and_booking(db, event.room.name)
        
        # Only process if session and booking exist
        if not session or not booking:
            return {"status": "ok"}
        
        try:
            # ── Common completion logic (happens regardless of session status) ──
            # The session status was already set by the route or Celery task that deleted the room.
            # This webhook only handles the common post-completion tasks.
            
            # Record actual end time if not already set
            if not session.actual_end_at:
                session.actual_end_at = now
                await db.flush()
            
            # ── Create transaction for session completion ──
            # Credit the teacher if:
            # 1. Session was COMPLETED (teacher did the work)
            # 2. Session was CANCELLED_BY_STUDENT (teacher's time was reserved)
            # Do NOT credit if CANCELLED_BY_TEACHER (teacher's own cancellation)
            if session.status in (SessionStatus.COMPLETED, SessionStatus.CANCELLED_BY_STUDENT):
                # Credit the teacher for this session
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
            
            # ── Update booking counters for all completed sessions ──
            # Treat all sessions (COMPLETED, CANCELLED_BY_STUDENT, CANCELLED_BY_TEACHER) as "completed"
            # The difference is only in whether transaction is created
            booking.completed_sessions += 1
            if booking.completed_sessions >= booking.total_sessions:
                booking.status = BookingStatus.COMPLETED
            await db.flush()
            
            # Increment teacher experience (for all session statuses)
            from app.repositories.teacher_subject_repo import TeacherSubjectRepository
            ts_repo = TeacherSubjectRepository(db)
            await ts_repo.increment_completed_sessions(
                teacher_id=booking.teacher_id,
                subject_id=booking.subject_id,
            )
            await db.flush()
            
            # ── Emit "session_finished" event to both participants ──
            # Always emit, with the status that was set by the route/task
            from app.core.socketio import get_socketio_manager
            sio_manager = get_socketio_manager()
            if sio_manager:
                try:
                    await sio_manager.emit_to_user(
                        user_id=booking.student_id,
                        event="session_finished",
                        data={
                            "session_id": str(session.id),
                            "status": session.status.value,
                            "actual_end_at": session.actual_end_at.isoformat() if session.actual_end_at else None,
                        }
                    )
                    await sio_manager.emit_to_user(
                        user_id=booking.teacher_id,
                        event="session_finished",
                        data={
                            "session_id": str(session.id),
                            "status": session.status.value,
                            "actual_end_at": session.actual_end_at.isoformat() if session.actual_end_at else None,
                        }
                    )
                except Exception as exc:
                    logger.warning(f"Failed to emit session_finished event: {exc}")
            

            #TO-BE-REVIEWED
            # ── Trigger post-session Celery tasks (only if completed, not cancelled) ──
            if session.status == SessionStatus.COMPLETED:
                try:
                    from app.tasks.payment_tasks import process_session_billing
                    from app.tasks.notification_tasks import send_session_complete_notification
                    
                    process_session_billing.delay(str(session.id), str(booking.id))
                    send_session_complete_notification.delay(str(session.id), str(booking.id))
                except Exception as exc:
                    logger.warning(f"Failed to schedule post-session tasks: {exc}")
            
            await db.commit()
            
            logger.info(
                f"✅ Room finished for session {session.id} (status: {session.status.value})",
                extra={
                    "session_id": str(session.id),
                    "booking_id": str(booking.id),
                    "teacher_id": str(booking.teacher_id),
                    "student_id": str(booking.student_id),
                    "status": session.status.value,
                }
            )
            
        except Exception as exc:
            await db.rollback()
            logger.error(
                f"Error processing room_finished event for session {session.id}: {exc}",
                exc_info=True,
                extra={"session_id": str(session.id) if session else None}
            )
            # Continue anyway - don't fail the webhook


    # ── participant_joined ────────────────────────────────────────────────────
    elif event.event == "participant_joined" and event.room and event.participant:
        session, booking = await _get_session_and_booking(db, event.room.name)
        if not session or not booking:
            return {"status": "ignored"}

        identity = event.participant.identity
        if not identity.startswith("user-"):
            return {"status": "ignored"}

        try:
            user_id = UUID(identity[len("user-"):])
        except ValueError:
            return {"status": "ignored"}

        if user_id == booking.teacher_id and not session.teacher_joined_at:
            session.teacher_joined_at = now
        elif user_id == booking.student_id and not session.student_joined_at:
            session.student_joined_at = now
        await db.flush()

    # ── participant_left ──────────────────────────────────────────────────────
    elif event.event == "participant_left" and event.room and event.participant:
        session, booking = await _get_session_and_booking(db, event.room.name)
        if not session or not booking:
            return {"status": "ignored"}

        identity = event.participant.identity
        if not identity.startswith("user-"):
            return {"status": "ignored"}

        try:
            user_id = UUID(identity[len("user-"):])
        except ValueError:
            return {"status": "ignored"}

        if user_id == booking.teacher_id and not session.student_joined_at:
            # Student never joined — treat as cancellation by student
            session.status = SessionStatus.CANCELLED_BY_STUDENT
            await db.flush()
        elif user_id == booking.student_id and not session.teacher_joined_at:
            # Teacher never joined — treat as cancellation by teacher
            session.status = SessionStatus.CANCELLED_BY_TEACHER
            await db.flush()

    return {"status": "ok"}