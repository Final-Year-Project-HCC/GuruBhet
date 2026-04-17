"""
LiveKit URL Resolution Helper
"""

from fastapi import Request
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

def get_livekit_url_for_client(request: Request) -> str:
    """
    Returns the WebSocket URL for the client to connect to LiveKit.
    """
    # Use the new variable dedicated to client-side WebSocket connections
    ws_url = getattr(settings, "LIVEKIT_WS_URL", None)
    
    if not ws_url:
        # Fallback logic if you haven't updated your settings class yet
        logger.warning("LIVEKIT_WS_URL not found, falling back to LIVEKIT_URL")
        ws_url = settings.LIVEKIT_URL

    # Ensure it uses the correct WebSocket protocol
    if ws_url.startswith("https://"):
        return ws_url.replace("https://", "wss://")
    elif ws_url.startswith("http://"):
        return ws_url.replace("http://", "ws://")
    elif not ws_url.startswith(("ws://", "wss://")):
        return f"wss://{ws_url}"

    return ws_url
