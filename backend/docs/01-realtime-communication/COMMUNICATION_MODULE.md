"""
Real-Time Communication & Notification Module - Integration Guide

This module provides:
- Socket.IO server for real-time bidirectional communication
- Message and notification persistence in PostgreSQL
- Cloudinary integration for file uploads
- Async event handlers for chat messages, typing status, and read receipts
"""

# ============================================================================
# 1. ENVIRONMENT SETUP
# ============================================================================
# Add these to your .env file:

"""
# Cloudinary configuration
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
CLOUDINARY_UPLOAD_PRESET=your_upload_preset  # Optional
"""


# ============================================================================
# 2. DATABASE MIGRATION
# ============================================================================
# Run Alembic to create the communication tables:

"""
cd backend
alembic upgrade head
"""

# This creates three new tables:
# - messages: Stores chat messages between users
# - notifications: Stores system notifications
# - file_metadata: Stores file upload metadata from Cloudinary


# ============================================================================
# 3. BACKEND ARCHITECTURE
# ============================================================================

# Models (app/models/communication.py):
# - Message: Sender, receiver, content, file attachment, read status
# - Notification: User, type, title, message, payload, read status
# - FileMetadata: Uploader, filename, size, storage path, thumbnail

# Schemas (app/schemas/communication.py):
# - MessageCreate: Input for creating messages
# - MessageRead: Output for reading messages with ORM compatibility
# - NotificationRead: Output for reading notifications

# Services (app/services/communication.py):
# - save_and_send_message(): Save to DB and emit Socket.IO event
# - send_system_notification(): Create notification and emit event
# - get_conversation(): Retrieve message history
# - get_notifications(): Retrieve notifications
# - mark_message_as_read(): Update read status
# - mark_notification_as_read(): Update read status

# Socket.IO Manager (app/core/socketio.py):
# - SocketIOManager: Manages Socket.IO connections and room operations
# - Tracks online users
# - Emits events to specific users via private rooms

# Socket.IO Handlers (app/api/v1/socketio_handlers.py):
# - connect: Validate JWT, track user, join private room
# - disconnect: Clean up user session
# - send_message: Handle incoming message event
# - typing_status: Broadcast typing indicator
# - mark_as_read: Update message read status
# - join_conversation: Subscribe to conversation room
# - leave_conversation: Unsubscribe from conversation room


# ============================================================================
# 4. FRONTEND INTEGRATION (React/Next.js)
# ============================================================================

# Install Socket.IO client:
"""
npm install socket.io-client
"""

# Example Socket.IO setup on frontend:
"""
import { io } from 'socket.io-client';

const socket = io(process.env.NEXT_PUBLIC_API_URL, {
  path: '/socket.io',
  transportOptions: {
    polling: {
      extraHeaders: {
        Authorization: `Bearer ${token}` // Pass JWT token
      }
    }
  },
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 5,
  query: {
    token: jwt_token  // Alternative: pass token in query
  }
});

// Listen for connection
socket.on('connect_response', (data) => {
  console.log('Connected:', data);
});

// Send message
socket.emit('send_message', {
  receiver_id: recipientId,
  content: 'Hello!',
  message_type: 'TEXT',
  booking_id: null,
  session_id: null,
});

// Receive message
socket.on('new_message', (message) => {
  console.log('New message:', message);
});

// Typing indicator
socket.emit('typing_status', {
  receiver_id: recipientId,
  is_typing: true,
});

// Listen for typing
socket.on('user_typing', (data) => {
  console.log(`User ${data.user_id} is typing: ${data.is_typing}`);
});

// Mark as read
socket.emit('mark_as_read', {
  message_ids: [messageId1, messageId2],
});

// Receive notification
socket.on('new_notification', (notification) => {
  console.log('New notification:', notification);
});

// Join conversation room (for real-time sync)
socket.emit('join_conversation', {
  other_user_id: userId,
});

// Leave conversation room
socket.emit('leave_conversation', {
  other_user_id: userId,
});
"""


# ============================================================================
# 5. BACKEND API ENDPOINTS
# ============================================================================

# Media Upload Signature:
# GET /api/v1/media/upload-signature
# Returns Cloudinary signature for client-side unsigned uploads
# Response:
# {
#   "signature": "abc123...",
#   "timestamp": 1234567890,
#   "cloud_name": "your_cloud_name",
#   "api_key": "your_api_key",
#   "upload_preset": "optional_preset"
# }


# ============================================================================
# 6. SOCKET.IO EVENTS
# ============================================================================

# CLIENT → SERVER EVENTS:

# send_message
# {
#   "receiver_id": "uuid",
#   "content": "message text",
#   "message_type": "TEXT | FILE",
#   "file_url": "cloudinary_url" (optional),
#   "file_public_id": "public_id" (optional),
#   "booking_id": "uuid" (optional),
#   "session_id": "uuid" (optional)
# }

# typing_status
# {
#   "receiver_id": "uuid",
#   "is_typing": true | false
# }

# mark_as_read
# {
#   "message_ids": ["uuid1", "uuid2"] OR
#   "message_id": "uuid"
# }

# join_conversation
# {
#   "other_user_id": "uuid"
# }

# leave_conversation
# {
#   "other_user_id": "uuid"
# }


# SERVER → CLIENT EVENTS:

# connect_response
# {
#   "status": "connected"
# }

# new_message
# {
#   "id": "uuid",
#   "sender_id": "uuid",
#   "content": "text",
#   "message_type": "TEXT | FILE",
#   "file_url": "url" (optional),
#   "booking_id": "uuid" (optional),
#   "session_id": "uuid" (optional),
#   "created_at": "2026-03-16T12:00:00"
# }

# message_sent (acknowledgment to sender)
# {
#   "id": "uuid",
#   "created_at": "2026-03-16T12:00:00"
# }

# user_typing
# {
#   "user_id": "uuid",
#   "is_typing": true | false
# }

# read_status_updated (acknowledgment to sender)
# {
#   "message_ids": ["uuid1", "uuid2"],
#   "read_at": "2026-03-16T12:00:00"
# }

# new_notification
# {
#   "id": "uuid",
#   "type": "SESSION_INITIATED | BOOKING_APPROVED | ...",
#   "title": "Title",
#   "message": "Description",
#   "booking_id": "uuid" (optional),
#   "session_id": "uuid" (optional),
#   "sender_id": "uuid" (optional),
#   "payload": { ... },
#   "created_at": "2026-03-16T12:00:00"
# }

# error
# {
#   "message": "error description"
# }


# ============================================================================
# 7. TRIGGERING NOTIFICATIONS FROM BOOKING ENDPOINTS
# ============================================================================

# In your existing booking endpoints (app/api/v1/endpoints/bookings.py),
# you can trigger notifications like this:

"""
from app.services.communication import CommunicationService
from app.core.socketio import socketio_manager

@router.post("/bookings/{booking_id}/approve")
async def approve_booking(
    booking_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # ... existing booking approval logic ...
    
    # Send notification to student
    await CommunicationService.send_system_notification(
        db=db,
        user_id=booking.student_id,
        notification_type="BOOKING_APPROVED",
        title="Booking Approved",
        message=f"Your booking with {booking.teacher.full_name} has been approved",
        booking_id=booking_id,
        sender_id=current_user.id,
        socketio_manager=socketio_manager,
    )
    
    await db.commit()
    return booking
"""


# ============================================================================
# 8. NOTIFICATION TYPES
# ============================================================================

# Available notification types (expand as needed):
# - SESSION_INITIATED: Teacher initiated a session (student needs to accept)
# - BOOKING_APPROVED: Booking was approved by teacher
# - BOOKING_REJECTED: Booking was rejected by teacher
# - PAYMENT_RECEIVED: Payment was received
# - SESSION_STARTED: Session has started
# - SESSION_ENDED: Session has ended
# - RATING_RECEIVED: Student rated the teacher
# - MESSAGE_RECEIVED: Message notification (optional, if not using Socket.IO)


# ============================================================================
# 9. CONFIGURATION NOTES
# ============================================================================

# Socket.IO CORS:
# Currently set to "*" in app/core/socketio.py
# For production, update to:
# cors_allowed_origins=["https://yourdomain.com", "https://www.yourdomain.com"]

# Socket.IO Connection:
# Clients pass JWT token via query parameter or header
# Token is validated against your existing JWT secret (app/core/security.py)

# Private Rooms:
# Each user automatically joins room: user_{user_id}
# Use emit_to_user(user_id, event, data) to send private messages

# Conversation Rooms:
# Deterministic naming: conversation_{min_uuid}_{max_uuid}
# Allows real-time sync when multiple instances of a conversation are open


# ============================================================================
# 10. DEPLOYMENT NOTES
# ============================================================================

# Development:
# Socket.IO will work out of the box with CORS set to "*"

# Production:
# 1. Update CORS origins in app/core/socketio.py
# 2. Use AsyncRedisManager for multi-server deployments (see below)
# 3. Configure Cloudinary API keys in production .env
# 4. Consider using Redis for session storage (optional enhancement)

# Multi-Server Deployment with Redis:
# Replace create_socketio_server() to use AsyncRedisManager:
"""
from socketio.AsyncRedisManager import AsyncRedisManager

async def create_socketio_server_with_redis() -> socketio.AsyncServer:
    redis_mgr = AsyncRedisManager(
        url=settings.REDIS_URL,
        channel='socket.io'
    )
    
    sio = socketio.AsyncServer(
        async_mode="asgi",
        client_manager=redis_mgr,
        # ... other settings ...
    )
    
    return sio
"""


# ============================================================================
# 11. TESTING SOCKET.IO
# ============================================================================

# Using socketio-client CLI tool:
"""
pip install socketio

socketio-client-py \
  --host localhost \
  --port 8000 \
  --path socket.io \
  --query "token=YOUR_JWT_TOKEN"

# Then in the client:
emit send_message {"receiver_id": "...", "content": "test"}
on new_message
"""

# Or use the provided test script (to be created):
# python tests/test_socketio.py


# ============================================================================
# 12. TROUBLESHOOTING
# ============================================================================

# "Import not resolved" errors:
# These are editor warnings only, not actual code issues
# Install python-socketio: pip install python-socketio

# Connection failing:
# 1. Ensure JWT token is valid
# 2. Check CORS origins in app/core/socketio.py
# 3. Verify user_id extraction from token works (app/api/v1/socketio_handlers.py)

# Messages not being received:
# 1. Check that receiver_id is valid UUID and exists in database
# 2. Ensure receiver is connected to Socket.IO
# 3. Check logs in app/core/socketio.py for debug messages

# Files not uploading:
# 1. Verify Cloudinary credentials in .env
# 2. Check file size limits (currently 10MB)
# 3. Ensure allowed_formats includes the file type


# ============================================================================
# NEXT STEPS
# ============================================================================

# 1. Add Cloudinary credentials to .env
# 2. Run Alembic migration: alembic upgrade head
# 3. Install python-socketio: pip install python-socketio
# 4. Restart backend server
# 5. Connect frontend Socket.IO client
# 6. Test message flow:
#    - Send message from frontend
#    - Verify message appears in database
#    - Verify socket event is emitted to receiver
#    - Test read status updates
# 7. Integrate with existing booking endpoints to trigger notifications
# 8. Test Cloudinary upload signature endpoint
# 9. Test file upload flow via Socket.IO


"""
