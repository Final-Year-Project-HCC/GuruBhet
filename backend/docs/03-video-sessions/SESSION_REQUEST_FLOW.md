# Session Request Flow (Updated)

## Overview

Changed from **on-demand session creation** to a **teacher-initiated, student-accepted** session flow.

**Key Change:**

- **Before:** Either party could create a session; it immediately went to SCHEDULED status
- **Now:** Only teachers can initiate; students must accept; session stays READY until webhook transitions to IN_PROGRESS

---

## New Session Lifecycle

### Step 4a: Teacher Initiates Session Request

**Endpoint:** `POST /api/v1/bookings/{booking_id}/request-session` ⭐ UPDATED

**Who:** Only **TEACHER** can call
**Precondition:** Booking status = `ACTIVE`
**Precondition:** Less than `booking.total_sessions` sessions created
**Precondition:** ⭐ **NEW:** Student must be online (returns 480 if offline)

**Request Body:** Empty (no body needed)

**Response (Success 200):**

```json
{
  "status": "ready",
  "completed_sessions": 2,
  "total_sessions": 10,
  "session_id": "session-uuid"
}
```

**Response (Student Offline 480):** ⭐ NEW

```json
{
  "detail": "Student is currently offline. Please try again."
}
```

**What happens (Success):**

1. ✅ Check if student is online (presence check)
2. ✅ Set Redis key: `pending_session:{booking_id}` (60s TTL)
3. ✅ Create MESSAGE record with type `SESSION_REQUEST`
4. ✅ Emit Socket.IO event to student: "Teacher ready!"
5. ⏳ Student must accept within 60 seconds

**What happens (Student Offline):**

1. ❌ Student is not online
2. ✅ Create MESSAGE record with type `NOTIFICATION_ERROR`
3. ❌ Return 480 with error message
4. ⏳ Teacher must try again later

---

### Step 4b: Student Accepts Session Request

**Endpoint:** `POST /api/v1/bookings/{booking_id}/sessions/{session_id}/accept`

**Who:** Only **STUDENT** can call
**Precondition:** Session status = `READY` (waiting for webhook to transition to IN_PROGRESS)
**Precondition:** User is the booking's student

**Request Body:** Empty (no body needed)

**Response:** Updated `BookingRead` with accepted session

```json
{
  "id": "booking-uuid",
  "status": "ACTIVE",
  "sessions": [
    {
      "id": "session-uuid",
      "booking_id": "booking-uuid",
      "session_number": 1,
      "status": "SCHEDULED",
      "teacher_initiated_at": "2026-03-24T10:00:00Z",
      "student_accepted_at": "2026-03-24T10:05:00Z",
      "livekit_room_name": null,
      "actual_start_at": null,
      "actual_end_at": null
    }
  ]
}
```

**What happens:**

1. ✅ Verify Redis key exists (60s window not expired)
2. ✅ Session status set to: `READY` (webhook will transition to `IN_PROGRESS` when room created)
3. ✅ `student_accepted_at` set to current timestamp
4. ✅ Create MESSAGE record with type `NOTIFICATION_ACCEPTED` ⭐ NEW
5. ✅ Emit Socket.IO event to teacher: "Student accepted!"
6. ✅ Clear Redis key
7. ✅ Both parties can now join the session
8. ✅ Session ready for LiveKit setup

---

### Step 4c: Both Join LiveKit (Implicit)

Once session is `SCHEDULED`, both parties can:

1. Join the LiveKit room
2. Session automatically moves to `IN_PROGRESS` when first participant joins
3. `actual_start_at` recorded

---

### Step 4d: Session Completes

When session time ends:

1. Session status: `IN_PROGRESS` → `COMPLETED`
2. `actual_end_at` recorded
3. Booking `completed_sessions` counter incremented

---

## Complete Booking Flow (4 Steps Total)

```
┌─────────────────────────────────────────────────────────────────┐
│ STEP 1: Student Creates Booking Request                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  POST /bookings/request                                         │
│  {                                                              │
│    "teacher_id": "...",                                         │
│    "subject_id": "...",                                         │
│    "total_sessions": 10,                                        │
│    "rate_per_session": 500,                                     │
│    "session_duration_minutes": 60  ← Duration set here!         │
│  }                                                              │
│                                                                  │
│  Booking Status: PENDING_APPROVAL                               │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 2: Teacher Approves Booking                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  POST /bookings/{id}/approve                                    │
│  {                                                              │
│    "notes": "Looks good!"                                       │
│  }                                                              │
│                                                                  │
│  Booking Status: PENDING_PAYMENT                                │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 3: Student Pays via eSewa                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  POST /bookings/{id}/initiate-payment                           │
│  (Redirects to eSewa)                                           │
│                                                                  │
│  → eSewa Callback                                               │
│    POST /payments/esewa/callback                                │
│                                                                  │
│  Booking Status: ACTIVE ← Ready for sessions!                   │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 4: On-Demand Session Creation (Repeatable N times)         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  4a) Teacher Initiates Session Request                          │
│      POST /bookings/{id}/start-session                          │
│      Session Status: PENDING_STUDENT_ACCEPTANCE                 │
│      teacher_initiated_at ← set                                 │
│                                                                  │
│      ↓                                                           │
│                                                                  │
│  4b) Student Accepts Session Request                            │
│      POST /bookings/{id}/sessions/{sid}/accept                  │
│      Session Status: SCHEDULED                                  │
│      student_accepted_at ← set                                  │
│                                                                  │
│      ↓                                                           │
│                                                                  │
│  4c) Both Join LiveKit                                          │
│      Session Status: IN_PROGRESS                                │
│      actual_start_at ← set                                      │
│                                                                  │
│      ↓ (teaching happens for 60 mins)                           │
│                                                                  │
│  4d) Session Completes                                          │
│      Session Status: COMPLETED                                  │
│      actual_end_at ← set                                        │
│                                                                  │
│  Repeat steps 4a-4d for remaining sessions                      │
│                                                                  │
│  Booking Status: ACTIVE (throughout, until all sessions done)   │
└─────────────────────────────────────────────────────────────────┘
                            ↓
        [When all sessions completed]
                            ↓
        Booking Status: COMPLETED
```

---

## Session Statuses Explained

| Status                       | Set By            | When                    | Next                   | Duration Field         |
| ---------------------------- | ----------------- | ----------------------- | ---------------------- | ---------------------- |
| `READY`                      | Student (step 4b) | Student accepts         | IN_PROGRESS via webhook | Inherited from booking |
| `IN_PROGRESS`                | Webhook           | Room created (webhook)  | COMPLETED              | Active for duration    |
| `COMPLETED`                  | System            | Time ends               | (terminal)             | Recorded as actual     |
| `CANCELLED_BY_*`             | Either party      | Before completion       | (terminal)             | N/A                    |

---

## Validation Rules

### Create Session Request (Teacher Initiates)

- ✅ Only **TEACHER** can call
- ✅ Booking must be **ACTIVE**
- ✅ Session count < `booking.total_sessions`
- ✅ Session NOT created yet (will be created when student accepts)

### Accept Session Request (Student Accepts)

- ✅ Only **STUDENT** can call
- ✅ Redis key must still exist (within 60-second window)
- ✅ Session created with `READY` status
- ✅ LiveKit room created immediately
- ✅ Webhook will transition `READY` → `IN_PROGRESS`

### Cannot Accept If:

- ❌ 60-second window expired (Redis key deleted)
- ❌ Student is not part of the booking
- ❌ Booking is not ACTIVE

---

## Session Duration Inheritance

**Key Point:** Session duration is **not** specified per-session.

- Duration agreed upon once in booking request: `session_duration_minutes`
- All sessions in the booking have the same duration
- Applied when session is `SCHEDULED` (student accepted)
- Duration enforced when joining LiveKit

```python
# In booking request:
session_duration_minutes: 60  # All 10 sessions will be 60 min each

# In each session (inherited):
# Duration = booking.session_duration_minutes = 60 min
```

---

## Example Timeline

```
2026-03-24 10:00 → Student creates booking (5 sessions, 60 min each)
2026-03-24 10:15 → Teacher approves
2026-03-24 10:30 → Student initiates payment
2026-03-24 10:32 → eSewa callback → Booking ACTIVE
2026-03-24 10:45 → Teacher: "Let's start session 1"
                    Teacher calls: POST /bookings/{id}/start-session
                    Session 1 Status: PENDING_STUDENT_ACCEPTANCE
                    teacher_initiated_at: 2026-03-24 10:45
2026-03-24 10:48 → Student: "Ok, I'm ready"
                    Student calls: POST /bookings/{id}/sessions/{sid}/accept
                    Session 1 Status: SCHEDULED
                    student_accepted_at: 2026-03-24 10:48
2026-03-24 10:50 → Teacher joins LiveKit room
2026-03-24 10:52 → Student joins LiveKit room
                    Session 1 Status: IN_PROGRESS
                    actual_start_at: 2026-03-24 10:52
2026-03-24 11:52 → [60 minutes have passed]
                    Session 1 Status: COMPLETED
                    actual_end_at: 2026-03-24 11:52
2026-03-24 14:00 → Teacher: "Session 2?"
                    Repeats steps 4a-4d for remaining 4 sessions
```

---

## Benefits of This Flow

| Aspect                 | Before                     | After                                           |
| ---------------------- | -------------------------- | ----------------------------------------------- |
| **Control**            | Either party could create  | Only teacher initiates, clearer control         |
| **Coordination**       | Instant creation           | Explicit acceptance, both agree explicitly      |
| **Audit Trail**        | Only creation timestamp    | Both `initiated_at` and `accepted_at`           |
| **Flexibility**        | Immediate join required    | Time to prepare before session                  |
| **Clarity**            | Unclear who wanted session | Clear intent: teacher requests, student accepts |
| **No-show Prevention** | Less clear intent          | Explicit acceptance reduces casual requests     |

---

## API Changes

### Removed Endpoints

- ❌ `POST /bookings/{id}/start-session` (now teacher-only initiator)

### New Endpoints

- ✅ `POST /bookings/{id}/start-session` → Teacher initiates (renamed behavior)
- ✅ `POST /bookings/{id}/sessions/{session_id}/accept` → Student accepts (new)

### Updated Fields on Session

- ✅ Added: `teacher_initiated_at` (when teacher calls start-session)
- ✅ Added: `student_accepted_at` (when student calls accept)
- ✅ Added: `PENDING_STUDENT_ACCEPTANCE` status

---

## Error Scenarios

### Teacher tries to accept a session

```
POST /bookings/{id}/sessions/{sid}/accept
→ 403 "Only students can accept sessions"
```

### Student tries to initiate a session

```
POST /bookings/{id}/start-session
→ 403 "Only teachers can initiate sessions"
```

### Teacher initiates but student never accepts

```
Session remains in PENDING_STUDENT_ACCEPTANCE
→ Neither party can join LiveKit
→ Teacher can cancel session (new cancellation endpoint)
```

### Student tries to accept non-existent session

```
POST /bookings/{id}/sessions/{invalid-sid}/accept
→ 404 "Session not found"
```

### Student accepts already-accepted session

```
Session status already SCHEDULED
→ 400 "Session cannot be accepted in status SCHEDULED"
```

---

## Code Snippets

### Initiate Session Request (Teacher)

```python
# POST /bookings/{booking_id}/start-session

@router.post("/{booking_id}/start-session", response_model=BookingRead)
async def initiate_session_request(booking_id: UUID, current_user: CurrentUser, db: DbSession):
    if current_user.role != UserRole.TEACHER:
        raise HTTPException(status_code=403, detail="Only teachers can initiate sessions")

    # Validation...
    session = Session(
        booking_id=booking_id,
        session_number=len(sessions) + 1,
        status=SessionStatus.PENDING_STUDENT_ACCEPTANCE,
        teacher_initiated_at=datetime.now(tz=timezone.utc),
    )
    db.add(session)
    await db.flush()
    return booking
```

### Accept Session Request (Student)

```python
# POST /bookings/{booking_id}/sessions/{session_id}/accept

@router.post("/{booking_id}/sessions/{session_id}/accept", response_model=BookingRead)
async def accept_session_request(booking_id: UUID, session_id: UUID, current_user: CurrentUser, db: DbSession):
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(status_code=403, detail="Only students can accept sessions")

    if session.status != SessionStatus.PENDING_STUDENT_ACCEPTANCE:
        raise HTTPException(status_code=400, detail=f"Session cannot be accepted in status {session.status.value}")

    session.status = SessionStatus.SCHEDULED
    session.student_accepted_at = datetime.now(tz=timezone.utc)
    await db.flush()
    return booking
```

---

## Next Steps

1. ✅ Update SessionStatus enum with `PENDING_STUDENT_ACCEPTANCE`
2. ✅ Update Session model with `teacher_initiated_at` and `student_accepted_at`
3. ✅ Update endpoints: separate initiate and accept
4. ✅ Update migration file
5. ⏳ **Implement** session cancellation endpoint (cancel pending/scheduled sessions)
6. ⏳ **Implement** notification system (email/push when session initiated)
7. ⏳ **Implement** timeout: auto-reject pending sessions after 24 hours?
8. ⏳ **Write** unit tests for new flow
9. ⏳ **Document** in API reference
