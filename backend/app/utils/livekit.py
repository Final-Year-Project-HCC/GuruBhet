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
from livekit import api
from app.core.config import settings


def generate_room_token(
    user_id: str,
    session_id: str,
    display_name: str,
    is_teacher: bool = False,
) -> str:
    room_name = f"session-{session_id}"

    grants = api.VideoGrants(
        room_join=True,
        room=room_name,
        can_publish=True,
        can_subscribe=True,
        can_publish_data=True,
        hidden=False,
    )

    token = (
        api.AccessToken(settings.LIVEKIT_API_KEY, settings.LIVEKIT_API_SECRET)
        .with_identity(f"user-{user_id}")
        .with_name(display_name)
        .with_grants(grants)
        .to_jwt()
    )
    return token


async def create_room(session_id: str) -> str:
    """Create a LiveKit room for a session. Returns room name."""
    room_name = f"session-{session_id}"
    lkapi = api.LiveKitAPI(settings.LIVEKIT_URL, settings.LIVEKIT_API_KEY, settings.LIVEKIT_API_SECRET)
    await lkapi.room.create_room(
        api.CreateRoomRequest(
            name=room_name,
            empty_timeout=300,   # auto-close after 5 mins empty
            max_participants=2,  # teacher + student only
            record_on_join=True, # auto-record for moderation
        )
    )
    await lkapi.aclose()
    return room_name


async def end_room(room_name: str) -> None:
    lkapi = api.LiveKitAPI(settings.LIVEKIT_URL, settings.LIVEKIT_API_KEY, settings.LIVEKIT_API_SECRET)
    await lkapi.room.delete_room(api.DeleteRoomRequest(room=room_name))
    await lkapi.aclose()