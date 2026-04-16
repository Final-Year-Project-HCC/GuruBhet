import logging
from datetime import UTC, datetime
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Header, Request
from livekit.api import TokenVerifier, WebhookReceiver
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from app.core.config import settings
from app.core.dependencies import DbSession
from app.core.enums import SessionStatus
from app.core.exceptions import InvalidTokenError
from app.models.booking import Booking, Session
from app.services.session_service import handle_session_completion, _run_side_effects

logger = logging.getLogger(__name__)

router = APIRouter()


def _session_id_from_room(room_name: str) -> Optional[str]:
    if room_name and room_name.startswith("session-"):
        return room_name[len("session-"):]
    return room_name


async def _get_session_and_booking(
    db: DbSession,
    room_name: str,
    for_update: bool = False,
    skip_locked: bool = False,
) -> tuple[Optional[Session], Optional[Booking]]:
    if not _session_id_from_room(room_name):
        return None, None

    stmt = (
        select(Session)
        .options(joinedload(Session.booking))
        .where(Session.livekit_room_name == room_name)
    )

    if for_update:
        if skip_locked:
            stmt = stmt.with_for_update(skip_locked=True)
        else:
            stmt = stmt.with_for_update()

    result = await db.execute(stmt)
    session = result.unique().scalar_one_or_none()

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
    background_tasks: BackgroundTasks,
    authorization: str = Header(...),
):
    body = await request.body()

    try:
        event = _receiver.receive(body.decode(), authorization)
    except Exception:
        raise InvalidTokenError(detail="Invalid LiveKit webhook signature")

    now = datetime.now(tz=UTC)

    # ── participant_joined ────────────────────────────────────────────────────
    if event.event == "participant_joined" and event.room and event.participant:
        try:
            async with db.begin():
                # 🔒 Lock WITHOUT skip_locked → ensures no lost timestamps
                session, booking = await _get_session_and_booking(
                    db,
                    event.room.name,
                    for_update=True,
                    skip_locked=False,
                )

                if not session or not booking:
                    return {"status": "ignored"}

                if session.status != SessionStatus.IN_PROGRESS:
                    return {"status": "ignored"}

                identity = event.participant.identity

                if not identity.startswith("user-"):
                    return {"status": "ignored"}

                try:
                    user_id = UUID(identity[len("user-"):])
                except ValueError:
                    return {"status": "ignored"}

                updated = False

                if user_id == booking.teacher_id and not session.teacher_joined_at:
                    session.teacher_joined_at = now
                    updated = True

                elif user_id == booking.student_id and not session.student_joined_at:
                    session.student_joined_at = now
                    updated = True

                if updated:
                    logger.info(
                        f"Join timestamp recorded for session {session.id}, user {user_id}"
                    )

        except Exception as exc:
            logger.error(f"participant_joined webhook error: {exc}")
            return {"status": "internal_error"}

    # ── room_finished ─────────────────────────────────────────────────────────
    elif event.event == "room_finished" and event.room:
        try:
            should_run_side_effects = False
            session_id = student_id = teacher_id = None

            async with db.begin():
                # ⚡ Lock WITH skip_locked → avoids blocking / pileups
                session, booking = await _get_session_and_booking(
                    db,
                    event.room.name,
                    for_update=True,
                    skip_locked=True,
                )

                if not session:
                    logger.info(
                        f"{event.room.name}: skipped completion (locked or not found)"
                    )
                    return {"status": "skipped"}

                if not booking:
                    return {"status": "ignored"}

                # ✅ Idempotency guard (lock protected)
                if session.status != SessionStatus.IN_PROGRESS:
                    logger.info(
                        f"room_finished for session {session.id}: "
                        f"already {session.status}, skipping."
                    )
                    return {"status": "ignored"}

                logger.warning(
                    f"Safety-net completion triggered for session {session.id}"
                )

                await handle_session_completion(
                    session=session,
                    booking=booking,
                    db=db,
                    completion_status=SessionStatus.COMPLETED,
                )

                # Capture IDs before transaction ends
                session_id = str(session.id)
                student_id = str(booking.student_id)
                teacher_id = str(booking.teacher_id)

                should_run_side_effects = True

            # ✅ Run side effects strictly after commit
            if should_run_side_effects:
                background_tasks.add_task(
                    _run_side_effects,
                    session_id,
                    student_id,
                    teacher_id,
                    SessionStatus.COMPLETED,
                )

        except Exception as exc:
            logger.error(
                f"Critical failure in room_finished webhook for {event.room.name}: {exc}"
            )
            return {"status": "internal_error"}

    return {"status": "ok"}