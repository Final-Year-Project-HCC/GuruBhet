# Code Examples & Best Practices

## Backend Examples

### Example 1: Sending a Message (Complete Flow)

```python
# app/api/v1/endpoints/communication.py

@router.post("/messages", response_model=MessageResponse, status_code=201)
async def send_message(
    message_create: MessageCreate,
    current_user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_async_session),
):
    """
    Complete example: Send a message using Database-First architecture.

    1. Validate inputs
    2. Save to PostgreSQL
    3. Emit Socket.IO event
    4. Return response
    """
    try:
        # Step 1: Validate recipient exists
        result = await db.execute(
            select(User).where(User.id == message_create.receiver_id)
        )
        receiver = result.scalar_one_or_none()

        if not receiver:
            raise HTTPException(
                status_code=404,
                detail="Recipient not found"
            )

        # Step 2: Call Database-First service
        message = await CommunicationService.save_and_send_message(
            db=db,
            sender_id=current_user_id,
            receiver_id=message_create.receiver_id,
            content=message_create.content,
            message_type=message_create.message_type or "TEXT",
            file_url=message_create.file_url,
            socketio_manager=socketio_manager,  # For emission
        )

        # Step 3: Commit transaction
        await db.commit()

        logger.info(f"Message {message.id} sent")

        # Step 4: Return response
        return MessageResponse.from_orm(message)

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to send message")
```

### Example 2: Socket.IO Connection (HttpOnly Cookie Extraction)

```python
# app/api/v1/socketio_handlers.py

@sio.on("connect")
async def on_connect(sid: str, environ):
    """
    Complete example: Connect with HttpOnly cookie JWT extraction.
    """
    logger.info(f"Socket.IO connect: sid={sid}")

    try:
        # Step 1: Parse WSGI environ headers
        headers = {}
        for key, value in environ.items():
            if key.startswith("HTTP_"):
                header_name = key[5:].lower().replace("_", "-")
                headers[header_name] = value

        # Step 2: Extract JWT from HttpOnly cookies
        token = extract_token_from_cookies(headers)

        if not token:
            logger.warning(f"Rejected {sid}: no token")
            return False

        # Step 3: Verify JWT
        user_id = await verify_jwt_from_handshake(token)

        if not user_id:
            logger.warning(f"Rejected {sid}: invalid token")
            return False

        # Step 4: Store in Socket.IO session
        session = await sio.get_session(sid)
        session["user_id"] = str(user_id)
        await sio.set_session(sid, session)

        # Step 5: Track user session
        socketio_manager.track_user_session(user_id, sid)

        # Step 6: Join private room
        await sio.enter_room(sid, f"user_{user_id}")

        logger.info(f"User {user_id} connected")

        # Step 7: Confirm connection
        await sio.emit("connect_response", {
            "status": "connected",
            "user_id": str(user_id),
        }, to=sid)

        return True

    except Exception as e:
        logger.error(f"Connect error: {e}")
        return False
```

### Example 3: Booking Request with Notification

```python
# app/api/v1/endpoints/communication.py

@router.post("/booking-requests")
async def create_booking_request(
    booking_create: BookingCreate,
    current_user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_async_session),
):
    """
    Complete example: Create booking request and notify teacher.

    Demonstrates:
    - Database-First persistence
    - Notification creation and emission
    - Transaction handling
    - Error recovery
    """
    try:
        # Step 1: Validate teacher exists
        teacher = await db.get(User, booking_create.teacher_id)
        if not teacher:
            raise HTTPException(status_code=404, detail="Teacher not found")

        # Step 2: Create booking in database
        booking = Booking(
            student_id=current_user_id,
            teacher_id=booking_create.teacher_id,
            subject_id=booking_create.subject_id,
            total_sessions=booking_create.total_sessions,
            session_duration_minutes=booking_create.session_duration_minutes,
            rate_per_session=booking_create.rate_per_session,
            total_amount=booking_create.rate_per_session * booking_create.total_sessions,
            escrow_amount=booking_create.rate_per_session * booking_create.total_sessions,
            status=BookingStatus.PENDING_APPROVAL,
        )

        db.add(booking)
        await db.flush()  # Get booking.id

        # Step 3: Create notification (Database-First)
        await NotificationService.create_and_emit_notification(
            db=db,
            user_id=booking_create.teacher_id,
            notification_type="BOOKING_REQUESTED",
            title="New Booking Request",
            message=f"Booking request for {booking_create.total_sessions} sessions",
            socketio_manager=socketio_manager,
            booking_id=booking.id,
            sender_id=current_user_id,
            payload={
                "total_sessions": booking_create.total_sessions,
                "total_amount": str(booking.total_amount),
            }
        )

        # Step 4: Commit transaction
        await db.commit()

        logger.info(f"Booking {booking.id} created")

        # Step 5: Return response
        return {
            "id": str(booking.id),
            "status": booking.status.value,
            "total_amount": str(booking.total_amount),
        }

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to create booking")
```

### Example 4: Error Handling in Database-First Service

```python
# app/services/communication.py

async def save_and_send_message(
    db: AsyncSession,
    sender_id: UUID,
    receiver_id: UUID,
    content: str,
    socketio_manager=None,
) -> Message:
    """
    Example: Error handling in Database-First pattern.

    Key principle:
    - Database write is GUARANTEED
    - Socket.IO emission is best-effort
    - Errors in Socket.IO do not affect database persistence
    """
    try:
        # Validate
        if not content.strip():
            raise ValueError("Content cannot be empty")

        # Create and persist
        message = Message(
            sender_id=sender_id,
            receiver_id=receiver_id,
            content=content.strip(),
            is_read=False,
        )

        db.add(message)
        await db.flush()  # Message is now in DB, has ID

        logger.info(f"Message {message.id} persisted")

        # Attempt Socket.IO emission (best-effort)
        if socketio_manager:
            try:
                await socketio_manager.emit_to_user(
                    receiver_id,
                    "message_received",
                    {
                        "id": str(message.id),
                        "sender_id": str(sender_id),
                        "content": content,
                        "created_at": message.created_at.isoformat(),
                    }
                )
                logger.debug(f"Message {message.id} emitted to {receiver_id}")
            except Exception as e:
                # Log but don't raise - message is safe in DB
                logger.warning(
                    f"Socket.IO emission failed for {message.id}: {e}. "
                    "Message is persisted in database."
                )

        return message

    except ValueError as e:
        # Validation error - raise to caller
        logger.warning(f"Validation error: {e}")
        raise
    except Exception as e:
        # Unexpected error - raise to caller (transaction will rollback)
        logger.error(f"Unexpected error in save_and_send_message: {e}")
        raise
```

---

## Frontend Examples

### Example 1: Initialize Socket.IO in App Layout

```typescript
// src/app/layout.tsx - Next.js root layout

'use client';

import React, { useEffect } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { setupCommunicationHandlers } from '@/services/socketHandlers';
import { useNotifications } from '@/hooks/useNotifications';

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // Initialize Socket.IO connection (once per app lifetime)
    useSocket(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000', (error) => {
        console.error('Socket connection failed:', error);
        // Optional: Show user-friendly error message
    });

    // Setup event handlers for messages, notifications, etc.
    useEffect(() => {
        setupCommunicationHandlers({
            onMessage: (message) => {
                console.log('📨 New message received');
                // Handle message (already handled by useMessages hook)
            },
            onNotification: (notification) => {
                console.log('🔔 New notification');
                // Show toast or alert
                showToast({
                    title: notification.title,
                    message: notification.message,
                    type: 'info',
                });
            },
            onError: (error) => {
                console.error('Communication error:', error);
            },
        });
    }, []);

    return (
        <html lang="en">
            <body>
                {children}
            </body>
        </html>
    );
}
```

### Example 2: Send Message with HTTP (Database-First)

```typescript
// src/hooks/useMessages.ts

export function useMessages({ recipientId }: UseMessagesOptions) {
  const [messages, setMessages] = useState<Message[]>([]);

  const send = useCallback(
    async (content: string) => {
      try {
        // Call HTTP endpoint (Database-First)
        const message = await sendMessage({
          receiver_id: recipientId,
          content,
          message_type: "TEXT",
        });

        logger.info(`Message ${message.id} sent via HTTP`);

        // Add to local state (optimistic update)
        setMessages((prev) => [...prev, message]);

        return message;
      } catch (error) {
        logger.error("Failed to send message:", error);
        throw error;
      }
    },
    [recipientId],
  );

  return { send };
}

// Usage in component
function ChatWindow() {
  const { send } = useMessages({ recipientId });

  async function handleSend(content: string) {
    try {
      await send(content);
      setInput(""); // Clear input
    } catch (error) {
      showError("Failed to send message");
    }
  }
}
```

### Example 3: Listen for Real-Time Messages

```typescript
// src/hooks/useMessages.ts

export function useMessages({ recipientId }: UseMessagesOptions) {
  const [messages, setMessages] = useState<Message[]>([]);

  // Listen for incoming messages via Socket.IO
  useEffect(() => {
    const handleMessage = (message: Message) => {
      // Only add if it's for this conversation
      if (
        message.sender_id === recipientId ||
        message.receiver_id === recipientId
      ) {
        logger.info(`Message ${message.id} received via Socket.IO`);

        setMessages((prev) => {
          // Avoid duplicates
          if (prev.some((m) => m.id === message.id)) return prev;

          // Add to messages
          return [...prev, message];
        });
      }
    };

    socketService.on("message_received", handleMessage);

    return () => {
      socketService.off("message_received", handleMessage);
    };
  }, [recipientId]);

  return { messages };
}
```

### Example 4: Chat Component with Full Integration

```typescript
// src/components/ChatWindow.tsx

'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useMessages } from '@/hooks/useMessages';
import { useSocket } from '@/hooks/useSocket';
import { emitTypingStatus } from '@/services/socketHandlers';

interface ChatWindowProps {
    recipientId: string;
    recipientName: string;
}

export function ChatWindow({ recipientId, recipientName }: ChatWindowProps) {
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const socket = useSocket(process.env.NEXT_PUBLIC_API_URL);
    const { messages, loading, error, send, loadMore, hasMore } =
        useMessages({ recipientId });

    // Auto-scroll to latest message
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!input.trim()) return;

        try {
            const content = input;
            setInput('');

            // Send message (HTTP, Database-First)
            await send(content);

            // Clear typing indicator
            setIsTyping(false);
            await emitTypingStatus({
                receiver_id: recipientId,
                is_typing: false,
            });
        } catch (error) {
            logger.error('Failed to send:', error);
            showError('Failed to send message');
            setInput(input); // Restore
        }
    };

    const handleInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setInput(value);

        // Send typing indicator if status changed
        const nowTyping = value.length > 0;
        if (isTyping !== nowTyping) {
            setIsTyping(nowTyping);
            try {
                await emitTypingStatus({
                    receiver_id: recipientId,
                    is_typing: nowTyping,
                });
            } catch (error) {
                logger.warn('Failed to send typing indicator:', error);
            }
        }
    };

    return (
        <div className="flex flex-col h-full bg-white">
            {/* Header */}
            <div className="px-4 py-3 border-b">
                <h2 className="font-semibold">{recipientName}</h2>
                <p className="text-sm text-gray-500">
                    {socket.isConnected() ? '🟢 Online' : '⚫ Offline'}
                </p>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {loading && <p>Loading...</p>}
                {error && <p className="text-red-500">{error}</p>}

                {hasMore && (
                    <button
                        onClick={loadMore}
                        className="w-full py-2 text-sm text-blue-600"
                    >
                        Load earlier
                    </button>
                )}

                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={`flex ${
                            msg.sender_id === recipientId ? 'justify-start' : 'justify-end'
                        }`}
                    >
                        <div
                            className={`max-w-xs px-4 py-2 rounded ${
                                msg.sender_id === recipientId
                                    ? 'bg-gray-200'
                                    : 'bg-blue-500 text-white'
                            }`}
                        >
                            <p>{msg.content}</p>
                            <p className="text-xs opacity-70">
                                {new Date(msg.created_at).toLocaleTimeString()}
                            </p>
                        </div>
                    </div>
                ))}

                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSendMessage} className="px-4 py-3 border-t">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={input}
                        onChange={handleInput}
                        placeholder="Type a message..."
                        className="flex-1 px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                        type="submit"
                        disabled={!input.trim()}
                        className="px-4 py-2 bg-blue-600 text-white rounded disabled:bg-gray-400"
                    >
                        Send
                    </button>
                </div>
            </form>
        </div>
    );
}
```

---

## Security Best Practices

### 1. JWT Validation

```python
# ✅ CORRECT: Validate JWT before using

def validate_jwt(token: str) -> dict:
    try:
        payload = decode_token(token)  # Validates signature

        # Check expiration
        if datetime.fromtimestamp(payload['exp']) < datetime.utcnow():
            raise ValueError("Token expired")

        # Validate required fields
        if 'sub' not in payload or 'type' not in payload:
            raise ValueError("Invalid token format")

        return payload
    except Exception as e:
        logger.warning(f"JWT validation failed: {e}")
        raise


# ❌ INCORRECT: Using token without validation

def bad_example(token: str):
    # This is WRONG - no validation!
    user_id = token.split('.')[0]  # This doesn't work!
    return user_id
```

### 2. Cookie Security

```typescript
// ✅ CORRECT: Credentials included in requests

const response = await fetch("/api/v1/messages", {
  method: "POST",
  credentials: "include", // Include HttpOnly cookies
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ receiver_id, content }),
});

const socket = io(apiUrl, {
  withCredentials: true, // Include cookies in handshake
});

// ❌ INCORRECT: Not including credentials

const response = await fetch("/api/v1/messages", {
  method: "POST",
  // Missing: credentials: 'include'
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ receiver_id, content }),
});
```

### 3. Input Validation

```python
# ✅ CORRECT: Validate all inputs

async def send_message(message_create: MessageCreate, ...):
    # Validate content
    if not message_create.content or not message_create.content.strip():
        raise HTTPException(400, "Content cannot be empty")

    # Validate length
    if len(message_create.content) > 5000:
        raise HTTPException(400, "Message too long")

    # Validate receiver
    if message_create.receiver_id == current_user_id:
        raise HTTPException(400, "Cannot message yourself")


# ❌ INCORRECT: No validation

async def bad_example(data: dict, current_user_id: UUID, db: AsyncSession):
    # This is WRONG - no validation!
    message = Message(
        sender_id=current_user_id,
        receiver_id=data['receiver_id'],  # Could be any string!
        content=data['content'],  # Could be empty or malicious!
    )
    db.add(message)
    await db.commit()
```

### 4. Transaction Safety

```python
# ✅ CORRECT: Proper transaction handling

async def send_message_safe(
    db: AsyncSession,
    sender_id: UUID,
    receiver_id: UUID,
    content: str,
):
    try:
        # Create and flush (write to DB, get ID)
        message = Message(sender_id=sender_id, receiver_id=receiver_id, content=content)
        db.add(message)
        await db.flush()

        # Emit Socket.IO (can fail, won't affect DB)
        if socketio_manager:
            try:
                await socketio_manager.emit_to_user(receiver_id, "message_received", {...})
            except Exception as e:
                logger.warning(f"Socket emission failed: {e}")

        # Commit (only after everything succeeds)
        await db.commit()

        return message

    except Exception as e:
        await db.rollback()  # Rollback everything
        raise


# ❌ INCORRECT: No rollback

async def bad_example(db: AsyncSession, ...):
    message = Message(...)
    db.add(message)
    await db.commit()  # Committed, can't rollback now!

    # If this fails, message is already in DB!
    await socketio_manager.emit_to_user(...)
```

### 5. Error Handling

```python
# ✅ CORRECT: Specific error handling

@router.post("/messages")
async def send_message(...):
    try:
        # Validate
        if not content.strip():
            raise HTTPException(400, "Content cannot be empty")

        # Send
        message = await CommunicationService.save_and_send_message(...)
        await db.commit()

        return MessageResponse.from_orm(message)

    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except ValueError as e:
        # Handle validation errors
        logger.warning(f"Validation error: {e}")
        raise HTTPException(400, str(e))
    except Exception as e:
        # Handle unexpected errors
        await db.rollback()
        logger.error(f"Unexpected error: {e}")
        raise HTTPException(500, "Internal server error")


# ❌ INCORRECT: Silently catching errors

def bad_example():
    try:
        message = Message(...)
        db.add(message)
        await db.commit()
    except:
        pass  # ERROR IS HIDDEN!

    return message  # message is None!
```

---

## Performance Optimization

### 1. Database Indexes

```python
# ✅ Ensure these indexes exist

class Message(Base, TimestampMixin):
    # ...
    __table_args__ = (
        # For conversation retrieval
        Index("ix_message_sender_receiver", "sender_id", "receiver_id"),

        # For unread message queries
        Index("ix_message_receiver_unread", "receiver_id", "is_read"),

        # For date-based queries
        Index("ix_message_created", "created_at"),
    )
```

### 2. Query Optimization

```python
# ✅ CORRECT: Use pagination for large queries

async def get_conversation(
    db: AsyncSession,
    user_id_1: UUID,
    user_id_2: UUID,
    limit: int = 50,  # Don't fetch all messages!
    offset: int = 0,
):
    result = await db.execute(
        select(Message)
        .where(...)
        .order_by(Message.created_at.desc())
        .limit(limit)  # ← IMPORTANT
        .offset(offset)  # ← IMPORTANT
    )
    return result.scalars().all()


# ❌ INCORRECT: Fetching all messages

async def bad_example(db: AsyncSession, user_id_1: UUID, user_id_2: UUID):
    # This loads ALL messages into memory!
    result = await db.execute(select(Message).where(...))
    messages = result.scalars().all()  # Could be thousands!
    return messages
```

### 3. Connection Pooling

```python
# ✅ CORRECT: Use connection pooling

engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    poolclass=AsyncQueuePool,
    pool_size=10,        # ← Min connections
    max_overflow=20,     # ← Max overflow
    pool_timeout=30,     # ← Timeout
    pool_pre_ping=True,  # ← Verify connections
)
```

---

## Monitoring & Logging

### 1. Key Metrics to Monitor

```python
# Log successful operations

logger.info(f"Message {message.id} sent from {sender_id} to {receiver_id}")
logger.info(f"User {user_id} connected, sid={sid}")
logger.info(f"Notification {notif.id} emitted to user {user_id}")

# Log errors with context

logger.warning(f"Socket emission failed for message {message_id}: {error}")
logger.error(f"Database error in send_message: {error}", exc_info=True)
logger.critical(f"Connection pool exhausted: {error}")
```

### 2. Useful Metrics

```python
# Track these in production

# Message throughput
messages_per_minute = count_messages(last_minute)

# Socket connections
active_connections = len(socketio_manager.user_sessions)

# Notification delivery
notification_delivery_latency = time_emitted - time_created

# Database performance
query_execution_time = ...

# Error rates
socket_emission_failures = count_emission_errors()
database_errors = count_db_errors()
```

---

## Testing Examples

### 1. Unit Test: Message Persistence

```python
# tests/unit/test_communication.py

async def test_message_saved_to_database():
    """Test that message is saved even if Socket.IO fails."""

    # Mock socketio_manager to fail
    socketio_manager.emit_to_user = AsyncMock(side_effect=Exception("Socket error"))

    # Send message
    message = await CommunicationService.save_and_send_message(
        db=db,
        sender_id=sender_id,
        receiver_id=receiver_id,
        content="Hello",
        socketio_manager=socketio_manager,
    )

    # Verify message in DB
    saved = await db.get(Message, message.id)
    assert saved is not None
    assert saved.content == "Hello"

    # Verify Socket.IO error logged but not raised
    assert socketio_manager.emit_to_user.called
```

### 2. Integration Test: Full Message Flow

```python
# tests/integration/test_messaging_flow.py

async def test_message_http_to_socket_flow():
    """Test complete flow: HTTP → DB → Socket.IO"""

    # 1. Send message via HTTP
    response = await client.post(
        "/api/v1/messages",
        json={"receiver_id": recipient_id, "content": "Hello"},
        headers={"Authorization": f"Bearer {sender_token}"}
    )

    assert response.status_code == 201
    message_id = response.json()["id"]

    # 2. Verify in database
    message = await db.get(Message, UUID(message_id))
    assert message is not None

    # 3. Verify Socket.IO emission
    socketio_manager.emit_to_user.assert_called_once_with(
        user_id=recipient_id,
        event="message_received",
        data={...}
    )

    # 4. Recipient fetches via HTTP
    response = await client.get(
        f"/api/v1/messages/{sender_id}",
        headers={"Authorization": f"Bearer {recipient_token}"}
    )

    messages = response.json()["messages"]
    assert any(m["id"] == message_id for m in messages)
```

---

## Common Patterns

### Pattern 1: Database-First Service

```python
async def do_something_and_notify(
    db: AsyncSession,
    user_id: UUID,
    socketio_manager,
):
    """Template for Database-First pattern."""

    try:
        # Step 1: Do the thing (e.g., create booking)
        entity = MyEntity(...)
        db.add(entity)
        await db.flush()  # Get ID

        # Step 2: Create notification (persisted)
        notification = Notification(
            user_id=user_id,
            ...
        )
        db.add(notification)
        await db.flush()  # Get notification ID

        # Step 3: Emit Socket.IO (best-effort)
        if socketio_manager:
            try:
                await socketio_manager.emit_to_user(
                    user_id,
                    "notification_received",
                    {...}
                )
            except Exception as e:
                logger.warning(f"Socket emission failed: {e}")

        # Step 4: Commit (only after everything ready)
        await db.commit()

        return entity, notification

    except Exception as e:
        await db.rollback()
        raise
```

### Pattern 2: Socket Event with Database

```python
@sio.on("event_name")
async def on_event(sid: str, data: dict):
    """Template for Socket.IO event handler with DB."""

    try:
        # Step 1: Get user from session
        session = await sio.get_session(sid)
        user_id_str = session.get("user_id")

        if not user_id_str:
            await sio.emit("error", {"message": "Unauthorized"}, to=sid)
            return

        user_id = UUID(user_id_str)

        # Step 2: Validate input
        required_fields = ["field1", "field2"]
        if not all(field in data for field in required_fields):
            await sio.emit("error", {"message": "Missing fields"}, to=sid)
            return

        # Step 3: Process with database
        async with async_session_maker() as db:
            # Validate
            entity = await db.get(Entity, data["id"])
            if not entity:
                await sio.emit("error", {"message": "Not found"}, to=sid)
                return

            # Update
            entity.status = "updated"
            await db.flush()

            # Emit acknowledgment
            await sio.emit(
                "event_response",
                {"status": "success", "entity_id": str(entity.id)},
                to=sid
            )

            # Commit
            await db.commit()

    except Exception as e:
        logger.error(f"Error in event_name: {e}")
        await sio.emit("error", {"message": "Failed to process"}, to=sid)
```

---

## Final Checklist

- ✅ Using Database-First architecture (persistence before emission)
- ✅ HttpOnly cookies for JWT storage (not localStorage)
- ✅ `withCredentials: true` in Socket.IO client
- ✅ `credentials: 'include'` in fetch requests
- ✅ Proper error handling with transaction rollback
- ✅ Disconnect cleanup in socketio_handlers
- ✅ Input validation on all endpoints
- ✅ Logging at appropriate levels (info, warning, error)
- ✅ Index on frequently queried columns
- ✅ Pagination for large queries
- ✅ Tests for happy path and error cases
- ✅ Security review completed

**You're ready to deploy! 🚀**
