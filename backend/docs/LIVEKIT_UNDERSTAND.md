# 📹 LiveKit Integration - Complete Understanding Guide

**Last Updated:** March 26, 2026  
**Status:** ✅ Fully Implemented  
**Scope:** Complete LiveKit integration with presence-aware session requests

---

## Table of Contents

1. [Quick Start (5 min)](#quick-start)
2. [What is LiveKit?](#what-is-livekit)
3. [System Architecture](#system-architecture)
4. [Session Flow](#session-flow)
5. [Key Concepts](#key-concepts)
6. [Presence-Aware Requests](#presence-aware-requests)
7. [Session Lifecycle](#session-lifecycle)
8. [API Endpoints](#api-endpoints)
9. [Message Types](#message-types)
10. [Implementation Details](#implementation-details)
11. [Code Examples](#code-examples)
12. [Troubleshooting](#troubleshooting)

---

## Quick Start

**What:** LiveKit is a video SFU (Selective Forwarding Unit) integrated into GuruBhet for real-time video sessions between teachers and students.

**How it works:**

1. Teacher initiates a session request
2. System checks if student is online
3. Student accepts within 60 seconds
4. System creates a LiveKit room
5. Both get JWT tokens to join
6. LiveKit handles audio/video streaming
7. Teacher ends session

**Key files:** See [`03-video-sessions/`](./03-video-sessions/) folder

---

## What is LiveKit?

### Overview

LiveKit is an open-source Selective Forwarding Unit (SFU) that handles real-time video and audio communication. Unlike peer-to-peer solutions, an SFU centralizes media processing while keeping participants' connections P2P for metadata.

### Why SFU?

- **Scalable:** One participant can broadcast to many
- **Low latency:** Direct peer connections for media
- **Reliable:** No quality degradation with more participants
- **Secure:** End-to-end encryption supported

### In GuruBhet

- **Purpose:** Enable live teaching sessions
- **Scope:** 1-on-1 teacher-student sessions
- **Feature:** Recording, speaker tracking, screen share (optional)

---

## System Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         FRONTEND                            │
│              (Next.js React + LiveKit SDK)                  │
│  ┌──────────────────┐           ┌──────────────────┐       │
│  │  Teacher UI      │           │  Student UI      │       │
│  │  ┌────────────┐  │           │  ┌────────────┐  │       │
│  │  │Join Room   │  │◄──────────►│  │Join Room   │  │       │
│  │  └────────────┘  │           │  └────────────┘  │       │
│  └──────────────────┘           │  (receives invite)       │
│           ▲                      │        ▲                 │
│           │                      │        │                 │
│      REST API                    │   Socket.IO Events       │
│      JWT Tokens                  │   Real-time signals      │
└───────────┼──────────────────────┼────────────────────────┐
            │                      │                        │
            │                      ▼                        │
┌───────────┼──────────────────────────────────────────────┐│
│           ▼                                              ││
│      ┌──────────────────────────────────────┐           ││
│      │      GURUBET BACKEND (FastAPI)       │           ││
│      │  ┌──────────────────────────────┐   │           ││
│      │  │  1. Presence Check (Redis)   │   │           ││
│      │  │  2. JWT Token Generation     │   │           ││
│      │  │  3. Room Creation / Cleanup  │   │           ││
│      │  │  4. Session State Tracking   │   │           ││
│      │  │  5. Message Logging          │   │           ││
│      │  └──────────────────────────────┘   │           ││
│      └──────────────────────────────────────┘           ││
│           ▲              │                 ▲            ││
│           │              ▼                 │            ││
│      ┌────────┐      ┌─────────┐      ┌────────┐       ││
│      │ Redis  │      │   DB    │      │ Socket │       ││
│      │(state) │      │(persist)│      │.IO Bus │       ││
│      └────────┘      └─────────┘      └────────┘       ││
└─────────────────────────────────────────────────────────┘│
            │                                              │
            │              REST API                        │
            │          (LiveKit Token)                     │
            ▼                                              │
┌──────────────────────────────────────────────────────────┼─┐
│                                                          │ │
│  ┌─────────────────────────────────────────────────┐   │ │
│  │          LIVEKIT SERVER                         │   │ │
│  │  - SFU Router                                  │   │ │
│  │  - Media Processing                           │   │ │
│  │  - Recording (optional)                       │   │ │
│  │  - Webhooks back to backend                   │   │ │
│  └─────────────────────────────────────────────────┘   │ │
│                                                          │ │
└──────────────────────────────────────────────────────────┼─┘
                       ▲
                       │ WebRTC Media
                       │ (Video/Audio)
         ┌─────────────┴──────────────┐
         │                            │
    ┌────────┐                    ┌────────┐
    │Teacher │◄──────────────────►│Student │
    │Client  │   Peer Connection  │Client  │
    └────────┘                    └────────┘
```

### Component Breakdown

| Component      | Purpose                     | Technology                   |
| -------------- | --------------------------- | ---------------------------- |
| **Frontend**   | Teacher/Student UI          | Next.js, React, LiveKit SDK  |
| **Backend**    | API, State management, Auth | FastAPI, PostgreSQL, Redis   |
| **Redis**      | Session state, presence     | Redis with 60s TTL keys      |
| **PostgreSQL** | Persistent data             | Sessions, messages, bookings |
| **LiveKit**    | Video/Audio SFU             | External SaaS or self-hosted |
| **Socket.IO**  | Real-time signals           | WebSocket, message bus       |

---

## Session Flow

### Complete Session Lifecycle

```
┌──────────────────────────────────────────────────────────────┐
│ BOOKING ALREADY ACTIVE                                       │
│ (Student has paid, booking in ACTIVE status)                 │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│ STEP 1: Teacher Requests Session                             │
│ POST /bookings/{booking_id}/request-session                  │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ 1️⃣ Backend checks: Is student online?                       │
│    - Query Redis for presence                               │
│    - Check Socket.IO connections                            │
│                                                              │
│ ❌ If OFFLINE → Return 480                                   │
│    "Student is currently offline. Please try again."         │
│                                                              │
│ ✅ If ONLINE → Continue:                                     │
│    - Set Redis key: pending_session:{booking_id} (60s TTL)   │
│    - Create MESSAGE: type = SESSION_REQUEST                 │
│    - Emit Socket.IO: "session_ready" to student             │
│    - Return: {"status": "ready", "session_id": "..."}       │
│                                                              │
└──────────────────────────────────────────────────────────────┘
                            ↓
                      ⏰ 60-SECOND WINDOW
                         OPENS HERE
                            ↓
┌──────────────────────────────────────────────────────────────┐
│ STEP 2: Student Accepts Session                              │
│ POST /bookings/{booking_id}/sessions/{session_id}/accept     │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ 2️⃣ Student submits acceptance                               │
│                                                              │
│ 3️⃣ Backend validates:                                        │
│    - Check: Redis key exists (within 60s)?                  │
│    - Check: Session not already accepted                    │
│                                                              │
│ ❌ If EXPIRED → Return 410                                   │
│    "Session acceptance window expired"                      │
│                                                              │
│ ✅ If VALID → Continue:                                      │
│    - Create LiveKit room                                    │
│    - Store room_name in session                             │
│    - Update session status: READY                           │
│    - Set student_accepted_at: now                           │
│    - Create MESSAGE: type = NOTIFICATION_ACCEPTED          │
│    - Clear Redis key                                        │
│    - Emit Socket.IO: "student_accepted" to teacher         │
│    - Generate token                                         │
│    - Return: {token, room_name, livekit_url}               │
│                                                              │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│ STEP 3: Both Get LiveKit Tokens                              │
│ GET /bookings/{booking_id}/sessions/{session_id}/livekit-token
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ 4️⃣ Teacher/Student: "I want to join"                        │
│                                                              │
│ 5️⃣ Backend:                                                  │
│    - Verify session is IN_PROGRESS (webhook already set)    │
│    - Generate JWT token (signed by LiveKit private key)     │
│    - Record join timestamp (teacher_joined_at/etc)          │
│    - Return fresh token: {token, room_name, livekit_url}   │
│                                                              │
│ 6️⃣ Frontend:                                                 │
│    - Initialize LiveKit client with token                   │
│    - Connect to room_name                                   │
│    - Start audio/video streams                              │
│                                                              │
└──────────────────────────────────────────────────────────────┘
                            ↓
                    [Teaching happens for
                     ~60 minutes or agreed
                     duration]
                            ↓
┌──────────────────────────────────────────────────────────────┐
│ STEP 4: Teacher Ends Session                                 │
│ POST /sessions/{session_id}/complete                         │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ 7️⃣ Teacher clicks "End Session"                             │
│                                                              │
│ 8️⃣ Backend:                                                  │
│    - Update session status: COMPLETED                       │
│    - Set actual_end_at = now                                │
│    - Calculate duration                                     │
│    - Delete LiveKit room                                    │
│    - Cleanup Redis keys                                     │
│    - Create transaction: SESSION_RELEASE (payment)         │
│    - Emit Socket.IO: "session_completed"                   │
│                                                              │
│ 9️⃣ Both clients disconnect from LiveKit                     │
│                                                              │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│ POST-SESSION                                                 │
│ - Booking session counter incremented                        │
│ - Rating available                                           │
│ - Repeat for next session                                    │
└──────────────────────────────────────────────────────────────┘
```

---

## Key Concepts

### 1. **Session Status States**

| Status                       | When                        | What Can Happen                       | Next                 |
| ---------------------------- | --------------------------- | ------------------------------------- | -------------------- |
| `READY`                      | Student accepts session     | Ready to join, waiting for webhook    | IN_PROGRESS via webhook |
| `IN_PROGRESS`                | Webhook: room created       | Active session, recording if enabled  | COMPLETED            |
| `COMPLETED`                  | Teacher ends session        | Session finished, cleanup done        | (terminal)           |
| `CANCELLED_BY_*`             | Either party cancels        | Session was cancelled                 | (terminal)           |

### 2. **Message Types**

New message types track session events in the database:

```python
class MessageType(str, Enum):
    TEXT = "text"                      # Regular chat
    FILE = "file"                      # File sharing
    SESSION_REQUEST = "session_request"                # Teacher requested
    NOTIFICATION_ERROR = "notification_error"          # Student offline
    NOTIFICATION_TIMEOUT = "notification_timeout"      # Window expired
    NOTIFICATION_ACCEPTED = "notification_accepted"    # Student accepted
```

### 3. **Redis Keys**

Fast, ephemeral state management:

```
pending_session:{booking_id}
  → Value: {session_id}
  → TTL: 60 seconds
  → Purpose: Track "waiting for acceptance" sessions
```

### 4. **JWT Tokens**

LiveKit authentication:

```
Token = JWT {
  iss: "livekit",
  sub: "{user_id}",
  aud: "{room_name}",
  exp: now + 1 hour,
  video: {
    room: "{room_name}",
    canPublish: true,
    canPublishData: true,
    canSubscribe: true
  },
  metadata: "{user_id}|{is_teacher}|{display_name}"
}
```

Signed with LiveKit private key. Valid for 1 hour.

### 5. **HTTP Status Codes**

| Code | Meaning                 | Scenario                                   |
| ---- | ----------------------- | ------------------------------------------ |
| 200  | Success                 | Session created, accepted, token generated |
| 400  | Bad Request             | Invalid parameters, session wrong state    |
| 403  | Forbidden               | User not teacher/student of booking        |
| 404  | Not Found               | Booking/session doesn't exist              |
| 410  | Gone                    | Acceptance window expired                  |
| 480  | Temporarily Unavailable | Student is offline                         |

---

## Presence-Aware Requests

### Why Presence Checking?

Without presence checking:

- ❌ Teacher requests session while student is offline
- ❌ Session gets created but student never accepts
- ❌ Orphaned sessions pile up
- ❌ Teacher confused why nothing happens

With presence checking:

- ✅ Teacher gets immediate feedback (480 error)
- ✅ Teacher can try again later
- ✅ No orphaned sessions created

### How It Works

```python
# In request_session endpoint
is_online = await is_user_online(student_id)

if not is_online:
    # Create error message for audit trail
    await create_message(
        type=MessageType.NOTIFICATION_ERROR,
        content="Student is currently offline",
       ient_id=student_id
    ) sender_id=teacher_id,
        recip
    # Return 480 error
    raise HTTPException(
        status_code=480,
        detail="Student is currently offline. Please try again."
    )

# If online, proceed with session request...
```

### Presence Detection Strategy

**Dual-source detection:**

1. **Redis presence** (fast):
   - Socket.IO saves user presence to Redis
   - TTL: 5-10 minutes
   - Updated on connect/disconnect

2. **Live Socket.IO connections** (accurate):
   - Query current connected sockets
   - Cross-reference with user_id
   - Real-time but slower

**Implementation:**

```python
async def is_user_online(user_id: str) -> bool:
    # Check Redis first (fast)
    redis_key = f"user_presence:{user_id}"
    if await redis_client.exists(redis_key):
        return True

    # Fallback to Socket.IO (accurate)
    for socket_id, data in sio.rooms.items():
        if data.get("user_id") == user_id:
            return True

    return False
```

---

## Session Lifecycle

### Complete Lifecycle with Timestamps

```
┌─────────────────────────────────────────────────────┐
│ teacher_initiated_at: 2026-03-26 10:45:00           │
│ POST /request-session → Session PENDING_...         │
│                                                     │
│ Redis: pending_session:123 = session_uuid (60s)     │
│ Message: SESSION_REQUEST created                    │
│ Socket.IO: "session_ready" sent to student          │
└─────────────────────────────────────────────────────┘
                         ↓
            ⏰ 60-SECOND WINDOW OPEN
                         ↓
┌─────────────────────────────────────────────────────┐
│ student_accepted_at: 2026-03-26 10:46:30            │
│ POST /accept → Session SCHEDULED                    │
│                                                     │
│ LiveKit: Room created                               │
│ Message: NOTIFICATION_ACCEPTED created              │
│ Socket.IO: "student_accepted" sent to teacher       │
└─────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────┐
│ actual_start_at: NULL (not yet)                      │
│ teacher_joined_at: NULL (not yet)                    │
│ student_joined_at: NULL (not yet)                    │
│                                                     │
│ State: SCHEDULED (waiting for first join)           │
└─────────────────────────────────────────────────────┘
                         ↓
            User gets token and joins
                         ↓
┌─────────────────────────────────────────────────────┐
│ actual_start_at: 2026-03-26 10:47:45 (set now!)     │
│ teacher_joined_at: 2026-03-26 10:47:45              │
│                                                     │
│ GET /livekit-token (teacher)                        │
│ → State changes to IN_PROGRESS                      │
│ → LiveKit: teacher joins room                       │
└─────────────────────────────────────────────────────┘
                         ↓
            [Teaching for ~60 minutes]
                         ↓
┌─────────────────────────────────────────────────────┐
│ actual_end_at: 2026-03-26 11:47:45 (set now!)       │
│ duration_seconds: 3600                              │
│                                                     │
│ POST /sessions/{id}/complete                        │
│ → State changes to COMPLETED                        │
│ → LiveKit: Room deleted                             │
│ → Cleanup: Redis keys cleared                       │
└─────────────────────────────────────────────────────┘
```

### Timeout Handling

**Scenario:** Student accepts but never joins within reasonable time

**Current behavior:** Session stays in SCHEDULED forever (needs improvement)

**Recommended:** Add 5-10 minute timeout after `actual_start_at` reaches 5+ minutes without both joining

---

## API Endpoints

### 1. Request Session (Teacher)

```
POST /api/v1/bookings/{booking_id}/request-session

Headers:
  Authorization: Bearer {teacher_token}

Response 200 (Student Online):
{
  "status": "ready",
  "session_id": "session-uuid",
  "completed_sessions": 2,
  "total_sessions": 10
}

Response 480 (Student Offline):
{
  "detail": "Student is currently offline. Please try again."
}

Response 400/403 (Other errors):
{
  "detail": "Error message..."
}
```

### 2. Accept Session (Student)

```
POST /api/v1/bookings/{booking_id}/accept-session

Headers:
  Authorization: Bearer {student_token}

Response 200 (Success):
{
  "token": "eyJhbGc...",
  "room_name": "session-uuid",
  "livekit_url": "https://livekit.example.com"
}

Response 410 (Window Expired):
{
  "detail": "Session acceptance window expired. Teacher must initiate again."
}
```

### 3. Sync Session (Get Fresh Token)

```
GET /api/v1/bookings/{booking_id}/sync

Headers:
  Authorization: Bearer {teacher_or_student_token}

Response 200:
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "room_name": "session-uuid",
  "livekit_url": "https://livekit.example.com"
}

Response 403 (Session expired):
{
  "detail": "Session window expired. Window closed at ..."
}
```

---

## Message Types

### Database Schema

```python
class Message(Base):
    __tablename__ = "messages"

    id: UUID
    sender_id: UUID
    recipient_id: UUID
    booking_id: UUID
    type: MessageType  # TEXT, FILE, SESSION_REQUEST, etc.
    content: str
    created_at: datetime
    is_read: bool
```

### Message Types and Usage

```python
# SESSION_REQUEST - when teacher initiates
await create_message(
    type=MessageType.SESSION_REQUEST,
    sender_id=teacher_id,
    recipient_id=student_id,
    content="Teacher initiated session request",
    booking_id=booking_id
)

# NOTIFICATION_ERROR - when student is offline
await create_message(
    type=MessageType.NOTIFICATION_ERROR,
    sender_id=teacher_id,
    recipient_id=teacher_id,  # notification to self
    content="Student is currently offline",
    booking_id=booking_id
)

# NOTIFICATION_ACCEPTED - when student accepts
await create_message(
    type=MessageType.NOTIFICATION_ACCEPTED,
    sender_id=student_id,
    recipient_id=teacher_id,
    content="Student accepted session request",
    booking_id=booking_id
)
```

---

## Implementation Details

### Files Involved

#### 1. **Models** (`app/models/`)

- `communication.py` - Add MESSAGE_TYPE enums
- `booking.py` - Session model with LiveKit fields
  - `livekit_room_name`
  - `teacher_joined_at`
  - `student_joined_at`
  - `actual_start_at`
  - `actual_end_at`

#### 2. **Utils** (`app/utils/`)

- `presence.py` - Presence detection
  - `is_user_online()`
  - `get_pending_session_key()`
  - `set_pending_session_key()`
- `livekit.py` - LiveKit integration
  - `create_room()`
  - `generate_room_token()`
  - `delete_room()`

#### 3. **Services** (`app/services/`)

- `communication.py` - Message creation
  - `create_message()`
  - `create_error_message()`

#### 4. **Tasks** (`app/tasks/`)

- `session_request_tasks.py` - Session helpers
  - `handle_session_request_timeout()`
  - `create_session_request_message()`

#### 5. **Endpoints** (`app/api/v1/endpoints/`)

- `bookings.py` - New/updated endpoints
  - `POST /request-session` - NEW
  - `POST /accept` - UPDATED
  - `GET /livekit-token` - NEW

### Database Fields Added

```python
# Session model additions
livekit_room_name: str | None          # Room identifier in LiveKit
teacher_joined_at: datetime | None     # When teacher joined
student_joined_at: datetime | None     # When student joined
actual_start_at: datetime | None       # When session actually started
actual_end_at: datetime | None         # When session actually ended
duration_seconds: int | None           # Calculated duration

# Message type enum addition
SESSION_REQUEST = "session_request"
NOTIFICATION_ERROR = "notification_error"
NOTIFICATION_TIMEOUT = "notification_timeout"
NOTIFICATION_ACCEPTED = "notification_accepted"
```

---

## Code Examples

### Example 1: Check Presence and Request Session

```python
@router.post("/bookings/{booking_id}/request-session")
async def request_session(
    booking_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    redis_client: Redis = Depends(get_redis),
    sio = Depends(get_socketio)
):
    # Get booking
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(404, "Booking not found")

    # Check: Must be teacher
    if booking.teacher_id != current_user.id:
        raise HTTPException(403, "Only teacher can initiate")

    # Check: Booking must be ACTIVE
    if booking.status != BookingStatus.ACTIVE:
        raise HTTPException(400, "Booking not active")

    # ⭐ CHECK PRESENCE
    is_online = await is_user_online(booking.student_id, redis_client, sio)

    if not is_online:
        # Create error message
        error_msg = Message(
            sender_id=current_user.id,
            recipient_id=current_user.id,
            type=MessageType.NOTIFICATION_ERROR,
            content="Student is currently offline",
            booking_id=booking_id
        )
        db.add(error_msg)
        db.commit()

        # Return 480
        raise HTTPException(
            480,
            "Student is currently offline. Please try again."
        )

    # Note: Session is NOT created yet here.
    # It will be created when student accepts (accept_session endpoint)

    # Set Redis key
    await redis_client.setex(
        f"pending_session:{booking_id}",
        60,  # 60 second TTL
        str(session.id)
    )

    # Create message
    msg = Message(
        sender_id=current_user.id,
        recipient_id=booking.student_id,
        type=MessageType.SESSION_REQUEST,
        content="Teacher initiated session request",
        booking_id=booking_id
    )
    db.add(msg)
    db.commit()

    # Emit Socket.IO event
    sio.emit(
        "session_ready",
        {
            "session_id": str(session.id),
            "teacher_name": current_user.first_name,
            "booking_id": str(booking_id)
        },
        to=f"user:{booking.student_id}"
    )

    return {
        "status": "ready",
        "session_id": str(session.id),
        "completed_sessions": get_completed_sessions_count(booking_id, db),
        "total_sessions": booking.total_sessions
    }
```

### Example 2: Generate LiveKit Token

```python
def generate_room_token(
    user_id: str,
    session_id: str,
    display_name: str,
    is_teacher: bool,
    livekit_api_key: str,
    livekit_secret: str
) -> str:
    """Generate JWT token for LiveKit"""

    import jwt
    from datetime import datetime, timedelta, timezone

    # Token claims
    now = datetime.now(tz=timezone.utc)
    exp = now + timedelta(hours=1)

    claims = {
        "iss": "livekit",
        "sub": user_id,
        "aud": f"session-{session_id}",
        "exp": int(exp.timestamp()),
        "iat": int(now.timestamp()),
        "nbf": int(now.timestamp()),
        "video": {
            "room": f"session-{session_id}",
            "roomJoin": True,
            "canPublish": True,
            "canPublishData": True,
            "canSubscribe": True,
            "ingressAdmin": False
        },
        "metadata": f"{user_id}|{is_teacher}|{display_name}"
    }

    # Sign with LiveKit secret
    token = jwt.encode(
        claims,
        livekit_secret,
        algorithm="HS256"
    )

    return token
```

### Example 3: Accept Session

```python
@router.post("/bookings/{booking_id}/sessions/{session_id}/accept")
async def accept_session(
    booking_id: UUID,
    session_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    redis_client: Redis = Depends(get_redis)
):
    # Check: Must be student
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if booking.student_id != current_user.id:
        raise HTTPException(403, "Only student can accept")

    # Check: Redis key exists (within 60s window)
    redis_key = f"pending_session:{booking_id}"
    pending_session_id = await redis_client.get(redis_key)

    if not pending_session_id:
        raise HTTPException(410, "Session acceptance window expired")

    # Get session
    session = db.query(Session).filter(Session.id == session_id).first()
    if not session:
        raise HTTPException(404, "Session not found")

    # Create LiveKit room
    room_name = f"session-{session_id}"
    # await create_room(room_name)  # Implementation in livekit.py

    # Update session
    session.status = SessionStatus.READY
    session.student_accepted_at = datetime.now(tz=timezone.utc)
    session.livekit_room_name = room_name
    db.commit()
    
    # Webhook from LiveKit will transition status: READY → IN_PROGRESS when room is created

    # Clear Redis key
    await redis_client.delete(redis_key)

    # Create message
    msg = Message(
        sender_id=current_user.id,
        recipient_id=booking.teacher_id,
        type=MessageType.NOTIFICATION_ACCEPTED,
        content="Student accepted session request",
        booking_id=booking_id
    )
    db.add(msg)

    # Generate token
    token = generate_room_token(
        user_id=str(current_user.id),
        session_id=str(session_id),
        display_name=f"{current_user.first_name} {current_user.last_name}",
        is_teacher=False,
        livekit_api_key=settings.LIVEKIT_API_KEY,
        livekit_secret=settings.LIVEKIT_SECRET
    )

    return {
        "id": str(session.id),
        "booking_id": str(session.booking_id),
        "status": session.status.value,
        "livekit_room_name": room_name,
        "token": token,
        "livekit_url": settings.LIVEKIT_URL,
        "student_accepted_at": session.student_accepted_at.isoformat()
    }
```

---

## Troubleshooting

### Issue: Student gets 480 error even though they're online

**Possible causes:**

1. Redis presence not set on login
2. Socket.IO connection not tracked
3. Presence TTL expired

**Solution:**

```python
# In login endpoint, ensure presence is set
await redis_client.setex(
    f"user_presence:{user_id}",
    600,  # 10 minute TTL
    "1"
)

# In Socket.IO connect handler
@sio.event
async def connect(sid, environ):
    user_id = environ.get("user_id")
    # Register user presence
    sio.rooms[sid] = {"user_id": user_id}
```

### Issue: Acceptance window expires immediately

**Possible causes:**

1. Redis key not being set properly
2. TTL too short
3. Clock skew

**Solution:**

```python
# Verify Redis key is being set
await redis_client.setex(
    f"pending_session:{booking_id}",
    60,  # Make sure this is 60 seconds
    str(session.id)
)

# Verify key exists
ttl = await redis_client.ttl(f"pending_session:{booking_id}")
print(f"Key TTL: {ttl} seconds")  # Should be ~60
```

### Issue: LiveKit token doesn't work

**Possible causes:**

1. Wrong API key/secret
2. Token expired
3. Room doesn't exist

**Solution:**

```python
# Check JWT token is valid
import jwt
token = "..."  # The token generated
decoded = jwt.decode(
    token,
    settings.LIVEKIT_SECRET,
    algorithms=["HS256"]
)
print(decoded)  # Should show valid claims

# Check room exists in LiveKit
# Use LiveKit API or dashboard to verify room was created
```

### Issue: Session state gets out of sync

**Possible causes:**

1. Frontend and backend have different session state
2. Network latency causes race conditions
3. Multiple requests processed simultaneously

**Solution:**

```python
# Always fetch fresh session state
session = db.query(Session).filter(Session.id == session_id).first()

# Add database optimistic locking
# Or use transaction isolation levels

# Emit Socket.IO events to sync state
sio.emit("session_state_changed", {
    "session_id": str(session.id),
    "status": session.status.value
})
```

---

## Summary

### What You Now Know

✅ What LiveKit is and why we use it  
✅ How the complete session flow works  
✅ How presence checking prevents problems  
✅ API endpoints and their responses  
✅ Database schema changes needed  
✅ Code examples for implementation  
✅ Troubleshooting common issues

### Next Steps

1. **For Developers:** Check [`03-video-sessions/`](./03-video-sessions/) for detailed implementation files
2. **For DevOps:** Ensure LiveKit server is accessible
3. **For QA:** Test scenarios from troubleshooting section
4. **For Deployment:** See [`06-deployment/`](./06-deployment/) guides

### Key Takeaways

- **Presence checking** prevents orphaned sessions
- **60-second window** ensures responsive UX
- **Redis** provides fast state without DB load
- **JWT tokens** authenticate with LiveKit
- **Message types** provide audit trail
- **Socket.IO** keeps UI in sync

---

**For complete implementation details, see:**

- `backend/docs/03-video-sessions/LIVEKIT_INTEGRATION.md` - Full technical reference
- `backend/docs/03-video-sessions/SESSION_LIFECYCLE_SYNC_ARCHITECTURE.md` - Architecture deep dive
- `backend/docs/03-video-sessions/PRESENCE_AWARE_SESSION_REQUESTS.md` - Presence system details
