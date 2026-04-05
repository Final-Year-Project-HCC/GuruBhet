import logging
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Header, Request
from livekit.api import WebhookReceiver, TokenVerifier
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from app.core.config import settings
from app.core.dependencies import DbSession
from app.core.enums import SessionStatus, BookingStatus
from app.core.exceptions import InvalidTokenError
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
      participant_joined → record teacher_joined_at / student_joined_at
    """
    body = await request.body()

    try:
        event = _receiver.receive(body.decode(), authorization)
    except Exception:
        raise InvalidTokenError(detail="Invalid LiveKit webhook signature")

    now = datetime.now(tz=timezone.utc)

    # ── room_started ──────────────────────────────────────────────────────────
    if event.event == "room_started" and event.room:
        session, _ = await _get_session_and_booking(db, event.room.name)
        # Transition from READY to IN_PROGRESS when room starts
        if session and session.status == SessionStatus.READY:
            session.status = SessionStatus.IN_PROGRESS
            session.actual_start_at = now
            await db.flush()

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

    return {"status": "ok"}