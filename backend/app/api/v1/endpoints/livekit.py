from datetime import datetime, timezone

from fastapi import APIRouter, Header, HTTPException, Request
from livekit.api import WebhookReceiver
from livekit.api.webhook import WebhookEvent
from sqlalchemy import select

from app.core.config import settings
from app.core.dependencies import DbSession
from app.core.enums import SessionStatus
from app.models.booking import Session

router = APIRouter()

_receiver = WebhookReceiver(
    api_key=settings.LIVEKIT_API_KEY,
    api_secret=settings.LIVEKIT_API_SECRET,
)


def _session_id_from_room(room_name: str) -> str | None:
    """Room names are 'session-{session_id}'."""
    if room_name.startswith("session-"):
        return room_name[len("session-"):]
    return None


async def _get_session(db: DbSession, room_name: str) -> Session | None:
    sid = _session_id_from_room(room_name)
    if not sid:
        return None
    result = await db.execute(select(Session).where(Session.livekit_room_name == room_name))
    return result.scalar_one_or_none()


@router.post("/webhook")
async def livekit_webhook(
    request: Request,
    db: DbSession,
    authorization: str = Header(...),
):
    """
    LiveKit POSTs signed webhook events here.

    Handled events:
      room_started       → session IN_PROGRESS, record actual_start_at
      room_finished      → session COMPLETED, save recording_url, record actual_end_at
      participant_joined → record teacher_joined_at / student_joined_at
      participant_left   → detect no-shows if the other party never joined
    """
    body = await request.body()

    try:
        event: WebhookEvent = _receiver.receive(body.decode(), authorization)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid LiveKit webhook signature")

    now = datetime.now(tz=timezone.utc)

    # ── room_started ──────────────────────────────────────────────────────────
    if event.event == "room_started" and event.room:
        session = await _get_session(db, event.room.name)
        if session and session.status == SessionStatus.SCHEDULED:
            session.status = SessionStatus.IN_PROGRESS
            session.actual_start_at = now
            await db.flush()

    # ── room_finished ─────────────────────────────────────────────────────────
    elif event.event == "room_finished" and event.room:
        session = await _get_session(db, event.room.name)
        if session and session.status == SessionStatus.IN_PROGRESS:
            session.status = SessionStatus.COMPLETED
            session.actual_end_at = now

            # Attach recording if LiveKit egress produced one
            if event.room.metadata:
                session.recording_url = event.room.metadata

            await db.flush()

            # Update booking completed_sessions count
            from app.models.booking import Booking
            from app.core.enums import BookingStatus
            booking_result = await db.execute(
                select(Booking).where(Booking.id == session.booking_id)
            )
            booking = booking_result.scalar_one_or_none()
            if booking:
                booking.completed_sessions += 1
                if booking.completed_sessions >= booking.total_sessions:
                    booking.status = BookingStatus.COMPLETED
                await db.flush()

            # Increment TeacherSubject experience counter
            from app.repositories.teacher_subject_repo import TeacherSubjectRepository
            ts_repo = TeacherSubjectRepository(db)
            await ts_repo.increment_completed_sessions(
                teacher_id=booking.teacher_id,
                subject_id=booking.subject_id,
            )

    # ── participant_joined ────────────────────────────────────────────────────
    elif event.event == "participant_joined" and event.room and event.participant:
        session = await _get_session(db, event.room.name)
        if session:
            identity = event.participant.identity  # "user-{uuid}"
            if not identity.startswith("user-"):
                return {"status": "ignored"}

            user_id_str = identity[len("user-"):]

            # Determine if this participant is the teacher or student
            booking_result = await db.execute(
                select(Booking).where(Booking.id == session.booking_id)
            )
            booking = booking_result.scalar_one_or_none()
            if booking:
                from uuid import UUID as _UUID
                try:
                    user_id = _UUID(user_id_str)
                except ValueError:
                    return {"status": "ignored"}

                if user_id == booking.teacher_id and not session.teacher_joined_at:
                    session.teacher_joined_at = now
                elif user_id == booking.student_id and not session.student_joined_at:
                    session.student_joined_at = now
                await db.flush()

    # ── participant_left ──────────────────────────────────────────────────────
    elif event.event == "participant_left" and event.room and event.participant:
        session = await _get_session(db, event.room.name)
        if session and session.status == SessionStatus.IN_PROGRESS:
            # If a party leaves and the room is still open, we leave status as
            # IN_PROGRESS — room_finished will fire when the room closes.
            # No-show detection (neither party ever joined) is handled by the
            # Celery beat task in notification_tasks.py.
            pass

    return {"status": "ok"}