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
 
async def create_room(session_id: str) -> str:
    """Create a LiveKit room for a session. Returns the room name."""
    room_name = f"session-{session_id}"
    await get_livekit_api().room.create_room(
        api.CreateRoomRequest(
            name=room_name,
            empty_timeout=300,   # auto-close 5 mins after last participant leaves
            max_participants=2,  # teacher + student only
        )
    )
    return room_name
 
 
async def end_room(room_name: str) -> None:
    """Delete a LiveKit room, disconnecting all participants."""
    await get_livekit_api().room.delete_room(
        api.DeleteRoomRequest(room=room_name)
    )


# ── Redis-backed handshake & sync ─────────────────────────────────────────────


async def set_pending_session_key(booking_id: str, session_id: str, ttl: int = 60) -> None:
    """
    Set a Redis key indicating a session is pending student acceptance.
    
    Used to track the 60-second handshake window.
    Key format: pending_session:{booking_id}
    TTL: 60 seconds (expires automatically if not accepted)
    """
    await cache_set(f"pending_session:{booking_id}", {"session_id": session_id}, ttl=ttl)


async def get_pending_session_key(booking_id: str) -> dict | None:
    """
    Retrieve pending session info from Redis.
    
    Returns {"session_id": "..."} if exists, None if expired or not found.
    """
    return await cache_get(f"pending_session:{booking_id}")


async def clear_pending_session_key(booking_id: str) -> None:
    """Clear the pending session key after student accepts."""
    await cache_delete(f"pending_session:{booking_id}")


async def get_session_room_state(session_id: str) -> dict | None:
    """
    Get cached room state for a session.
    
    Used during sync operations to provide current room state.
    Key format: session_room_state:{session_id}
    """
    return await cache_get(f"session_room_state:{session_id}")


async def set_session_room_state(
    session_id: str, 
    room_name: str, 
    teacher_joined: bool = False, 
    student_joined: bool = False,
    ttl: int = 3600,
) -> None:
    """
    Cache the room state for a session.
    
    Provides quick access to room info during sync operations without DB query.
    Key format: session_room_state:{session_id}
    TTL: 1 hour (session should be complete by then)
    """
    await cache_set(
        f"session_room_state:{session_id}",
        {
            "room_name": room_name,
            "teacher_joined": teacher_joined,
            "student_joined": student_joined,
        },
        ttl=ttl,
    )
