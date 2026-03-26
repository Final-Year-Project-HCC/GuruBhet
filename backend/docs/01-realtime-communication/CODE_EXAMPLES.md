"""
Real-Time Communication Module - Code Examples

This file contains copy-paste ready examples for common use cases.
"""

# ============================================================================
# 1. SENDING A MESSAGE FROM BACKEND
# ============================================================================

# In your booking or session endpoints:

from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from app.services.communication import CommunicationService
from app.core.socketio import socketio_manager

async def example_send_message(
    db: AsyncSession,
    sender_id: UUID,
    receiver_id: UUID,
):
    """Send a message programmatically from backend."""
    message = await CommunicationService.save_and_send_message(
        db=db,
        sender_id=sender_id,
        receiver_id=receiver_id,
        content="Hello! This is an automated message.",
        message_type="TEXT",
        booking_id=None,  # Optional: link to booking
        session_id=None,  # Optional: link to session
        socketio_manager=socketio_manager,
    )
    await db.commit()
    return message


# ============================================================================
# 2. SENDING A SYSTEM NOTIFICATION
# ============================================================================

# Example: When booking is approved

async def example_booking_approved(
    db: AsyncSession,
    booking_id: UUID,
    student_id: UUID,
    teacher_name: str,
    teacher_id: UUID,
):
    """Send notification when booking is approved."""
    notification = await CommunicationService.send_system_notification(
        db=db,
        user_id=student_id,
        notification_type="BOOKING_APPROVED",
        title="Booking Approved! 🎉",
        message=f"Your booking with {teacher_name} has been approved.",
        booking_id=booking_id,
        sender_id=teacher_id,
        payload={
            "action": "view_booking",
            "teacher_name": teacher_name,
        },
        socketio_manager=socketio_manager,
    )
    await db.commit()
    return notification


# ============================================================================
# 3. SENDING NOTIFICATION WHEN SESSION STARTS
# ============================================================================

async def example_session_started(
    db: AsyncSession,
    session_id: UUID,
    student_id: UUID,
    teacher_id: UUID,
    room_name: str,
):
    """Notify student when teacher starts the session."""
    # Notify student
    await CommunicationService.send_system_notification(
        db=db,
        user_id=student_id,
        notification_type="SESSION_STARTED",
        title="Session Started!",
        message="Your session has started. You can now join.",
        session_id=session_id,
        sender_id=teacher_id,
        payload={
            "action": "join_session",
            "room_name": room_name,
        },
        socketio_manager=socketio_manager,
    )
    await db.commit()


# ============================================================================
# 4. GETTING MESSAGE HISTORY
# ============================================================================

from app.schemas.communication import MessageRead

async def example_get_conversation(
    db: AsyncSession,
    user_id: UUID,
    other_user_id: UUID,
    limit: int = 50,
    offset: int = 0,
) -> list[MessageRead]:
    """Get message history between two users."""
    messages = await CommunicationService.get_conversation(
        db=db,
        user_id=user_id,
        other_user_id=other_user_id,
        limit=limit,
        offset=offset,
    )
    
    # Convert to Pydantic schemas
    return [MessageRead.model_validate(msg) for msg in messages]


# ============================================================================
# 5. GETTING NOTIFICATIONS
# ============================================================================

from app.schemas.communication import NotificationRead

async def example_get_notifications(
    db: AsyncSession,
    user_id: UUID,
    unread_only: bool = False,
) -> list[NotificationRead]:
    """Get notifications for a user."""
    notifications = await CommunicationService.get_notifications(
        db=db,
        user_id=user_id,
        limit=50,
        offset=0,
        unread_only=unread_only,
    )
    
    return [NotificationRead.model_validate(n) for n in notifications]


# ============================================================================
# 6. CHECKING IF USER IS ONLINE
# ============================================================================

from app.core.socketio import socketio_manager

def example_check_user_online(user_id: UUID) -> bool:
    """Check if user is currently online."""
    return socketio_manager.is_user_online(user_id)


def example_get_user_session_count(user_id: UUID) -> int:
    """Get number of active sessions for user."""
    return socketio_manager.get_user_session_count(user_id)


# ============================================================================
# 7. MARKING MESSAGES AS READ (FROM ENDPOINT)
# ============================================================================

async def example_mark_as_read_endpoint(
    db: AsyncSession,
    message_ids: list[UUID],
    current_user_id: UUID,
):
    """Endpoint to mark messages as read."""
    for message_id in message_ids:
        message = await CommunicationService.mark_message_as_read(
            db=db,
            message_id=message_id,
        )
    
    await db.commit()


# ============================================================================
# 8. INTEGRATING WITH BOOKING ENDPOINT
# ============================================================================

# Example: Add to your existing approve_booking endpoint

async def example_approve_booking_with_notification(
    db: AsyncSession,
    booking_id: UUID,
    current_user: "User",  # Teacher
):
    """Approve booking and send notification to student."""
    
    # Your existing booking approval logic here
    from app.models.booking import Booking
    
    stmt = select(Booking).where(Booking.id == booking_id)
    result = await db.execute(stmt)
    booking = result.scalars().first()
    
    if not booking:
        raise ValueError("Booking not found")
    
    # booking.status = BookingStatus.APPROVED  # Your existing logic
    
    # NEW: Send notification to student
    await CommunicationService.send_system_notification(
        db=db,
        user_id=booking.student_id,
        notification_type="BOOKING_APPROVED",
        title="Booking Approved",
        message=f"Your booking request has been approved by {current_user.full_name}",
        booking_id=booking_id,
        sender_id=current_user.id,
        socketio_manager=socketio_manager,
    )
    
    await db.commit()
    return booking


# ============================================================================
# 9. FRONTEND: CONNECTING TO SOCKET.IO
# ============================================================================

"""
// React/Next.js example

import { useEffect, useState } from 'react';
import io, { Socket } from 'socket.io-client';

export function useSocket(token: string) {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (!token) return;

    const socketInstance = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000', {
      path: '/socket.io',
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
      query: {
        token: token,
      },
    });

    socketInstance.on('connect', () => {
      console.log('Connected to server');
    });

    socketInstance.on('connect_error', (error) => {
      console.error('Connection error:', error);
    });

    socketInstance.on('disconnect', () => {
      console.log('Disconnected from server');
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [token]);

  return socket;
}
"""


# ============================================================================
# 10. FRONTEND: SENDING MESSAGE
# ============================================================================

"""
// React example component

function ChatBox({ socket, receiverId }) {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    if (!socket) return;

    // Listen for new messages
    socket.on('new_message', (msg) => {
      setMessages(prev => [...prev, msg]);
    });

    // Listen for message sent acknowledgment
    socket.on('message_sent', (data) => {
      console.log('Message sent:', data.id);
    });

    return () => {
      socket.off('new_message');
      socket.off('message_sent');
    };
  }, [socket]);

  const sendMessage = () => {
    if (!message.trim() || !socket) return;

    socket.emit('send_message', {
      receiver_id: receiverId,
      content: message,
      message_type: 'TEXT',
    });

    setMessage('');
  };

  return (
    <div>
      <div className="messages">
        {messages.map(msg => (
          <div key={msg.id}>
            <strong>{msg.sender_id}</strong>: {msg.content}
          </div>
        ))}
      </div>
      <input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
      />
      <button onClick={sendMessage}>Send</button>
    </div>
  );
}
"""


# ============================================================================
# 11. FRONTEND: TYPING INDICATOR
# ============================================================================

"""
// React example

function ChatInput({ socket, receiverId }) {
  const [isTyping, setIsTyping] = useState(false);

  const handleTyping = (e) => {
    const value = e.target.value;
    
    // Emit typing status
    if (value.length > 0 && !isTyping) {
      setIsTyping(true);
      socket.emit('typing_status', {
        receiver_id: receiverId,
        is_typing: true,
      });
    } else if (value.length === 0 && isTyping) {
      setIsTyping(false);
      socket.emit('typing_status', {
        receiver_id: receiverId,
        is_typing: false,
      });
    }
  };

  return (
    <input
      onChange={handleTyping}
      placeholder="Type a message..."
    />
  );
}
"""


# ============================================================================
# 12. FRONTEND: MARKING AS READ
# ============================================================================

"""
// React example - mark messages as read when viewing

function ChatBox({ socket, receiverId, messages }) {
  useEffect(() => {
    const unreadIds = messages
      .filter(m => m.receiver_id === currentUserId && !m.is_read)
      .map(m => m.id);

    if (unreadIds.length > 0) {
      socket.emit('mark_as_read', {
        message_ids: unreadIds,
      });
    }
  }, [messages, socket]);

  return <div>{/* messages */}</div>;
}
"""


# ============================================================================
# 13. FRONTEND: RECEIVING NOTIFICATIONS
# ============================================================================

"""
// React example

function NotificationCenter({ socket }) {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    if (!socket) return;

    socket.on('new_notification', (notification) => {
      setNotifications(prev => [...prev, notification]);
      
      // Show toast notification
      toast.success(notification.title + ': ' + notification.message);
      
      // Auto-dismiss after 5 seconds
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== notification.id));
      }, 5000);
    });

    return () => {
      socket.off('new_notification');
    };
  }, [socket]);

  return (
    <div className="notifications">
      {notifications.map(n => (
        <div key={n.id} className="notification">
          <h4>{n.title}</h4>
          <p>{n.message}</p>
        </div>
      ))}
    </div>
  );
}
"""


# ============================================================================
# 14. FRONTEND: CLOUDINARY FILE UPLOAD
# ============================================================================

"""
// React example

import axios from 'axios';

async function uploadToCloudinary(file, token) {
  try {
    // 1. Get upload signature from backend
    const sigResponse = await axios.get('/api/v1/media/upload-signature', {
      headers: { Authorization: `Bearer ${token}` },
    });

    const { signature, timestamp, cloud_name, api_key } = sigResponse.data;

    // 2. Upload to Cloudinary using FormData
    const formData = new FormData();
    formData.append('file', file);
    formData.append('api_key', api_key);
    formData.append('timestamp', timestamp);
    formData.append('signature', signature);

    const uploadResponse = await axios.post(
      `https://api.cloudinary.com/v1_1/${cloud_name}/auto/upload`,
      formData
    );

    return uploadResponse.data;
  } catch (error) {
    console.error('Upload failed:', error);
    throw error;
  }
}

// Usage in chat
async function sendFileMessage(file, receiverId, socket) {
  const uploadedFile = await uploadToCloudinary(file, token);
  
  socket.emit('send_message', {
    receiver_id: receiverId,
    content: file.name,
    message_type: 'FILE',
    file_url: uploadedFile.secure_url,
    file_public_id: uploadedFile.public_id,
  });
}
"""


# ============================================================================
# 15. TESTING: CHECK ONLINE STATUS
# ============================================================================

"""
# Pytest example

import pytest
from app.core.socketio import socketio_manager
from uuid import uuid4

def test_user_online_status():
    user_id = uuid4()
    
    # User initially offline
    assert not socketio_manager.is_user_online(user_id)
    
    # Simulate connection
    socketio_manager.track_user_session(user_id, "session_id_1")
    assert socketio_manager.is_user_online(user_id)
    
    # Multiple sessions
    socketio_manager.track_user_session(user_id, "session_id_2")
    assert socketio_manager.get_user_session_count(user_id) == 2
    
    # Disconnect one session
    socketio_manager.untrack_user_session(user_id, "session_id_1")
    assert socketio_manager.get_user_session_count(user_id) == 1
    assert socketio_manager.is_user_online(user_id)
    
    # Disconnect last session
    socketio_manager.untrack_user_session(user_id, "session_id_2")
    assert not socketio_manager.is_user_online(user_id)
"""


# ============================================================================
# 16. DATABASE QUERIES: UNREAD MESSAGES
# ============================================================================

from sqlalchemy import select

async def get_unread_count(
    db: AsyncSession,
    user_id: UUID,
) -> int:
    """Get count of unread messages for user."""
    from app.models.communication import Message
    
    stmt = select(Message).where(
        (Message.receiver_id == user_id) &
        (Message.is_read == False)
    )
    result = await db.execute(stmt)
    messages = result.scalars().all()
    return len(messages)


# ============================================================================
# 17. BULK OPERATIONS: MARK CONVERSATION AS READ
# ============================================================================

from sqlalchemy import update

async def mark_conversation_as_read(
    db: AsyncSession,
    user_id: UUID,
    other_user_id: UUID,
):
    """Mark all messages in a conversation as read."""
    from app.models.communication import Message
    from datetime import datetime
    
    stmt = update(Message).where(
        (Message.receiver_id == user_id) &
        (Message.sender_id == other_user_id) &
        (Message.is_read == False)
    ).values(
        is_read=True,
        read_at=datetime.utcnow()
    )
    
    await db.execute(stmt)
    await db.commit()


# ============================================================================
# 18. API ENDPOINT: GET CONVERSATIONS LIST
# ============================================================================

"""
# FastAPI endpoint example

from fastapi import APIRouter, Depends
from app.core.dependencies import get_current_user, get_db
from app.models.user import User
from app.services.communication import CommunicationService
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/conversations", tags=["conversations"])

@router.get("/")
async def get_conversations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    conversations = await CommunicationService.get_conversations_list(
        db=db,
        user_id=current_user.id,
    )
    return conversations
"""


# ============================================================================
# 19. ERROR HANDLING: GRACEFUL DEGRADATION
# ============================================================================

async def safe_send_notification(
    db: AsyncSession,
    user_id: UUID,
    notification_type: str,
    title: str,
    message: str,
    logger,
):
    """Send notification with error handling."""
    try:
        await CommunicationService.send_system_notification(
            db=db,
            user_id=user_id,
            notification_type=notification_type,
            title=title,
            message=message,
            socketio_manager=socketio_manager,
        )
        await db.commit()
    except Exception as e:
        logger.error(f"Failed to send notification: {e}")
        # Notification will still be saved to DB even if Socket.IO fails
        try:
            await db.commit()
        except Exception as commit_error:
            logger.error(f"Failed to save notification to DB: {commit_error}")
            await db.rollback()


# ============================================================================
# 20. REDIS SESSION MANAGEMENT (Optional Enhancement)
# ============================================================================

"""
# For production multi-server deployment

from socketio.AsyncRedisManager import AsyncRedisManager
import socketio
from app.core.config import settings

async def create_socketio_server_with_redis():
    \"\"\"Create Socket.IO server with Redis session manager.\"\"\"
    
    redis_mgr = AsyncRedisManager(
        url=str(settings.REDIS_URL),
        channel='socket.io',
    )
    
    sio = socketio.AsyncServer(
        async_mode="asgi",
        client_manager=redis_mgr,
        cors_allowed_origins=settings.ALLOWED_ORIGINS,
        logger=True,
        engineio_logger=True,
    )
    
    return sio

# Then in main.py:
# sio = await create_socketio_server_with_redis()
"""
