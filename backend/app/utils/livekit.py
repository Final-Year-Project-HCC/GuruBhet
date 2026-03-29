"""
LiveKit integration utilities.

Rooms are named: session-{session_id}
Participants are identified by: user-{user_id}

Grants:
  - Both teacher and student: canPublish=True, canSubscribe=True
  - Whiteboard sync via LiveKit DataChannels (no extra infrastructure needed)
  - Screen share: canPublishSources includes SCREEN_SHARE
  - File share: handled via DataChannel messages with S3 pre-signed URLs
"""
import json
from livekit import api
from app.core.config import settings
from app.db.redis import cache_set, cache_get, cache_delete


# ── Singleton LiveKit API client ──────────────────────────────────────────────
# Initialised once at app startup via init_livekit() called from main.py lifespan.
# All functions share this single instance and its underlying HTTP connection pool.
 
_livekit_api: api.LiveKitAPI | None = None

async def init_livekit() -> None:
    """Called once at app startup to initialise the LiveKit API client."""
    global _livekit_api
    _livekit_api = api.LiveKitAPI(
        settings.LIVEKIT_URL,
        settings.LIVEKIT_API_KEY,
        settings.LIVEKIT_API_SECRET,
    )
async def close_livekit() -> None:
    """Called once at app shutdown to cleanly close the HTTP client."""
    global _livekit_api
    if _livekit_api:
        await _livekit_api.aclose()
        _livekit_api = None


def get_livekit_api() -> api.LiveKitAPI:
    if _livekit_api is None:
        raise RuntimeError("LiveKit API client not initialised. Call init_livekit() first.")
    return _livekit_api


# ── Token generation ──────────────────────────────────────────────────────────
 
def generate_room_token(
    user_id: str,
    session_id: str,
    display_name: str,
    is_teacher: bool = False,
) -> str:
    """
    Generate a signed LiveKit JWT for a participant.
    Grants video, audio, screen share, and data channels.
    Token generation is synchronous and does not use the API client.
    """
    room_name = f"session-{session_id}"
 
    grants = api.VideoGrants(
        room_join=True,
        room=room_name,
        can_publish=True,
        can_subscribe=True,
        can_publish_data=True,
        can_update_own_metadata=True,
        hidden=False,
    )
 
    return (
        api.AccessToken(settings.LIVEKIT_API_KEY, settings.LIVEKIT_API_SECRET)
        .with_identity(f"user-{user_id}")
        .with_name(display_name)
        .with_grants(grants)
        .with_metadata(json.dumps({"is_teacher": is_teacher}))
        .to_jwt()
    )
 
 
# ── Room management ───────────────────────────────────────────────────────────
 
async def create_room(session_id: str, session_duration_minutes: int) -> str:
    """Create a LiveKit room for a session. Returns the room name.
    
    Lifecycle:
    1. Room is created with empty_timeout = 24 hours (fallback only)
    2. Celery cleanup task is scheduled to run at (duration + leniency) minutes
    3. Task calls end_room() which deletes the room and emits "room_finished"
    4. If Celery fails, room auto-closes after 24 hours as safety net
    
    The empty_timeout does NOT compete with the scheduled task - it only
    activates if the room becomes empty AND Celery hasn't cleaned it up yet.
    
    Args:
        session_id: UUID of the session
        session_duration_minutes: Duration of the session in minutes
    
    Returns:
        The room name (format: session-{session_id})
    """
    room_name = f"session-{session_id}"
    
    # Use 24-hour empty_timeout as fallback
    # Celery scheduled task is the primary controller of room lifecycle
    await get_livekit_api().room.create_room(
        api.CreateRoomRequest(
            name=room_name,
            empty_timeout=settings.LIVEKIT_EMPTY_TIMEOUT_SECONDS,
            max_participants=2,
        )
    )
    return room_name
 
 
async def end_room(room_name: str) -> None:
    """Delete a LiveKit room, disconnecting all participants.
    
    This is idempotent - if the room doesn't exist, it's a no-op.
    Handles cases where:
    - Room was already deleted by another process
    - Room name is invalid or empty
    - LiveKit API is unreachable (non-fatal)
    """
    if not room_name:
        return
    
    try:
        await get_livekit_api().room.delete_room(
            api.DeleteRoomRequest(room=room_name)
        )
    except Exception as exc:
        # Log but don't raise - room deletion is best-effort
        # Rooms auto-expire after empty_timeout anyway
        import logging
        logger = logging.getLogger(__name__)
        logger.warning(
            f"Failed to delete LiveKit room '{room_name}': {exc}",
            extra={"room_name": room_name},
        )


# ── Redis-backed handshake & sync ─────────────────────────────────────────────


async def set_pending_session_key(booking_id: str, ttl: int = 60) -> None:
    """
    Set a Redis key indicating a session is pending student acceptance.
    
    Used to track the 60-second handshake window.
    Key format: pending_session:{booking_id}
    TTL: 60 seconds (expires automatically if not accepted)
    """
    await cache_set(f"pending_session:{booking_id}", {"status": "pending"}, ttl=ttl)


async def get_pending_session_key(booking_id: str) -> dict | None:
    """
    Retrieve pending session info from Redis.
    
    Returns {"session_id": "..."} if exists, None if expired or not found.
    """
    return await cache_get(f"pending_session:{booking_id}")


async def clear_pending_session_key(booking_id: str) -> None:
    """Clear the pending session key after student accepts."""
    await cache_delete(f"pending_session:{booking_id}")
