# Session Request Logic Refactoring - Presence-Aware Messaging

**Date:** March 26, 2026  
**Status:** Ready for Implementation  
**Complexity:** High (affects real-time features, database, messaging, async tasks)

---

## 📋 Overview

This document describes the comprehensive refactoring of the `/request-session` endpoint to include:

1. ✅ **Presence-Aware Checks** - Student must be online before session request is sent
2. ✅ **Unified Messaging** - All outcomes (success, error, timeout) create notification messages
3. ✅ **Unified Expiration** - 60-second window managed via Redis TTL + background tasks
4. ✅ **Socket.IO Integration** - Real-time notification emission to student
5. ✅ **Database Schema Updates** - New message types for notifications

---

## 🎯 Architecture

### Request-Session Flow (Updated)

```
Teacher calls POST /request-session
    ↓
[1] BOOKING VALIDATION
    • Check booking exists
    • Check teacher owns booking
    • Check booking status is ACTIVE
    • Check sessions not all completed
    ↓ (if fails → 400/403/404)
    ↓ (if passes → continue)

[2] PRESENCE CHECK ← ⭐ NEW
    • Query Redis: user_online:{student_id}
    • Check Socket.IO manager for active connections
    ↓ (if offline → create error message, return 480)
    ↓ (if online → continue)

[3] SET REDIS KEYS
    • Key: pending_session_request:{booking_id}
    • TTL: 60 seconds (auto-expires)
    • Data: {teacher_id, student_id, status: PENDING}
    ↓

[4] CREATE MESSAGE ← ⭐ NEW
    • Type: SESSION_REQUEST
    • Content: "Teacher has requested a session..."
    • Status: unread
    • Save to database
    ↓

[5] EMIT SOCKET EVENT ← ⭐ NEW
    • Event: "session_request"
    • To: student's socket connections
    • Data: {booking_id, teacher_name, duration, etc}
    ↓

[6] SETUP EXPIRATION HANDLER ← ⭐ NEW
    • Redis TTL triggers at 60s
    • Background task handles: create timeout message
    • Log expiration event
    ↓

[7] RETURN SUCCESS
    • Status: "ready"
    • Session counts
    • Online status: "online"
    • Expiration: 60 seconds
    ↓

Student calls POST /accept (within 60s)
    ↓
[8] ACCEPT VALIDATION
    • Check Redis key still exists (not expired)
    • Check student is still online
    ↓ (if expired → 410 Gone)
    ↓ (if valid → continue)

[9] CREATE SESSION RECORD ← Moved from request-session
    • Creates Session in DB
    • status = SCHEDULED
    • Sets timestamps
    ↓

[10] CREATE ACCEPTANCE MESSAGE ← ⭐ NEW
    • Type: NOTIFICATION_ACCEPTED
    • From: student, To: teacher
    • Status: unread
    ↓

[11] EMIT ACCEPTANCE EVENT
    • Event: "session_accepted"
    • To: teacher's socket connections
    ↓

[12] CREATE LIVEKIT ROOM
    • Room name: session-{session_id}
    • Generate tokens for both
    ↓

[13] CLEAR REDIS KEYS
    • Delete pending_session_request:{booking_id}
    ↓

[14] RETURN WITH TOKEN
    • Session data
    • LiveKit token
    • Room name
```

---

## 🏗️ Implementation Components

### 1. Message Model Updates

**File:** `app/models/communication.py`

```python
class MessageType(str, Enum):
    """Type of message content."""
    TEXT = "TEXT"
    FILE = "FILE"
    SESSION_REQUEST = "SESSION_REQUEST"              # ← NEW
    NOTIFICATION_ERROR = "NOTIFICATION_ERROR"        # ← NEW
    NOTIFICATION_TIMEOUT = "NOTIFICATION_TIMEOUT"    # ← NEW
    NOTIFICATION_ACCEPTED = "NOTIFICATION_ACCEPTED"  # ← NEW
```

**Why Multiple Types?**

- `TEXT` / `FILE`: Chat messages (user-to-user)
- `SESSION_REQUEST`: Immediate notification when teacher requests
- `NOTIFICATION_ERROR`: When student is offline at request time
- `NOTIFICATION_TIMEOUT`: When 60-second window expires without accept
- `NOTIFICATION_ACCEPTED`: When student accepts the request

### 2. Presence Utilities

**File:** `app/utils/presence.py` (NEW)

**Key Functions:**

```python
async def is_user_online(user_id: UUID, use_redis: bool = True) -> bool:
    """
    Check if user is online.

    Strategies:
    1. Redis (distributed): Check user_online:{user_id} key
    2. Local Socket.IO: Check Socket.IO manager's user_sessions dict

    In production (multi-worker), use Redis.
    In testing/single-worker, use local Socket.IO.
    """

async def set_user_online(user_id: UUID, ttl: int = 3600) -> None:
    """Mark user as online in Redis."""

async def set_session_request_pending(
    booking_id: UUID,
    teacher_id: UUID,
    student_id: UUID,
    ttl: int = 60
) -> None:
    """Set pending_session_request:{booking_id} with metadata."""

async def get_session_request_pending(booking_id: UUID) -> dict | None:
    """Get pending session request metadata (if not expired)."""

async def clear_session_request_pending(booking_id: UUID) -> None:
    """Clear the pending session key (called on accept or timeout)."""
```

### 3. Session Request Task Handlers

**File:** `app/tasks/session_request_tasks.py` (NEW)

**Key Functions:**

```python
async def handle_session_request_expiration(booking_id: UUID) -> None:
    """
    Handle when 60-second window expires.

    Steps:
    1. Check if request still pending in Redis
    2. Create timeout notification message
    3. Update any booking state if needed
    4. Log event
    5. Clear Redis key
    """

async def create_session_request_message(...) -> Message:
    """Create SESSION_REQUEST message when teacher requests."""

async def create_offline_notification_message(...) -> Message:
    """Create NOTIFICATION_ERROR when student is offline."""

async def create_acceptance_notification_message(...) -> Message:
    """Create NOTIFICATION_ACCEPTED when student accepts."""
```

### 4. Celery Background Tasks

**File:** `app/tasks/celery_session_requests.py` (NEW)

**Key Tasks:**

```python
@shared_task(name="session_requests:handle_expiration")
def handle_session_request_expiration_task(booking_id: str) -> dict:
    """
    Celery task called by Redis keyspace notifications.
    Triggered when pending_session_request:{booking_id} TTL expires.
    """

@shared_task(name="session_requests:periodic_cleanup")
def periodic_session_request_cleanup() -> dict:
    """
    Safety net: Periodic cleanup every 30 seconds.
    Catches any expired requests missed by keyspace notifications.
    """

@shared_task(name="session_requests:notify_timeout")
def notify_session_request_timeout(
    booking_id: str,
    teacher_id: str,
    student_id: str
) -> dict:
    """Helper task: Create timeout notification message."""
```

### 5. Updated Endpoint

**File:** `app/api/v1/endpoints/bookings.py`

**Endpoint:** `POST /bookings/{booking_id}/request-session`

**NEW Steps Added:**

```python
# Step 2: PRESENCE CHECK
student_online = await is_user_online(booking.student_id, use_redis=True)
if not student_online:
    # Create error message
    await create_offline_notification_message(...)
    # Return 480 Subscriber Offline
    raise HTTPException(status_code=480, detail="Student is offline")

# Step 3-4: Set Redis keys + Create message
await set_session_request_pending(booking_id, teacher_id, student_id, ttl=60)
await create_session_request_message(booking_id, teacher_id, student_id, db)

# Step 5: Emit Socket event
await sio_manager.emit_to_user(
    user_id=booking.student_id,
    event="session_request",
    data={...}
)

# Step 6: Return with new fields
return {
    "status": "ready",
    "online_status": "online",
    "expiration_seconds": 60,
    ...
}
```

---

## 🔄 Unified Expiration Mechanism

### How It Works

**Redis TTL-Based Expiration:**

```
Teacher calls POST /request-session
    ↓
SET pending_session_request:{booking_id}
    VALUE: {teacher_id, student_id, status: PENDING}
    TTL: 60 seconds
    ↓
[0s] Key exists, request is active
[30s] Student hasn't accepted yet
[60s] Key automatically expires in Redis
    ↓
[Choice 1] Redis Keyspace Notifications
    • Pub/Sub channel notified
    • Celery receives: session_requests:handle_expiration
    • Handler creates timeout message

[Choice 2] Periodic Cleanup Task
    • Runs every 30 seconds
    • Scans for expired pending_session_request:* keys
    • Creates timeout messages for any found

[Result] Timeout message in database
    • Type: NOTIFICATION_TIMEOUT
    • Content: "Session request expired..."
    • Status: unread
```

### Redis Keyspace Notifications Setup

**In your Redis configuration:**

```
# Enable keyspace notifications for expiration events
CONFIG SET notify-keyspace-events Ex
```

**In your Celery configuration:**

```python
# app/core/celery_config.py

from celery.schedules import schedule

app.conf.beat_schedule = {
    'session-request-cleanup': {
        'task': 'session_requests:periodic_cleanup',
        'schedule': schedule(run_every=timedelta(seconds=30)),
    },
}

# Also configure Redis Keyspace Notifications listener
# (implementation depends on your Redis adapter)
```

### Expiration Guarantees

| Scenario                   | Guarantee                      | Mechanism                 |
| -------------------------- | ------------------------------ | ------------------------- |
| Student accepts within 60s | ✅ Accepted                    | Key cleared before expiry |
| Student doesn't accept     | ✅ Timeout message created     | Redis TTL + Celery task   |
| Network delay (>60s)       | ✅ 410 Gone on accept attempt  | Key expired, returns None |
| Redis down (rare)          | ✅ Periodic cleanup catches it | Celery task every 30s     |

---

## 🔌 Socket.IO Integration

### Emit to Student

**Event:** `session_request`

```python
await sio_manager.emit_to_user(
    user_id=booking.student_id,
    event="session_request",
    data={
        "booking_id": str(booking_id),
        "teacher_id": str(teacher_id),
        "teacher_name": "John Doe",
        "subject": "Mathematics",
        "session_number": 1,
        "total_sessions": 10,
        "duration_minutes": 60,
        "timestamp": "2026-03-26T10:45:00Z",
        "message": "John Doe has requested a session. You have 60 seconds to accept.",
    },
)
```

### Frontend Handler

```typescript
// In useSessionSync or socket listener
socket.on("session_request", (data) => {
  // Show 60-second countdown timer
  // Display accept/decline buttons
  // Auto-decline after 60s
  // Call POST /accept if user clicks accept
});
```

### Emit to Teacher (on accept)

**Event:** `session_accepted`

```python
await sio_manager.emit_to_user(
    user_id=booking.teacher_id,
    event="session_accepted",
    data={
        "booking_id": str(booking_id),
        "student_id": str(student_id),
        "student_name": "Jane Smith",
        "session_number": 1,
        "timestamp": "2026-03-26T10:46:00Z",
        "message": "Jane Smith has accepted your session request.",
    },
)
```

---

## 🚨 Status Codes

### New Status Code: 480 Subscriber Offline

**RFC Status Code:** 480 (SIP - Subscriber Offline)

```python
raise HTTPException(
    status_code=480,
    detail="Student is currently offline. Please try again when they are online."
)
```

**Frontend Handling:**

```typescript
if (response.status === 480) {
  // Show: "Student is currently offline"
  // Suggest: "Try again later or send them a message"
  // Offer: "Send a message instead?" button
}
```

### Existing Status Codes

| Code | Scenario                                   |
| ---- | ------------------------------------------ |
| 200  | Success, online, request sent              |
| 400  | Booking not ACTIVE, all sessions completed |
| 403  | Not a teacher, not your booking            |
| 404  | Booking not found                          |
| 410  | (on /accept) Window expired                |
| 480  | Student offline ← NEW                      |

---

## 📊 Database Messages Created

### Example: Student Offline

```sql
INSERT INTO messages (
    id, sender_id, receiver_id, content, message_type,
    booking_id, is_read, created_at
) VALUES (
    'msg-uuid-1',
    'teacher-uuid',
    'student-uuid',
    'Session request failed: You are currently offline. Please go online and try again.',
    'NOTIFICATION_ERROR',
    'booking-uuid',
    false,
    NOW()
);
```

### Example: Session Request

```sql
INSERT INTO messages (
    id, sender_id, receiver_id, content, message_type,
    booking_id, is_read, created_at
) VALUES (
    'msg-uuid-2',
    'teacher-uuid',
    'student-uuid',
    'Teacher has requested a session. You have 60 seconds to accept.',
    'SESSION_REQUEST',
    'booking-uuid',
    false,
    NOW()
);
```

### Example: Timeout

```sql
INSERT INTO messages (
    id, sender_id, receiver_id, content, message_type,
    booking_id, is_read, created_at
) VALUES (
    'msg-uuid-3',
    'teacher-uuid',
    'student-uuid',
    'Session request expired. Teacher did not receive your acceptance within 60 seconds.',
    'NOTIFICATION_TIMEOUT',
    'booking-uuid',
    false,
    NOW()
);
```

---

## 🔍 Distributed Environment Considerations

### Multi-Worker Deployment

**Problem:** With 5 workers, how do you check if user is online?

**Solutions:**

**Option 1: Redis-Backed Presence (Recommended)**

```python
# In Socket.IO connect handler (runs in every worker)
async def on_connect(sid, environ):
    user_id = environ.get('user_id')
    await set_user_online(user_id, ttl=3600)

# In endpoint
student_online = await is_user_online_redis(booking.student_id)
```

**Why:** Works across all workers. Single source of truth.

**Option 2: Local Socket.IO Manager**

```python
# Only checks Socket.IO manager in THIS worker
# May miss user if connected to different worker
student_online = is_user_online_local(booking.student_id)
```

**Why:** Fast, no Redis call. But unreliable in multi-worker.

**Recommendation:** Use Redis for production. Use local for testing.

### Socket.IO Message Distribution

**Single Worker:**

```python
await sio_manager.emit_to_user(
    user_id=student_id,
    event="session_request",
    data={...}
)
```

**Multiple Workers (with Redis adapter):**

Socket.IO automatically broadcasts to correct worker via Redis adapter.

```python
# Set up in main.py
mgr = socketio.AsyncRedisManager(url='redis://localhost:6379/1')
sio = socketio.AsyncServer(client_manager=mgr, ...)
```

---

## 🧪 Testing

### Unit Test: Presence Check

```python
@pytest.mark.asyncio
async def test_request_session_student_offline():
    """Teacher requests, student offline → 480"""
    # Mock is_user_online to return False
    with patch('app.utils.presence.is_user_online', return_value=False):
        response = await client.post(f"/bookings/{booking_id}/request-session")

    assert response.status_code == 480

    # Verify error message created
    messages = await db.execute(
        select(Message).where(
            (Message.booking_id == booking_id) &
            (Message.message_type == MessageType.NOTIFICATION_ERROR)
        )
    )
    assert messages.scalars().first() is not None
```

### Unit Test: Message Creation

```python
@pytest.mark.asyncio
async def test_request_session_creates_message():
    """Session request creates SESSION_REQUEST message"""
    # Mock is_user_online to return True
    with patch('app.utils.presence.is_user_online', return_value=True):
        response = await client.post(f"/bookings/{booking_id}/request-session")

    assert response.status_code == 200

    # Verify session request message created
    messages = await db.execute(
        select(Message).where(
            (Message.booking_id == booking_id) &
            (Message.message_type == MessageType.SESSION_REQUEST)
        )
    )
    msg = messages.scalars().first()
    assert msg is not None
    assert msg.is_read is False
```

### Integration Test: Expiration

```python
@pytest.mark.asyncio
async def test_session_request_expiration():
    """Session request expires after 60 seconds"""
    # Create session request
    await client.post(f"/bookings/{booking_id}/request-session")

    # Verify Redis key exists
    pending = await get_session_request_pending(booking_id)
    assert pending is not None

    # Wait 61 seconds (or mock Redis expiration)
    # Trigger expiration handler
    await handle_session_request_expiration(booking_id)

    # Verify timeout message created
    messages = await db.execute(
        select(Message).where(
            (Message.booking_id == booking_id) &
            (Message.message_type == MessageType.NOTIFICATION_TIMEOUT)
        )
    )
    assert messages.scalars().first() is not None
```

---

## 📈 Monitoring & Observability

### Metrics to Track

```python
# In prometheus/observability layer

# Counter: Session requests by outcome
session_requests_offline.inc(booking_id=booking_id)
session_requests_online.inc(booking_id=booking_id)
session_requests_timeout.inc(booking_id=booking_id)

# Timer: Time from request to acceptance
session_request_latency.observe(seconds_taken, booking_id=booking_id)

# Gauge: Active pending session requests
pending_session_requests_count.set(count)
```

### Log Events

```python
logger.info(f"Session request sent: booking={booking_id}, student_online=true")
logger.warning(f"Session request rejected: student offline, booking={booking_id}")
logger.info(f"Session request expired: booking={booking_id}")
logger.info(f"Session request accepted: booking={booking_id}, latency={latency}s")
```

---

## 🚀 Deployment Checklist

- [ ] Update Message model with new MessageType enum values
- [ ] Create Alembic migration for message type enum
- [ ] Implement `app/utils/presence.py`
- [ ] Implement `app/tasks/session_request_tasks.py`
- [ ] Implement `app/tasks/celery_session_requests.py`
- [ ] Update `app/api/v1/endpoints/bookings.py` with new request-session logic
- [ ] Update Socket.IO event handlers
- [ ] Configure Redis keyspace notifications (or use periodic cleanup)
- [ ] Update Celery beat schedule for periodic cleanup
- [ ] Update frontend to handle 480 status code
- [ ] Update frontend to listen for `session_request` Socket event
- [ ] Test with single worker (local Socket.IO)
- [ ] Test with multi-worker (Redis-backed presence)
- [ ] Load test: High concurrent session requests
- [ ] Chaos test: Redis down, keyspace notifications missed
- [ ] Monitor: Logs, metrics, error rates
- [ ] Document: API changes, Socket events, status codes

---

## 📚 Related Files

| File                                   | Changes                            |
| -------------------------------------- | ---------------------------------- |
| `app/models/communication.py`          | New MessageType values             |
| `app/utils/presence.py`                | NEW - Presence utilities           |
| `app/tasks/session_request_tasks.py`   | NEW - Message creation tasks       |
| `app/tasks/celery_session_requests.py` | NEW - Celery background tasks      |
| `app/api/v1/endpoints/bookings.py`     | Updated request-session endpoint   |
| `app/core/socketio.py`                 | (No changes) Emit already exists   |
| `app/db/redis.py`                      | (No changes) Cache functions exist |

---

## 💡 Future Enhancements

1. **Auto-Decline After Timeout** - Auto-declines if student doesn't accept in 60s
2. **Request Queuing** - Queue multiple session requests, accept them in order
3. **Scheduled Sessions** - Teacher schedules session for future time
4. **Presence-Based Notifications** - Notify teacher when student comes online
5. **Analytics** - Track acceptance rates, average latency, etc.
6. **SMS/Email Fallback** - Send SMS/email notification if Socket.IO unavailable

---

## ✅ Success Criteria

After implementation, verify:

1. ✅ Student offline → 480 response, error message created
2. ✅ Student online → Success, request message created, Socket event emitted
3. ✅ Within 60s + student accepts → Session created, tokens generated
4. ✅ After 60s + student tries → 410 Gone, no session created
5. ✅ 60s expires without accept → Timeout message created, metrics updated
6. ✅ Multi-worker → Presence checks work across all workers
7. ✅ Redis down → Periodic cleanup catches expired requests
8. ✅ Database → All message types logged correctly

---

**Created:** March 26, 2026  
**Status:** Ready for Implementation  
**Next Step:** Create Alembic migration for MessageType enum
