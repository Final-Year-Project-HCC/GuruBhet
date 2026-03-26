"""Socket.IO configuration and manager."""
import logging
from typing import Optional
from uuid import UUID

import socketio
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

# Global SocketIO manager instance
_socketio_manager: Optional["SocketIOManager"] = None


def set_socketio_manager(manager: "SocketIOManager") -> None:
    """Set the global SocketIO manager instance."""
    global _socketio_manager
    _socketio_manager = manager


def get_socketio_manager() -> Optional["SocketIOManager"]:
    """Get the global SocketIO manager instance."""
    return _socketio_manager


class SocketIOManager:
    """Manager for Socket.IO connections and events."""

    def __init__(self, sio: socketio.AsyncServer):
        """Initialize the Socket.IO manager.
        
        Args:
            sio: Socket.IO AsyncServer instance
        """
        self.sio = sio
        self.user_sessions: dict[str, set[str]] = {}  # user_id -> set of session_ids

    async def emit_to_user(
        self,
        user_id: UUID,
        event: str,
        data: dict,
        skip_sid: Optional[str] = None,
    ) -> None:
        """
        Emit an event to all active sessions of a user.
        
        Args:
            user_id: Target user ID
            event: Event name
            data: Event data
            skip_sid: Optional session ID to skip (e.g., for sender)
        """
        room = f"user_{user_id}"
        
        if skip_sid:
            # Emit to all except the sender
            await self.sio.emit(event, data, room=room, skip_sid=skip_sid)
        else:
            # Emit to all sessions of the user
            await self.sio.emit(event, data, room=room)
        
        logger.debug(f"Emitted {event} to user {user_id}")

    async def emit_to_session(
        self,
        sid: str,
        event: str,
        data: dict,
    ) -> None:
        """
        Emit an event to a specific session.
        
        Args:
            sid: Socket session ID
            event: Event name
            data: Event data
        """
        await self.sio.emit(event, data, to=sid)
        logger.debug(f"Emitted {event} to session {sid}")

    async def emit_to_room(
        self,
        room: str,
        event: str,
        data: dict,
        skip_sid: Optional[str] = None,
    ) -> None:
        """
        Emit an event to all sessions in a room.
        
        Args:
            room: Room name
            event: Event name
            data: Event data
            skip_sid: Optional session ID to skip
        """
        if skip_sid:
            await self.sio.emit(event, data, room=room, skip_sid=skip_sid)
        else:
            await self.sio.emit(event, data, room=room)
        
        logger.debug(f"Emitted {event} to room {room}")

    def track_user_session(self, user_id: UUID, sid: str) -> None:
        """Track a user session."""
        user_key = str(user_id)
        if user_key not in self.user_sessions:
            self.user_sessions[user_key] = set()
        self.user_sessions[user_key].add(sid)
        logger.debug(f"Tracked session {sid} for user {user_id}")

    def untrack_user_session(self, user_id: UUID, sid: str) -> None:
        """Untrack a user session."""
        user_key = str(user_id)
        if user_key in self.user_sessions:
            self.user_sessions[user_key].discard(sid)
            if not self.user_sessions[user_key]:
                del self.user_sessions[user_key]
            logger.debug(f"Untracked session {sid} for user {user_id}")

    def is_user_online(self, user_id: UUID) -> bool:
        """Check if user is online."""
        return str(user_id) in self.user_sessions and bool(self.user_sessions[str(user_id)])

    def get_user_session_count(self, user_id: UUID) -> int:
        """Get number of active sessions for a user."""
        user_key = str(user_id)
        return len(self.user_sessions.get(user_key, set()))


def create_socketio_server() -> socketio.AsyncServer:
    """Create and configure Socket.IO server.
    
    Returns:
        Configured AsyncServer instance
    """
    # Create Socket.IO server with async mode
    sio = socketio.AsyncServer(
        async_mode="asgi",
        cors_allowed_origins="*",  # Configure based on your frontend URL in production
        logger=True,
        engineio_logger=True,
        ping_timeout=60,
        ping_interval=25,
        max_http_buffer_size=1e6,
        packet_class=socketio.packet.Packet,
    )
    
    return sio
