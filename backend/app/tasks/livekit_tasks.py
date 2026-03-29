"""LiveKit room management and cleanup tasks for Celery."""
import logging
import asyncio
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from livekit import api

from app.core.config import settings
from app.db.session import AsyncSessionLocal
from app.models.booking import Session
from app.core.enums import SessionStatus
from app.utils.livekit import end_room, get_livekit_api
from app.workers.celery_app import celery_app

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
    
    This task is scheduled when a session is created and ensures that:
    1. The room is deleted after the allowed time window expires
    2. The session is marked as COMPLETED (as a safety net)
    3. A "room_finished" event is emitted regardless of participant presence
    
    Args:
        session_id: UUID of the session whose room should be cleaned up
    
    Called from: app/api/v1/endpoints/bookings.py (student acceptance endpoint)
    
    Triggered after: session_duration_minutes + calculated leniency buffer
    """
    try:
        # Run async cleanup logic
        asyncio.run(_async_cleanup_expired_livekit_room(session_id))
        
        logger.info(
            f"✅ LiveKit room cleanup completed for session {session_id}",
            extra={
                "session_id": session_id,
                "task": "cleanup_expired_livekit_room",
            }
        )
        
        return {
            "status": "success",
            "session_id": session_id,
            "message": "LiveKit room deleted after session expiration",
        }
    except Exception as exc:
        logger.error(
            f"❌ Error cleaning up LiveKit room for session {session_id}: {exc}",
            exc_info=True,
            extra={
                "session_id": session_id,
                "task": "cleanup_expired_livekit_room",
                "retry_count": self.request.retries,
            }
        )
        # Retry up to 3 times with exponential backoff
        raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))


async def _async_cleanup_expired_livekit_room(session_id: str) -> None:
    """
    Async helper to clean up an expired LiveKit room.
    
    Flow:
    1. Fetch the session from database
    2. If session is still IN_PROGRESS, mark it COMPLETED
    3. Delete the room via end_room()
    4. Let the room_finished webhook handle common completion logic
    
    This task is responsible for:
    - Setting the session status (COMPLETED for normal expiration)
    - Deleting the LiveKit room
    
    The webhook is responsible for:
    - Creating transactions
    - Emitting Socket.IO events
    - Scheduling post-session tasks
    
    Idempotent: Safe to call even if room is already deleted or session is completed.
    """
    async with AsyncSessionLocal() as db:
        try:
            # Fetch the session
            result = await db.execute(
                select(Session).where(Session.id == UUID(session_id))
            )
            session = result.scalar_one_or_none()
            
            if not session:
                logger.warning(
                    f"Session {session_id} not found during cleanup",
                    extra={"session_id": session_id}
                )
                return
            
            # If room doesn't exist, nothing to clean
            if not session.livekit_room_name:
                logger.info(
                    f"Session {session_id} has no LiveKit room",
                    extra={"session_id": session_id}
                )
                return
            
            # If session is already completed or cancelled, room should already be deleted
            if session.status != SessionStatus.IN_PROGRESS:
                logger.info(
                    f"Session {session_id} not IN_PROGRESS, skipping cleanup",
                    extra={"session_id": session_id, "status": session.status.value}
                )
                return
            
            # Mark session as COMPLETED before deleting room
            # When room_finished webhook fires, it will find COMPLETED status and skip creating duplicate transaction
            now = datetime.now(tz=timezone.utc)
            session.status = SessionStatus.COMPLETED
            session.actual_end_at = now
            await db.flush()
            
            # Delete the room from LiveKit
            # This will trigger a room_finished webhook that handles common completion logic
            # end_room is idempotent - handles errors internally and won't raise
            logger.info(
                f"Deleting LiveKit room {session.livekit_room_name} for session {session_id}",
                extra={
                    "session_id": session_id,
                    "room_name": session.livekit_room_name,
                }
            )
            await end_room(session.livekit_room_name)
            logger.info(
                f"✅ LiveKit room {session.livekit_room_name} deleted, webhook will handle common logic",
                extra={
                    "session_id": session_id,
                    "room_name": session.livekit_room_name,
                }
            )
            
            await db.commit()
            
        except Exception as exc:
            await db.rollback()
            logger.error(
                f"Error cleaning up room for session {session_id}: {exc}",
                exc_info=True,
                extra={"session_id": session_id}
            )
            raise


@celery_app.task(bind=True, max_retries=3)
def monitor_orphaned_rooms(self):
    """
    Periodically check for rooms that have been empty for > 2 hours.
    If found, alerts that Celery cleanup task likely failed.
    
    This task runs every hour and helps identify orphaned rooms that should
    have been cleaned up by the scheduled cleanup task but weren't.
    """
    try:
        asyncio.run(_async_monitor_orphaned_rooms())
        
        logger.info(
            "✅ Orphaned rooms check completed",
            extra={"task": "monitor_orphaned_rooms"}
        )
        
        return {"status": "success", "message": "Orphaned rooms check completed"}
        
    except Exception as exc:
        logger.error(
            f"❌ Error monitoring orphaned rooms: {exc}",
            exc_info=True,
            extra={
                "task": "monitor_orphaned_rooms",
                "retry_count": self.request.retries,
            }
        )
        raise self.retry(exc=exc, countdown=300)


async def _async_monitor_orphaned_rooms() -> None:
    """
    Async helper to monitor orphaned rooms.
    
    Checks for rooms that:
    1. Have no participants (empty)
    2. Have been empty for > 2 hours
    3. Are still in LiveKit (should have been deleted by cleanup task)
    """
    try:
        livekit_api = get_livekit_api()
        rooms = await livekit_api.room.list_rooms(api.ListRoomsRequest())
        
        now = datetime.now(tz=timezone.utc)
        orphaned_rooms = []
        
        for room in rooms.rooms:
            # Parse session_id from room name (format: session-{session_id})
            if not room.name.startswith("session-"):
                continue
            
            # Only check empty rooms
            if room.num_participants > 0:
                continue
            
            # Calculate how long room has been empty
            creation_time = datetime.fromtimestamp(
                room.creation_time / 1000,  # LiveKit uses milliseconds
                tz=timezone.utc
            )
            age_seconds = (now - creation_time).total_seconds()
            age_hours = age_seconds / 3600
            
            # Alert if room has been empty for > 2 hours
            if age_hours > 2:
                orphaned_rooms.append({
                    "room_name": room.name,
                    "age_hours": round(age_hours, 2),
                    "creation_time": creation_time.isoformat(),
                })
                
                logger.warning(
                    f"Orphaned room detected: {room.name} (empty for {age_hours:.1f} hours). "
                    f"Celery cleanup task likely failed.",
                    extra={
                        "room_name": room.name,
                        "age_hours": age_hours,
                        "creation_time": creation_time.isoformat(),
                    }
                )
        
        if orphaned_rooms:
            logger.info(
                f"Found {len(orphaned_rooms)} orphaned rooms",
                extra={"orphaned_rooms": orphaned_rooms}
            )
        else:
            logger.debug("No orphaned rooms detected")
            
    except Exception as exc:
        logger.error(
            f"Error checking for orphaned rooms: {exc}",
            exc_info=True
        )
        raise
