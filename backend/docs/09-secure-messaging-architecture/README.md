# Secure Real-Time Messaging & Notification Architecture

## Overview

This document describes the **Database-First, HTTP-to-Socket** secure real-time messaging architecture for GuruBhet. The system ensures:

1. **Data Persistence**: All communication is saved to PostgreSQL BEFORE any real-time emission
2. **Security**: JWT tokens stored in HttpOnly cookies, extracted during Socket.IO handshake
3. **Reliability**: Messages survive connection failures; Socket.IO events are best-effort
4. **Performance**: Real-time delivery with database as source of truth

---

## Architecture Principles

### 1. Database-First Approach

**Every communication must be persisted to PostgreSQL before any real-time event is emitted.**

```
User Action → Validate → Save to DB → Emit Socket.IO → Return Response
              ↓         ↓              ↓
              Fast      Guaranteed     Async/Optional
```

**Why?**

- Data integrity: Even if Socket.IO fails, data is safe
- Offline support: Users can fetch missed messages from DB
- Audit trail: Complete history in database
- No data loss on server restart

### 2. HTTP-to-Socket Flow

Messages and notifications follow this flow:

```
POST /api/v1/messages (HTTP)
  ↓
[FastAPI Handler]
  ├─ Validate JWT (from headers copied from HttpOnly cookies)
  ├─ Validate inputs
  ├─ Save to PostgreSQL [Database-First]
  ├─ Emit Socket.IO event [Best-Effort]
  └─ Return 201 Created

Socket.IO Server
  ↓
[Recipient's Socket.IO Connection]
  ├─ Receive "message_received" event
  ├─ Fetch full message from DB
  └─ Update UI
```

### 3. Single JWT Secret

Both HTTP and Socket.IO authentication use the **same secret key**:

- **Settings key**: `settings.SECRET_KEY`
- **Algorithm**: HS256
- **Issued by**: `create_access_token()` in `app/core/security.py`
- **Verified by**: `decode_token()` function

### 4. HttpOnly Cookie Security

**JWT Flow:**

1. Login endpoint sets: `Set-Cookie: access_token={jwt}; HttpOnly; Secure; SameSite=Strict`
2. Browser automatically sends in requests (cannot be accessed by JavaScript)
3. Middleware copies to headers: `x-access-token: {jwt}` (for FastAPI handlers)
4. Socket.IO handshake extracts from cookies directly

**Why HttpOnly?**

- XSS attacks cannot steal the token (JavaScript cannot access HttpOnly cookies)
- CSRF protection via SameSite flag
- Browser-managed, no manual token handling in client code

---

## Implementation Details

### Backend Architecture

#### 1. Socket.IO Middleware (HttpOnly Cookie Extraction)

**File**: `app/core/socketio_middleware.py`

```python
def extract_token_from_cookies(handshake_headers: dict[str, str]) -> Optional[str]:
    """Extract JWT from HttpOnly cookies in Socket.IO handshake."""
    cookie_header = handshake_headers.get("cookie", "")
    cookies = {}
    for cookie_part in cookie_header.split("; "):
        if "=" in cookie_part:
            key, value = cookie_part.split("=", 1)
            cookies[key.strip()] = value.strip()
    return cookies.get("access_token")
```

**Integration**: This is called during the Socket.IO `connect` event to extract the JWT.

#### 2. Socket.IO Connection Handler

**File**: `app/api/v1/socketio_handlers.py` → `on_connect()`

```python
@sio.on("connect")
async def on_connect(sid: str, environ):
    # 1. Parse headers from WSGI environ
    headers = {key[5:].lower().replace("_", "-"): value
               for key, value in environ.items() if key.startswith("HTTP_")}

    # 2. Extract JWT from HttpOnly cookies
    token = extract_token_from_cookies(headers)

    # 3. Verify JWT
    user_id = await verify_jwt_from_handshake(token)

    # 4. Store in Socket.IO session
    session["user_id"] = str(user_id)

    # 5. Track in socketio_manager
    socketio_manager.track_user_session(user_id, sid)

    # 6. Join private room
    await sio.enter_room(sid, f"user_{user_id}")

    # 7. Emit confirmation
    await sio.emit("connect_response", {...}, to=sid)
```

**Key Points:**

- No token passed as query parameter (visible in URLs, logged, cached)
- HttpOnly cookie automatically sent by browser
- Handshake headers parsed from WSGI environ
- User tracked in memory (key for Socket.IO lookups)

#### 3. Message Service (Database-First)

**File**: `app/services/communication.py`

```python
async def save_and_send_message(
    db: AsyncSession,
    sender_id: UUID,
    receiver_id: UUID,
    content: str,
    socketio_manager=None,
) -> Message:
    # Step 1: Validate
    if not content.strip():
        raise ValueError("Content cannot be empty")

    # Step 2-3: Create and persist to DB
    message = Message(sender_id=sender_id, receiver_id=receiver_id, content=content)
    db.add(message)
    await db.flush()  # Get message.id without committing

    # Step 4: Emit Socket.IO (best-effort)
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
                },
            )
        except Exception as e:
            logger.warning(f"Socket emission failed: {e}. Message in DB: {message.id}")

    # Step 5: Caller commits
    # await db.commit()

    return message
```

**Transaction Flow:**

1. Handler creates session/transaction
2. `save_and_send_message()` saves and flushes (writes to DB but doesn't commit)
3. Socket.IO event emitted (can fail, doesn't affect DB write)
4. Handler commits transaction
5. If anything fails before commit, entire transaction rolls back

#### 4. HTTP Endpoint (Messages API)

**File**: `app/api/v1/endpoints/communication.py`

```python
@router.post("/messages", response_model=MessageResponse, status_code=201)
async def send_message(
    message_create: MessageCreate,
    current_user_id: UUID = Depends(get_current_user_id),  # From JWT in headers
    db: AsyncSession = Depends(get_async_session),
):
    """Send message via HTTP."""
    try:
        # Validate receiver exists
        receiver = await db.get(User, message_create.receiver_id)
        if not receiver:
            raise HTTPException(404, "Recipient not found")

        # Database-First: Save message
        message = await CommunicationService.save_and_send_message(
            db=db,
            sender_id=current_user_id,
            receiver_id=message_create.receiver_id,
            content=message_create.content,
            socketio_manager=socketio_manager,
        )

        # Commit transaction
        await db.commit()

        return MessageResponse.from_orm(message)

    except Exception as e:
        await db.rollback()
        raise HTTPException(500, "Failed to send message")
```

**Flow:**

1. FastAPI middleware copies HttpOnly `access_token` cookie → `x-access-token` header
2. `get_current_user_id()` dependency extracts user from header JWT
3. Message saved to database
4. Socket.IO event emitted to recipient
5. Transaction committed
6. HTTP 201 response with message ID

#### 5. Disconnect Handler (Session Cleanup)

**File**: `app/api/v1/socketio_handlers.py` → `on_disconnect()`

```python
@sio.on("disconnect")
async def on_disconnect(sid: str):
    """Clean up user session on disconnect."""
    try:
        session = await sio.get_session(sid)
        user_id_str = session.get("user_id")

        if user_id_str:
            user_id = UUID(user_id_str)
            # Remove from user_sessions mapping
            socketio_manager.untrack_user_session(user_id, sid)
            logger.info(f"User {user_id} disconnected, session cleaned")

    except Exception as e:
        logger.error(f"Disconnect error: {e}", exc_info=True)
```

**Purpose:**

- Prevents stale entries in `socketio_manager.user_sessions`
- Ensures accurate user online/offline status
- Memory efficient cleanup

---

## Data Models

### Message Model

```python
class Message(Base, TimestampMixin):
    id: Mapped[UUID]  # Primary key
    sender_id: Mapped[UUID]  # Foreign key to User
    receiver_id: Mapped[UUID]  # Foreign key to User
    content: Mapped[str]  # Message text
    message_type: Mapped[MessageType]  # TEXT, FILE
    file_url: Mapped[str | None]  # Cloudinary URL
    file_public_id: Mapped[str | None]  # For deletion
    booking_id: Mapped[UUID | None]  # Context (optional)
    session_id: Mapped[UUID | None]  # Context (optional)
    is_read: Mapped[bool]  # Default False
    read_at: Mapped[datetime | None]  # When marked as read

    # Indexes for performance
    Index("ix_message_sender_receiver", sender_id, receiver_id)
    Index("ix_message_receiver_unread", receiver_id, is_read)
```

### Notification Model

```python
class Notification(Base, TimestampMixin):
    id: Mapped[UUID]
    user_id: Mapped[UUID]  # Recipient
    notification_type: Mapped[NotificationType]  # Enum
    title: Mapped[str]
    message: Mapped[str]
    booking_id: Mapped[UUID | None]  # Related booking
    session_id: Mapped[UUID | None]  # Related session
    sender_id: Mapped[UUID | None]  # Who triggered it
    payload: Mapped[dict]  # JSON for flexibility
    is_read: Mapped[bool]  # Default False
```

### Booking Model Updates

```python
class Booking(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    status: Mapped[BookingStatus]
    # Values: PENDING_APPROVAL, PENDING_PAYMENT, ACTIVE, COMPLETED, CANCELLED_*

    teacher_approved_at: Mapped[datetime | None]  # When teacher approved
    teacher_approval_notes: Mapped[str | None]  # Why approved/rejected
```

---

## Client-Side Implementation (Next.js)

### 1. Socket.IO Initialization

**File**: `Frontend/Student/src/services/socket.ts` (or similar)

```typescript
import io, { Socket } from "socket.io-client";

class SocketService {
  private socket: Socket | null = null;

  connect(apiUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Key: withCredentials: true to send HttpOnly cookies
        this.socket = io(apiUrl, {
          withCredentials: true, // Include cookies in handshake
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          reconnectionAttempts: 5,
        });

        this.socket.on("connect", () => {
          console.log("Connected to Socket.IO server");
          resolve();
        });

        this.socket.on("connect_response", (data) => {
          console.log("Server confirmed connection:", data);
        });

        this.socket.on("connect_error", (error) => {
          console.error("Connection error:", error);
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  onMessageReceived(callback: (message: Message) => void) {
    this.socket?.on("message_received", callback);
  }

  onNotification(callback: (notification: Notification) => void) {
    this.socket?.on("notification_received", callback);
  }

  disconnect() {
    this.socket?.disconnect();
  }
}

export default new SocketService();
```

**Key Points:**

- `withCredentials: true` ensures HttpOnly cookies are sent in Socket.IO handshake
- No manual token handling (cookies sent automatically)
- Reconnection logic for resilience
- Event listeners for real-time updates

### 2. Sending a Message (HTTP)

**File**: `Frontend/Student/src/services/api.ts`

```typescript
async function sendMessage(
  receiverId: string,
  content: string,
  messageType: "TEXT" | "FILE" = "TEXT",
): Promise<Message> {
  const response = await fetch("/api/v1/messages", {
    method: "POST",
    credentials: "include", // Include cookies in HTTP request
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      receiver_id: receiverId,
      content,
      message_type: messageType,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to send message: ${response.statusText}`);
  }

  return response.json();
}
```

**Flow:**

1. Frontend sends POST to `/api/v1/messages` (HTTP)
2. Cookies automatically included (HttpOnly)
3. Backend middleware extracts JWT from cookie → sets in header
4. FastAPI handler validates JWT, saves message to DB, emits Socket.IO
5. Recipient's Socket.IO connection receives `message_received` event
6. Recipient UI updates with new message

### 3. Handling Messages in Component

**File**: `Frontend/Student/src/components/ChatWindow.tsx` (example)

```typescript
useEffect(() => {
  // Connect to Socket.IO
  socketService.connect("http://localhost:8000").catch(console.error);

  // Listen for incoming messages
  socketService.onMessageReceived((message) => {
    setMessages((prev) => [...prev, message]);
    markAsRead(message.id); // Automatic read status
  });

  // Listen for notifications (booking requests, etc.)
  socketService.onNotification((notification) => {
    showNotification(notification.title, notification.message);
    if (notification.type === "BOOKING_REQUESTED") {
      // Handle booking request
      handleBookingRequest(notification);
    }
  });

  return () => {
    socketService.disconnect();
  };
}, []);

async function handleSendMessage(content: string) {
  try {
    const message = await sendMessage(recipientId, content);
    // Optimistic update (or wait for Socket.IO confirmation)
    setMessages((prev) => [...prev, message]);
  } catch (error) {
    showError("Failed to send message");
  }
}
```

---

## API Endpoints

### Messages

```
POST   /api/v1/messages
       → Create and send a message (saves to DB, emits Socket.IO)
       Request: { receiver_id, content, message_type, file_url?, booking_id?, session_id? }
       Response: 201 { id, sender_id, receiver_id, content, created_at, ... }

GET    /api/v1/messages/{user_id}?limit=50&offset=0
       → Retrieve conversation with user
       Response: 200 { messages: [...], total, limit, offset }

POST   /api/v1/messages/{message_id}/read
       → Mark message as read
       Response: 200 { message_id, read_at }
```

### Booking Requests

```
POST   /api/v1/booking-requests
       → Create booking request (status=PENDING_APPROVAL)
       Request: { teacher_id, subject_id, total_sessions, rate_per_session, ... }
       Response: 201 { id, status, total_amount, created_at }

POST   /api/v1/booking-requests/{booking_id}/approve
       → Teacher approves booking
       Response: 200 { id, status=PENDING_PAYMENT }

POST   /api/v1/booking-requests/{booking_id}/reject
       → Teacher rejects booking
       Request: { rejection_reason }
       Response: 200 { id, status=CANCELLED_BY_TEACHER }
```

---

## Socket.IO Events

### Emitted by Server (to Client)

```
connect_response
  Data: { status, user_id, sid }

message_received
  Data: { id, sender_id, content, message_type, created_at, ... }

notification_received
  Data: { id, type, title, message, booking_id?, sender_id?, ... }

typing_status
  Data: { user_id, is_typing }

user_online
  Data: { user_id }

user_offline
  Data: { user_id }
```

### Listened by Server (from Client)

```
send_message
  Data: { receiver_id, content, message_type?, file_url?, booking_id?, session_id? }
  Server Action: Save to DB → Emit to recipient → Acknowledge sender

mark_as_read
  Data: { message_ids: [...] }
  Server Action: Update DB → Acknowledge

typing_status
  Data: { receiver_id, is_typing }
  Server Action: Emit to receiver (not persisted)
```

---

## Security Checklist

- [x] **JWT Storage**: HttpOnly cookies (cannot be accessed by JavaScript)
- [x] **JWT Transport**: Sent automatically in HTTP requests and Socket.IO handshake
- [x] **XSS Mitigation**: No sensitive data in localStorage or sessionStorage
- [x] **CSRF Protection**: SameSite=Strict cookie flag
- [x] **Single Secret**: Both HTTP and Socket.IO use same `settings.SECRET_KEY`
- [x] **Handshake Validation**: JWT extracted and verified before connection established
- [x] **Data Persistence**: All messages saved to DB before Socket.IO emission
- [x] **Disconnect Cleanup**: Socket.IO sessions properly cleaned up on disconnect

---

## Testing Guide

### 1. Test Message Flow (Database-First)

```python
# Test: Message saved to DB even if Socket.IO fails

async def test_message_saved_even_if_socket_fails():
    # Mock socketio_manager to raise an error
    socketio_manager.emit_to_user = AsyncMock(side_effect=Exception("Socket error"))

    # Send message via API
    response = await client.post("/api/v1/messages", json={
        "receiver_id": str(recipient_id),
        "content": "Hello",
    }, headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 201
    message_id = response.json()["id"]

    # Verify message is in database
    message = await db.get(Message, UUID(message_id))
    assert message is not None
    assert message.content == "Hello"
    assert message.is_read is False
```

### 2. Test Socket.IO HttpOnly Cookie Extraction

```python
# Test: Socket.IO can extract JWT from HttpOnly cookies

async def test_socket_io_cookie_extraction():
    # Simulate Socket.IO handshake with HttpOnly cookie
    environ = {
        "HTTP_COOKIE": f"access_token={valid_jwt}; Path=/; HttpOnly"
    }

    # Call on_connect
    result = await on_connect(sid="test123", environ=environ)

    assert result is True  # Connection allowed

    # Verify user is tracked
    session = await sio.get_session("test123")
    assert session["user_id"] == str(expected_user_id)
```

### 3. Test Notification Flow

```python
# Test: Booking request creates notification and emits Socket.IO

async def test_booking_request_notification():
    # Create booking request
    response = await client.post("/api/v1/booking-requests", json={
        "teacher_id": str(teacher_id),
        "subject_id": str(subject_id),
        "total_sessions": 10,
        "rate_per_session": 500.00,
    }, headers={"Authorization": f"Bearer {student_token}"})

    assert response.status_code == 201
    booking_id = response.json()["id"]

    # Verify notification created in DB
    notification = await db.execute(
        select(Notification).where(
            (Notification.booking_id == UUID(booking_id)) &
            (Notification.user_id == teacher_id)
        )
    )
    assert notification.scalar_one_or_none() is not None

    # Verify Socket.IO emission was called
    mock_socketio_manager.emit_to_user.assert_called_once()
```

---

## Deployment Considerations

1. **Redis for Socket.IO Adapter** (production only)

   ```python
   from socketio import AsyncRedisManager

   sio = socketio.AsyncServer(
       async_mode="asgi",
       client_manager=AsyncRedisManager(redis_url)
   )
   ```

2. **CORS Configuration**

   ```python
   sio = socketio.AsyncServer(
       cors_allowed_origins=[
           "https://student.gurubhet.com",
           "https://teacher.gurubhet.com",
       ]
   )
   ```

3. **Logging and Monitoring**
   - Log all Socket.IO connections/disconnections
   - Monitor message emit failures
   - Alert if `user_sessions` grows unexpectedly (memory leak)

4. **Database Cleanup**
   - Archive old messages (>1 year)
   - Delete test/spam messages
   - Monitor message table size

---

## Common Issues & Solutions

### Issue: "JWT token not found in cookies"

**Cause**: `withCredentials: true` not set on client
**Fix**: Add `withCredentials: true` to Socket.IO client initialization

### Issue: "CORS error during Socket.IO handshake"

**Cause**: Frontend domain not in `cors_allowed_origins`
**Fix**: Update Socket.IO CORS config to include frontend URL

### Issue: "Users still showing as online after disconnect"

**Cause**: `untrack_user_session()` not called or failing
**Fix**: Check `on_disconnect()` error logs; ensure `user_id` in session

### Issue: "Message not received via Socket.IO but appears in DB"

**Cause**: Socket.IO emission failed (recipient not connected)
**Design**: This is correct! Message is safe in DB. Recipient sees it when they fetch conversation history.

---

## References

- **Socket.IO Documentation**: https://socket.io/docs/
- **FastAPI Security**: https://fastapi.tiangolo.com/tutorial/security/
- **OWASP XSS Prevention**: https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html
- **HttpOnly Cookies**: https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies
