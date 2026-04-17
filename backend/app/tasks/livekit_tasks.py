"""LiveKit room management and cleanup tasks for Celery."""
import logging
import asyncio
from datetime import datetime, timezone
from uuid import UUID

from livekit import api

from app.db.session import get_db_context
from app.core.enums import SessionStatus
from app.utils.livekit import get_livekit_api, end_room
from app.services.session_service import handle_session_completion, _run_side_effects, get_session_for_completion
from app.celery import celery_app


logger = logging.getLogger(__name__)


@celery_app.task(
    name="app.tasks.livekit_tasks.cleanup_expired_livekit_room",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
)
def cleanup_expired_livekit_room(self, session_id: str):
    """
    Delete a LiveKit room after the session's duration + leniency period has expired.
    """
    try:
        asyncio.run(_async_cleanup_expired_livekit_room(session_id))
        logger.info(f"✅ LiveKit room cleanup completed for session {session_id}")
        return {"status": "success", "session_id": session_id}
    except Exception as exc:
        logger.error(f"❌ Error cleaning up LiveKit room for session {session_id}: {exc}")
        raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))


async def _async_cleanup_expired_livekit_room(session_id: str) -> None:
    """Async helper with Pessimistic Locking and Scope Safety."""

    # We use a flag to track if we actually completed the session
    processed = False
    booking_data = {}
    async with get_db_context() as db:
        # STEP 2: Lock the row
        session_obj = await get_session_for_completion(db, UUID(session_id))
        if not session_obj:
            logger.warning(f"Session {session_id} not found during cleanup")
            return
        # STEP 1: Guard check (Locked)
        if session_obj.status != SessionStatus.IN_PROGRESS:
            return
        # Capture data needed for side effects before the session/transaction closes
        booking_obj = session_obj.booking
        booking_data = {
            "student_id": str(booking_obj.student_id),
            "teacher_id": str(booking_obj.teacher_id)
        }
        await handle_session_completion(
            session=session_obj,
            booking=booking_obj,
            db=db,
            completion_status=SessionStatus.COMPLETED,
        )
        processed = True 
    # Only run side effects if we actually transitioned the status in this task
    if processed:
        await _run_side_effects(
            session_id=session_id,
            student_id=booking_data["student_id"],
            teacher_id=booking_data["teacher_id"],
            status=SessionStatus.COMPLETED,
        )


@celery_app.task(bind=True, max_retries=3)
def monitor_orphaned_rooms(self):
    """Periodically check for LiveKit rooms with no active session and delete them."""
    try:
        asyncio.run(_async_monitor_orphaned_rooms())
        return {"status": "success"}
    except Exception as exc:
        raise self.retry(exc=exc, countdown=300)


async def _async_monitor_orphaned_rooms() -> None:
    """
    Infrastructure-only cleanup. No business logic.
    Deletes LiveKit rooms that have no participants and are older than 2 hours.
    Business logic (handle_session_completion) is handled by cleanup_expired_livekit_room
    and the LiveKit webhook — not here.
    """
    try:
        rooms_resp = await get_livekit_api().room.list_rooms(api.ListRoomsRequest())

        now = datetime.now(tz=timezone.utc)

        for room in rooms_resp.rooms:
            if not room.name.startswith("session-") or room.num_participants > 0:
                continue

            creation_time = datetime.fromtimestamp(
                room.creation_time / 1000, tz=timezone.utc
            )
            age_hours = (now - creation_time).total_seconds() / 3600

            if age_hours > 2:
                logger.warning(
                    f"Deleting orphaned LiveKit room: {room.name} "
                    f"(age: {age_hours:.1f}h, no participants)"
                )
                await end_room(room.name)

    except Exception as exc:
        logger.error(f"Error in orphaned room monitor: {exc}", exc_info=True)
        raise