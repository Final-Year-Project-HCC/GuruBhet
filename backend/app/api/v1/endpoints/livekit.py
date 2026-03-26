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

router = APIRouter()

_receiver = WebhookReceiver(
    TokenVerifier(
        api_key=settings.LIVEKIT_API_KEY,
        api_secret=settings.LIVEKIT_API_SECRET,
    )
)


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
        if session and session.status == SessionStatus.SCHEDULED:
            session.status = SessionStatus.IN_PROGRESS
            session.actual_start_at = now
            await db.flush()

    # ── room_finished ─────────────────────────────────────────────────────────
    elif event.event == "room_finished" and event.room:
        session, booking = await _get_session_and_booking(db, event.room.name)
        if session and booking and session.status == SessionStatus.IN_PROGRESS:
            session.status = SessionStatus.COMPLETED
            session.actual_end_at = now
            await db.flush()

            booking.completed_sessions += 1
            if booking.completed_sessions >= booking.total_sessions:
                booking.status = BookingStatus.COMPLETED
            await db.flush()

            from app.repositories.teacher_subject_repo import TeacherSubjectRepository
            ts_repo = TeacherSubjectRepository(db)
            await ts_repo.increment_completed_sessions(
                teacher_id=booking.teacher_id,
                subject_id=booking.subject_id,
            )

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