"""Socket.IO event handlers for real-time communication.

Architecture:
  - Authentication: JWT extracted from HttpOnly cookies in the handshake
  - Session Tracking: Users tracked with socketio_manager.user_sessions
  - Rooms: Each user joins a room named "user_{user_id}" for broadcasts
  - Database-First: All events save to DB before emitting Socket.IO events
  - Graceful Disconnect: Cleanup of user_sessions when connection closes
"""
import logging
from datetime import datetime
from uuid import UUID

import socketio
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_token
from app.core.socketio_middleware import extract_token_from_cookies, verify_jwt_from_handshake
from app.db.session import sessionmanager
from app.services.communication import CommunicationService

logger = logging.getLogger(__name__)

# Global Socket.IO manager instance
socketio_manager = None


async def get_user_from_token(token: str) -> UUID | None:
    """Extract user_id from JWT token.
    
    Args:
        token: JWT token string
    
    Returns:
        User ID if valid, None otherwise
    """
    try:
        payload = decode_token(token)
        if payload and "sub" in payload:
            return UUID(payload["sub"])
    except Exception as e:
        logger.warning(f"Failed to decode token: {e}")
    
    return None


def setup_socketio_handlers(sio: socketio.AsyncServer, manager) -> None:
    """
    Setup Socket.IO event handlers with database-first architecture.
    
    Flow:
      1. Client connects with JWT in HttpOnly cookie (via handshake)
      2. Middleware extracts and validates JWT
      3. User session is tracked in socketio_manager.user_sessions
      4. User joins private room "user_{user_id}"
      5. Any event first saves to DB, then emits Socket.IO
      6. On disconnect, cleanup user_sessions mapping
    
    Args:
        sio: Socket.IO AsyncServer instance
        manager: SocketIOManager instance for session tracking
    """
    global socketio_manager
    socketio_manager = manager

    @sio.on("connect")
    async def on_connect(sid: str, environ):
        """
        Handle client Socket.IO connection with HttpOnly cookie JWT extraction.
        
        Updated to extract JWT from HttpOnly cookies in handshake headers
        instead of query parameters (more secure).
        
        Flow:
          1. Parse handshake headers from environ
          2. Extract JWT from cookies
          3. Verify JWT signature
          4. Store user_id in Socket.IO session
          5. Track user session in socketio_manager
          6. Join user to private room
          7. Emit connection confirmation
        """
        logger.info(f"Socket.IO connect: sid={sid}")
        
        try:
            # Safely extract headers for BOTH ASGI and WSGI
            headers = {}
            
            # Extract from ASGI scope first (Uvicorn/FastAPI)
            if "asgi.scope" in environ:
                for k, v in environ["asgi.scope"].get("headers", []):
                    headers[k.decode("utf-8").lower()] = v.decode("utf-8")
            else:
                # Fallback for traditional WSGI
                for key, value in environ.items():
                    if key.startswith("HTTP_"):
                        header_name = key[5:].lower().replace("_", "-")
                        headers[header_name] = value
            
            # Step 2: Extract JWT from HttpOnly cookies
            token = extract_token_from_cookies(headers)
            
            if not token:
                logger.warning(f"Connection {sid} rejected: no JWT in cookies")
                return False
            
            # Step 3: Verify JWT and extract user_id
            user_id = await verify_jwt_from_handshake(token)
            
            if not user_id:
                logger.warning(f"Connection {sid} rejected: JWT verification failed")
                return False
            
            # Step 4: Store user_id in Socket.IO session
            session = await sio.get_session(sid)
            session["user_id"] = str(user_id)
            await sio.save_session(sid, session)
            
            # Step 5: Track user session
            socketio_manager.track_user_session(user_id, sid)
            
            # Step 6: Join private room for this user
            await sio.enter_room(sid, f"user_{user_id}")
            
            logger.info(f"User {user_id} connected with Socket.IO sid={sid}")
            
            # Step 7: Confirm connection to client
            await sio.emit("connect_response", {
                "status": "connected",
                "user_id": str(user_id),
                "sid": sid,
            }, to=sid)
            
            return True
        
        except Exception as e:
            logger.error(f"Socket.IO connect error for {sid}: {e}", exc_info=True)
            return False

    @sio.on("disconnect")
    async def on_disconnect(sid: str):
        """
        Handle client disconnection with proper cleanup.
        
        Flow:
          1. Retrieve user_id from Socket.IO session
          2. Untrack user session from socketio_manager
          3. Leave all rooms
          4. Log disconnection
        
        This ensures the user_sessions mapping stays accurate and doesn't
        accumulate stale entries for disconnected clients.
        """
        logger.info(f"Socket.IO disconnect: sid={sid}")
        
        try:
            # Retrieve user_id from Socket.IO session
            session = await sio.get_session(sid)
            user_id_str = session.get("user_id")
            
            if user_id_str:
                try:
                    user_id = UUID(user_id_str)
                    # Untrack user session to clean up mapping
                    socketio_manager.untrack_user_session(user_id, sid)
                    logger.info(f"User {user_id} disconnected and session cleaned up")
                except ValueError:
                    logger.warning(f"Invalid user_id format in session: {user_id_str}")
            else:
                logger.warning(f"No user_id found in session for sid={sid}")
        
        except Exception as e:
            logger.error(f"Error during disconnect for {sid}: {e}", exc_info=True)

    @sio.on("send_message")
    async def on_send_message(sid: str, data: dict):
        """
        Handle incoming message event.
        
        Expected data:
        {
            "receiver_id": "uuid",
            "content": "message content",
            "message_type": "TEXT" | "FILE",
            "file_url": "url" (optional),
            "booking_id": "uuid" (optional),
            "session_id": "uuid" (optional),
        }
        """
        logger.info(f"Message from {sid}: {data}")
        
        try:
            session = await sio.get_session(sid)
            sender_id_str = session.get("user_id")
            
            if not sender_id_str:
                await sio.emit("error", {"message": "Unauthorized"}, to=sid)
                return
            
            sender_id = UUID(sender_id_str)
            receiver_id = UUID(data.get("receiver_id"))
            content = data.get("content", "").strip()
            
            if not content:
                await sio.emit("error", {"message": "Content cannot be empty"}, to=sid)
                return
            
            async with sessionmanager._sessionmaker() as db:
                message = await CommunicationService.save_and_send_message(
                    db,
                    sender_id=sender_id,
                    receiver_id=receiver_id,
                    content=content,
                    message_type=data.get("message_type", "TEXT"),
                    file_url=data.get("file_url"),
                    file_key=data.get("file_key"),
                    booking_id=data.get("booking_id"),
                    session_id=data.get("session_id"),
                    socketio_manager=socketio_manager,
                )
                
                await db.commit()
                
                # Send acknowledgment to sender
                await sio.emit(
                    "message_sent",
                    {
                        "id": str(message.id),
                        "created_at": message.created_at.isoformat(),
                    },
                    to=sid,
                )
                
                logger.info(f"Message saved from {sender_id} to {receiver_id}")
        
        except Exception as e:
            logger.error(f"Error sending message: {e}", exc_info=True)
            await sio.emit("error", {"message": "Failed to send message"}, to=sid)

    @sio.on("typing_status")
    async def on_typing_status(sid: str, data: dict):
        """
        Handle typing status event.
        
        Expected data:
        {
            "receiver_id": "uuid",
            "is_typing": true | false,
        }
        """
        try:
            session = await sio.get_session(sid)
            sender_id_str = session.get("user_id")
            
            if not sender_id_str:
                return
            
            sender_id = UUID(sender_id_str)
            receiver_id = UUID(data.get("receiver_id"))
            is_typing = data.get("is_typing", False)
            
            # Emit typing status to receiver only
            await socketio_manager.emit_to_user(
                receiver_id,
                "user_typing",
                {
                    "user_id": str(sender_id),
                    "is_typing": is_typing,
                },
                skip_sid=None,  # Send to all sessions of receiver
            )
        
        except Exception as e:
            logger.error(f"Error handling typing status: {e}", exc_info=True)

    @sio.on("mark_as_read")
    async def on_mark_as_read(sid: str, data: dict):
        """
        Handle mark as read event.
        
        Expected data:
        {
            "message_id": "uuid" or
            "message_ids": ["uuid1", "uuid2"]
        }
        """
        try:
            session = await sio.get_session(sid)
            user_id_str = session.get("user_id")
            
            if not user_id_str:
                return
            
            user_id = UUID(user_id_str)
            message_ids = data.get("message_ids", [])
            
            if not message_ids and "message_id" in data:
                message_ids = [data["message_id"]]
            
            async with sessionmanager._sessionmaker() as db:
                for message_id_str in message_ids:
                    message_id = UUID(message_id_str)
                    await CommunicationService.mark_message_as_read(db, message_id)
                
                await db.commit()
                
                # Send acknowledgment
                await sio.emit(
                    "read_status_updated",
                    {
                        "message_ids": message_ids,
                        "read_at": __import__("datetime").datetime.utcnow().isoformat(),
                    },
                    to=sid,
                )
                
                logger.info(f"Marked {len(message_ids)} messages as read")
        
        except Exception as e:
            logger.error(f"Error marking as read: {e}", exc_info=True)

    @sio.on("join_conversation")
    async def on_join_conversation(sid: str, data: dict):
        """
        Join a conversation room (for real-time sync when viewing chat).
        
        Expected data:
        {
            "other_user_id": "uuid"
        }
        """
        try:
            session = await sio.get_session(sid)
            user_id_str = session.get("user_id")
            
            if not user_id_str:
                return
            
            user_id = UUID(user_id_str)
            other_user_id = UUID(data.get("other_user_id"))
            
            # Create a deterministic room name
            room_name = f"conversation_{min(str(user_id), str(other_user_id))}_{max(str(user_id), str(other_user_id))}"
            
            await sio.enter_room(sid, room_name)
            logger.info(f"User {user_id} joined conversation room {room_name}")
        
        except Exception as e:
            logger.error(f"Error joining conversation: {e}", exc_info=True)

    @sio.on("leave_conversation")
    async def on_leave_conversation(sid: str, data: dict):
        """Leave a conversation room."""
        try:
            session = await sio.get_session(sid)
            user_id_str = session.get("user_id")
            
            if not user_id_str:
                return
            
            user_id = UUID(user_id_str)
            other_user_id = UUID(data.get("other_user_id"))
            
            # Create the same deterministic room name
            room_name = f"conversation_{min(str(user_id), str(other_user_id))}_{max(str(user_id), str(other_user_id))}"
            
            await sio.leave_room(sid, room_name)
            logger.info(f"User {user_id} left conversation room {room_name}")
        
        except Exception as e:
            logger.error(f"Error leaving conversation: {e}", exc_info=True)
