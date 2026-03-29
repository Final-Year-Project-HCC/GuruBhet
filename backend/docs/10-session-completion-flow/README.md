# Session Completion Request Flow

## Overview

This document describes the new session completion flow that allows teachers to request session completion with student approval for premature endings, while automatically completing sessions that have reached their full duration plus leniency time.

## Endpoints

### 1. POST `/{session_id}/request-session-completion`

**Called by**: Teacher

**Purpose**: Request to end a session, either prematurely or at the end of duration.

**Behavior**:

- **Scenario A: Session duration + leniency reached**
  - Session is immediately marked as COMPLETED
  - LiveKit room is torn down
  - Both teacher and student receive `session-ended` socket event
  - Payment is processed via Celery tasks
- **Scenario B: Session duration not yet reached (Premature)**
  - Check if a Redis key already exists for this session
  - If key exists: Return 409 Conflict error (request already pending)
  - If key doesn't exist:
    - Create Redis key: `premature_session_completion:{session_id}` (60-second TTL)
    - Emit `premature-session-completion-requested` socket event to student
    - Include `remaining_duration_seconds` in the event payload
    - Return 200 with session object

**Request**:

```bash
POST /api/v1/sessions/{session_id}/request-session-completion
Authorization: Bearer {teacher_token}
```

**Responses**:

- `200 OK`: Session completed or request created
- `400 Bad Request`: Session not in progress or hasn't started
- `403 Forbidden`: Not the teacher
- `409 Conflict`: Premature completion request already exists

---

### 2. POST `/{session_id}/accept-session-completion`

**Called by**: Student

**Purpose**: Accept the teacher's request for premature session completion.

**Behavior**:

- Check if Redis key exists for this session (teacher must have requested it)
- If key doesn't exist: Return 400 Bad Request
- If key exists:
  - Mark session as COMPLETED
  - Update booking counters
  - Process payment
  - Delete the Redis key
  - Emit `session-ended` socket event to both participants
  - Trigger post-session Celery tasks

**Request**:

```bash
POST /api/v1/sessions/{session_id}/accept-session-completion
Authorization: Bearer {student_token}
```

**Responses**:

- `200 OK`: Session completed
- `400 Bad Request`: No pending request found or session not in progress
- `403 Forbidden`: Not the student

---

### 3. POST `/{session_id}/reject-session-completion`

**Called by**: Student

**Purpose**: Reject the teacher's request for premature session completion.

**Behavior**:

- Check if Redis key exists for this session
- If key doesn't exist: Return 400 Bad Request
- If key exists:
  - Delete the Redis key
  - Emit `premature-session-completion-rejected` socket event to teacher
  - Session remains IN_PROGRESS (continues)

**Request**:

```bash
POST /api/v1/sessions/{session_id}/reject-session-completion
Authorization: Bearer {student_token}
```

**Responses**:

- `200 OK`: Request rejected, session continues
- `400 Bad Request`: No pending request found or session not in progress
- `403 Forbidden`: Not the student

---

## Duration & Leniency Calculation

### Formula

```
Required Duration = booking.session_duration_minutes × 60 seconds
Leniency Per 15min Block = settings.LIVEKIT_ROOM_LENIENCY_MINUTES_PER_15MIN
Total Leniency = (session_duration_minutes / 15) × leniency_per_15min_block × 60 seconds
Threshold = Required Duration + Total Leniency
```

**Example**:

- Session duration: 60 minutes
- Leniency per 15min block: 2 minutes
- Required: 60 × 60 = 3600 seconds
- Leniency: (60 / 15) × 2 × 60 = 480 seconds
- Threshold: 3600 + 480 = 4080 seconds (68 minutes)

---

## Redis Keys

### Premature Completion Request Key

**Format**: `premature_session_completion:{session_id}`

**TTL**: 60 seconds

**Value**:

```json
{
  "session_id": "uuid-string",
  "requested_at": "ISO-8601 timestamp"
}
```

**Purpose**:

- Prevents duplicate requests (if key exists, request fails with 409)
- Marks that a teacher has actually requested premature completion
- Auto-expires after 60 seconds if no response from student

---

## Socket.IO Events

### `premature-session-completion-requested`

**Emitted to**: Student (room: `user:{student_id}`)

**Payload**:

```json
{
  "session_id": "uuid-string",
  "booking_id": "uuid-string",
  "requested_at": "ISO-8601 timestamp",
  "remaining_duration_seconds": 1200
}
```

### `session-ended`

**Emitted to**: Both participants in the LiveKit room

**Payload**:

```json
{
  "session_id": "uuid-string",
  "booking_id": "uuid-string",
  "duration_seconds": 3600,
  "completed_at": "ISO-8601 timestamp"
}
```

### `premature-session-completion-rejected`

**Emitted to**: Teacher (room: `user:{teacher_id}`)

**Payload**:

```json
{
  "session_id": "uuid-string",
  "booking_id": "uuid-string",
  "rejected_at": "ISO-8601 timestamp"
}
```

---

## Database Changes

### Session Model

No new columns required (uses existing `booking.session_duration_minutes` and session `actual_start_at`/`actual_end_at`).

### Booking Model

No new columns required (existing structure supports this flow).

---

## Error Cases & Edge Cases

| Scenario                                  | Status | Error                              | Action       |
| ----------------------------------------- | ------ | ---------------------------------- | ------------ |
| Teacher requests, session not IN_PROGRESS | 400    | "Session is not in progress"       | Return error |
| Teacher requests, session not started     | 400    | "Session has not actually started" | Return error |
| Teacher requests prematurely (key exists) | 409    | "Request already exists"           | Return error |
| Student accepts without request           | 400    | "No pending request found"         | Return error |
| Student rejects without request           | 400    | "No pending request found"         | Return error |
| Non-teacher tries to request              | 403    | "Only teacher can request"         | Return error |
| Non-student tries to accept/reject        | 403    | "Only student can accept/reject"   | Return error |

---

## Transaction Handling

Both `accept-session-completion` and `request-session-completion` (when threshold reached) perform the following:

1. Mark session as COMPLETED
2. Increment `booking.completed_sessions`
3. Update `booking.status` if all sessions complete
4. Create SESSION_RELEASE transaction entry
5. Tear down LiveKit room
6. Clean up Redis keys
7. Emit socket events
8. Trigger Celery tasks for billing and notifications

---

## Configuration

Add to `.env`:

```
LIVEKIT_ROOM_LENIENCY_MINUTES_PER_15MIN=2  # Example: 2 minutes of leniency per 15-minute session
```

---

## Implementation Notes

- All timestamps use UTC timezone
- Redis operations use async patterns with `cache_set`, `cache_get`, `cache_delete`
- Socket.IO events are emitted in try/except blocks (may not be available in all contexts)
- Celery tasks are triggered asynchronously for billing and notifications
- Database commits use explicit `await db.commit()` at the end of each endpoint
