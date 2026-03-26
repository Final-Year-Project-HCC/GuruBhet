# LiveKit Integration with Session Request Flow

**Updated:** March 24, 2026  
**Status:** ✅ Implemented

---

## Overview

Integrated LiveKit SFU (Selective Forwarding Unit) with the teacher-initiated, student-accepted session flow. Teacher controls session start, student has 1 minute to accept, and both get LiveKit credentials to join.

---

## Complete Session Flow with LiveKit

```
┌──────────────────────────────────────────────────────────────────┐
│ STEP 1: Booking Setup (unchanged)                                │
├──────────────────────────────────────────────────────────────────┤
│ Student: POST /bookings/request                                  │
│          → Booking created (PENDING_APPROVAL)                    │
│ Teacher: POST /bookings/{id}/approve                             │
│          → Booking moves to PENDING_PAYMENT                      │
│ Student: POST /bookings/{id}/initiate-payment                    │
│          → eSewa redirects → callback → Booking ACTIVE           │
└──────────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────────┐
│ STEP 2: Teacher Initiates Session Request (With Presence Check)  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│ Teacher: POST /bookings/{id}/request-session ⭐ NEW              │
│                                                                  │
│ OPTION A: Student IS Online                                     │
│ ✅ Check: is_user_online(student_id) = True                     │
│ ✅ Set Redis key: pending_session:{booking_id} (60s TTL)         │
│ ✅ Create MESSAGE: type = SESSION_REQUEST                       │
│ ✅ Emit Socket.IO: "teacher_ready" to student                   │
│ ✅ Return 200: {"status": "ready", ...}                         │
│                                                                  │
│ OPTION B: Student IS Offline ⭐ NEW                              │
│ ❌ Check: is_user_online(student_id) = False                    │
│ ✅ Create MESSAGE: type = NOTIFICATION_ERROR                    │
│ ❌ Return 480: {"detail": "Student is currently offline..."}    │
│ 📧 Teacher sees error, can retry later                          │
└──────────────────────────────────────────────────────────────────┘
                            ↓ [only if student online]
┌──────────────────────────────────────────────────────────────────┐
│ STEP 2a: Teacher Initiates Session Request
│    - actual_start_at: current timestamp                         │
│                                                                  │
│ ✅ Record join timestamps:                                       │
│    - if teacher: session.teacher_joined_at = now                │
│    - if student: session.student_joined_at = now                │
│                                                                  │
│ ✅ Generate LiveKit JWT Token:                                   │
│    token = generate_room_token(                                  │
│      user_id = current_user.id,                                 │
│      session_id = session.id,                                   │
│      display_name = "Teacher Name" or "Student Name",           │
│      is_teacher = True/False,                                   │
│    )                                                             │
│                                                                  │
│ Response: LiveKitTokenResponse                                  │
│ {                                                                │
│   "token": "eyJhbGc...",  ← JWT for LiveKit API                 │
│   "room_name": "session-<uuid>",  ← Room to join                │
│   "livekit_url": "https://livekit.example.com"  ← Server URL    │
│ }                                                                │
│                                                                  │
│ Frontend: Initialize LiveKit client                             │
│   const livekit = new LiveKitClient(livekit_url)                │
│   const room = await livekit.connect(token, room_name)          │
└──────────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────────┐
│ STEP 2a: Student Accepts Session (1-Minute Window)               │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│ Student: POST /bookings/{id}/sessions/{sid}/accept               │
│                                                                  │
│ ✅ Check: Redis key exists (within 60s window)                  │
│ ✅ Check: Time elapsed < 1 minute from request-session          │
│                                                                  │
│ ✅ Create LiveKit Room                                           │
│    room_name = await create_room(str(session_id))               │
│    session.livekit_room_name = room_name                        │
│                                                                  │
│ ✅ Status: PENDING_STUDENT_ACCEPTANCE → SCHEDULED               │
│ ✅ student_accepted_at: current timestamp                       │
│ ✅ Create MESSAGE: type = NOTIFICATION_ACCEPTED ⭐ NEW          │
│ ✅ Clear Redis key                                              │
│ ✅ Emit Socket.IO: "student_accepted" to teacher                │
│                                                                  │
│ Response: SessionRead with token ⭐ NEW                          │
│ {                                                                │
│   "id": "session-uuid",                                          │
│   "booking_id": "booking-uuid",                                  │
│   "session_number": 1,                                           │
│   "status": "SCHEDULED",  ← Ready to join!                       │
│   "teacher_initiated_at": "2026-03-24T10:45:00Z",               │
│   "student_accepted_at": "2026-03-24T10:47:30Z",  ← Set now     │
│   "livekit_room_name": "session-<uuid>",  ← Created now!        │
│   "token": "eyJhbGc...",  ← Direct token! ⭐ NEW               │
│   "livekit_url": "https://..."  ⭐ NEW                         │
│   "actual_start_at": null  ← Not yet, waiting for first join    │
│ }                                                                │
│                                                                  │
│ 📧 Teacher receives notification: "Student accepted, ready!"    │
└──────────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────────┐
│ STEP 3: Both Get LiveKit Access Tokens
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│ Session Status: IN_PROGRESS                                     │
│ actual_start_at: <set when first person joins>                  │
│ teacher_joined_at: <timestamp of when teacher joined>           │
│ student_joined_at: <timestamp of when student joined>           │
│                                                                  │
│ Both are connected to LiveKit SFU:                               │
│ - Audio/video streaming managed by LiveKit                      │
│ - Recording handled by LiveKit (if enabled)                     │
│ - Session duration: booking.session_duration_minutes             │
│                                                                  │
│ [Teaching happens for agreed duration]                          │
└──────────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────────┐
│ STEP 5: Teacher Completes Session (Existing endpoint)            │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│ Teacher: POST /sessions/{id}/complete                            │
│          (From sessions.py endpoint, not bookings.py)            │
│                                                                  │
│ ✅ Status: IN_PROGRESS → COMPLETED                              │
│ ✅ actual_end_at: current timestamp                              │
│ ✅ Booking counters updated                                      │
│ ✅ LiveKit room torn down                                        │
│ ✅ Transaction created (SESSION_RELEASE)                        │
│                                                                  │
│ [Session finished, both disconnected]                           │
└──────────────────────────────────────────────────────────────────┘

[Repeat STEP 2-5 for remaining sessions]
```

---

## New Endpoints

### Endpoint 1: Teacher Requests Session (Presence-Aware) ⭐ UPDATED

```
POST /api/v1/bookings/{booking_id}/request-session
Authorization: Bearer <teacher_access_token>

No body required.

Response 200 (Student Online):
{
  "status": "ready",
  "completed_sessions": 2,
  "total_sessions": 10,
  "session_id": "session-uuid"
}

Response 480 (Student Offline): ⭐ NEW
{
  "detail": "Student is currently offline. Please try again."
}

What happens:
1. Check if student is online (is_user_online)
### Endpoint 2: Student Accepts Session

```

POST /api/v1/bookings/{booking_id}/sessions/{session_id}/accept
Authorization: Bearer <student_access_token>

No body required.

Response 200: SessionReadWithToken ⭐ UPDATED
{
"id": "session-uuid",
"booking_id": "booking-uuid",
"session_number": 1,
"status": "SCHEDULED",
"teacher_initiated_at": "2026-03-24T10:45:00Z",
"student_accepted_at": "2026-03-24T10:47:30Z",
"livekit_room_name": "session-<uuid>",
"token": "eyJhbGc...", ← Direct token! ⭐ NEW
"livekit_url": "https://...", ← Server URL ⭐ NEW
"actual_start_at": null,
"actual_end_at": null
}

Response 410 (Window Expired):
{
"detail": "Session acceptance window expired. Teacher must initiate again."
}

````

**Validations:**

- ✅ Only STUDENT can accept
- ✅ Session must be PENDING_STUDENT_ACCEPTANCE
- ✅ **Must accept within 1 minute** of teacher_initiated_at (checked via Redis key)
  - If > 1 min: 410 Gone "acceptance window expired"
- ✅ Creates LiveKit room on acceptance
- ✅ Creates MESSAGE with type NOTIFICATION_ACCEPTED ⭐ NEW
- ✅ Sets student_accepted_at timestamp
- ✅ Transitions to SCHEDULED status
- ✅ Returns token immediately in response ⭐ NEW

**What happens inside:**

```python
# Check 1-minute window via Redis
pending = await get_pending_session_key(str(booking_id))
if not pending:
    raise HTTPException(410, "acceptance window expired")

# Create LiveKit room
room_name = await create_room(str(session_id))
session.livekit_room_name = room_name

# Update status and timestamps
session.status = SessionStatus.SCHEDULED
session.student_accepted_at = now
````

---

## Message Types for Session Lifecycle

All session events are recorded in the database with the following message types:

- **SESSION_REQUEST** - Teacher requested a session (when teacher calls `/request-session`)
- **NOTIFICATION_ERROR** - Presence check failed (e.g., student offline)
- **NOTIFICATION_TIMEOUT** - Session acceptance window expired (60s elapsed)
- **NOTIFICATION_ACCEPTED** - Student accepted the session request

```python
# Enum in app/core/enums.py
class MessageType(str, Enum):
    TEXT = "text"
    FILE = "file"
    SESSION_REQUEST = "session_request"
    NOTIFICATION_ERROR = "notification_error"
    NOTIFICATION_TIMEOUT = "notification_timeout"
    NOTIFICATION_ACCEPTED = "notification_accepted"
```

These messages provide an audit trail of all session-related events and serve as notifications to both parties.

---

### Endpoint 3: Get LiveKit Access Token (NEW)

```
GET /api/v1/bookings/{booking_id}/sessions/{session_id}/livekit-token
Authorization: Bearer <access_token>  (teacher or student)

Response 200: LiveKitTokenResponse
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "room_name": "session-<uuid>",
  "livekit_url": "https://livekit.example.com"
}
```

**Validations:**

- ✅ User must be teacher or student of booking
- ✅ Session must be SCHEDULED or IN_PROGRESS
- ✅ Booking must be ACTIVE
- ✅ LiveKit room must exist

**What happens on first call:**

```python
# Transition to IN_PROGRESS on first join
if session.status == SessionStatus.SCHEDULED:
    session.status = SessionStatus.IN_PROGRESS
    session.actual_start_at = now

# Record who joined and when
if is_teacher and not session.teacher_joined_at:
    session.teacher_joined_at = now
elif not is_teacher and not session.student_joined_at:
    session.student_joined_at = now

# Generate JWT token
token = generate_room_token(
    user_id=str(current_user.id),
    session_id=str(session_id),
    display_name=f"{current_user.first_name} {current_user.last_name}",
    is_teacher=(current_user.id == booking.teacher_id),
)
```

---

## Session Status States

| Status                       | When Set          | By                                      | What Happens                        | Next                  |
| ---------------------------- | ----------------- | --------------------------------------- | ----------------------------------- | --------------------- |
| `PENDING_STUDENT_ACCEPTANCE` | Teacher initiates | Teacher calls `/start-session`          | No room created, no join possible   | Accept or Timeout     |
| `SCHEDULED`                  | Student accepts   | Student calls `/accept`                 | LiveKit room created, ready to join | First join or timeout |
| `IN_PROGRESS`                | First join        | Either calls `/livekit-token`           | Session actively ongoing            | Complete              |
| `COMPLETED`                  | Teacher completes | Teacher calls `/sessions/{id}/complete` | Room torn down, transaction created | (terminal)            |
| `CANCELLED_BY_*`             | Either cancels    | Either calls `/bookings/{id}/cancel`    | Session invalidated                 | (terminal)            |

---

## 1-Minute Acceptance Window

**Requirement:** Student must accept within 60 seconds of teacher initiating.

**Implementation:**

```python
# In accept_session_request endpoint
if session.teacher_initiated_at:
    time_since_initiation = datetime.now(tz=timezone.utc) - session.teacher_initiated_at
    if time_since_initiation > timedelta(minutes=1):
        raise HTTPException(
            status_code=400,
            detail="Session acceptance window expired. Must accept within 1 minute of teacher initiating."
        )
```

**Timeline:**

```
10:45:00 → Teacher calls /start-session
           teacher_initiated_at = 10:45:00
           ⏰ 1-minute window opens

10:45:59 → Student calls /accept (before 1 minute)
           ✅ Accepted successfully
           Status → SCHEDULED
           Room created

vs

10:46:01 → Student calls /accept (after 1 minute)
           ❌ Rejected: "acceptance window expired"
           Status stays PENDING_STUDENT_ACCEPTANCE
```

**What if student doesn't accept?**

- Session remains in `PENDING_STUDENT_ACCEPTANCE`
- LiveKit room is never created
- Teacher or student can cancel the booking
- No charges or refunds (session never started)

---

## LiveKit Integration Details

### Room Creation

```python
# Called when student accepts
room_name = await create_room(str(session_id))
# Returns something like: "session-a1b2c3d4-e5f6-..."
```

### Token Generation

```python
token = generate_room_token(
    user_id=str(current_user.id),
    session_id=str(session_id),
    display_name=f"{current_user.first_name} {current_user.last_name}",
    is_teacher=(current_user.id == booking.teacher_id),
)
# Returns JWT signed by LiveKit private key
# Grants access to specific room with user ID and metadata
```

### No-Show Detection

```python
# Timestamps recorded when users join
session.teacher_joined_at  # When teacher got token and joined
session.student_joined_at  # When student got token and joined

# Use to detect:
- No-show: actual_start_at is set but teacher_joined_at/student_joined_at is null
- Late join: actual_start_at vs join timestamps can be >X minutes apart
```

---

## Error Scenarios

### Teacher tries to accept

```
POST /bookings/{id}/sessions/{sid}/accept
→ 403 "Only students can accept sessions"
```

### Student tries to initiate

```
POST /bookings/{id}/start-session
→ 403 "Only teachers can initiate sessions"
```

### Student accepts after 1 minute

```
POST /bookings/{id}/sessions/{sid}/accept  [1m 1s after initiation]
→ 400 "Session acceptance window expired. Must accept within 1 minute..."
```

### Try to get token before accepted

```
GET /bookings/{id}/sessions/{sid}/livekit-token
[Session status: PENDING_STUDENT_ACCEPTANCE]
→ 400 "Session must be SCHEDULED or IN_PROGRESS to join..."
```

### Wrong user trying to join

```
GET /bookings/{id}/sessions/{sid}/livekit-token
[Current user not in booking]
→ 403 "Not your session"
```

### Booking not ACTIVE

```
GET /bookings/{id}/sessions/{sid}/livekit-token
[Booking status: CANCELLED_BY_TEACHER]
→ 400 "Booking must be ACTIVE to join sessions..."
```

---

## Code Changes Summary

### Files Modified

**1. `app/api/v1/endpoints/bookings.py`**

- ✅ Added imports: `timedelta`, `create_room`, `generate_room_token`, `SessionRead`
- ✅ Updated `initiate_session_request`: No changes (already correct)
- ✅ Updated `accept_session_request`:
  - Added 1-minute window check
  - Creates LiveKit room
  - Transitions to SCHEDULED (not IN_PROGRESS)
- ✅ Added `get_livekit_token` endpoint:
  - New endpoint to get LiveKit JWT
  - Handles SCHEDULED → IN_PROGRESS transition on first join
  - Records join timestamps

**2. `app/schemas/booking.py`**

- ✅ Ensured `LiveKitTokenResponse` exists
- ✅ Ensured `SessionRead` includes all necessary fields

**3. `app/core/enums.py`**

- ✅ No changes (SessionStatus already includes SCHEDULED and IN_PROGRESS)

**4. `app/models/booking.py`**

- ✅ No changes (Session model already has all needed fields)

---

## Integration with Existing Sessions Endpoint

The new `/bookings/.../sessions/.../accept` and `/bookings/.../livekit-token` endpoints **complement** the existing `/sessions/{id}/join` endpoint:

| Endpoint                                          | Purpose                | When to Use                                     |
| ------------------------------------------------- | ---------------------- | ----------------------------------------------- |
| `POST /bookings/{id}/sessions/{sid}/accept`       | Accept session request | After teacher initiates, must call within 1 min |
| `GET /bookings/{id}/sessions/{sid}/livekit-token` | Get LiveKit JWT        | To join the session (can call multiple times)   |
| `POST /sessions/{id}/join`                        | Legacy endpoint        | Eventually deprecated; uses same logic          |

Both approaches create LiveKit tokens. The new `bookings` endpoints integrate with the teacher-initiated flow, while the legacy `sessions` endpoint works independently.

---

## Example Client Flow (Frontend)

```javascript
// Teacher initiates
POST /api/v1/bookings/{booking_id}/start-session
→ Session created (PENDING_STUDENT_ACCEPTANCE)
→ Teacher waits for student

// Student receives notification, shows accept dialog
// Student clicks "Accept"
POST /api/v1/bookings/{booking_id}/sessions/{session_id}/accept
→ Session accepted (SCHEDULED)
→ LiveKit room created
→ Both see "ready to join" UI

// Either party clicks "Join Session"
GET /api/v1/bookings/{booking_id}/sessions/{session_id}/livekit-token
→ Get LiveKit JWT + room info
→ Initialize LiveKit client
→ Connect to room
→ Session transitions to IN_PROGRESS
→ Audio/video streams begin

// Teaching happens for agreed duration

// Teacher clicks "End Session"
POST /api/v1/sessions/{session_id}/complete
→ Session marked COMPLETED
→ Room torn down
→ Payment released
```

---

## Testing

```bash
# 1. Create booking and get to ACTIVE status (same as before)
POST /bookings/request → PENDING_APPROVAL
POST /bookings/{id}/approve → PENDING_PAYMENT
POST /bookings/{id}/initiate-payment → ACTIVE

# 2. Teacher initiates
POST /bookings/{booking_id}/start-session
{
  # Empty body
}
# Check: Session status = PENDING_STUDENT_ACCEPTANCE
# Check: teacher_initiated_at is set
# Check: livekit_room_name is null

# 3. Student accepts (within 1 minute)
POST /bookings/{booking_id}/sessions/{session_id}/accept
# Check: Session status = SCHEDULED
# Check: student_accepted_at is set
# Check: livekit_room_name is created

# 4. Get LiveKit tokens (both teacher and student)
GET /bookings/{booking_id}/sessions/{session_id}/livekit-token
# Check: Session status = IN_PROGRESS (changed from SCHEDULED)
# Check: actual_start_at is set
# Check: Returns {token, room_name, livekit_url}

# 5. Teacher completes
POST /sessions/{session_id}/complete
# Check: Session status = COMPLETED
# Check: actual_end_at is set
```

---

## Future Enhancements

1. **Auto-cleanup:** Sessions in PENDING_STUDENT_ACCEPTANCE for >X minutes auto-reject
2. **Timeout notifications:** Push notification at 30-second mark if not accepted
3. **Late join penalty:** Fee if student joins >X minutes late
4. **Recording consent:** Explicit consent before session starts
5. **Rescheduling:** Allow students to request reschedule instead of accept/reject
6. **Concurrent sessions:** Prevent teacher from initiating if already in another session
