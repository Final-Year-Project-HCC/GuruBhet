# Session Completion Flow - API Examples

Complete examples for testing the session completion flow.

## Prerequisites

- A valid teacher JWT token: `TEACHER_TOKEN`
- A valid student JWT token: `STUDENT_TOKEN`
- An active session ID: `SESSION_ID`
- Backend running at `http://localhost:8000`

---

## 1. Request Session Completion (Teacher)

### Scenario A: Auto-Complete (Duration Reached)

Request when session has run for 60 minutes + 8 minutes leniency = 68 minutes total.

```bash
curl -X POST \
  http://localhost:8000/api/v1/sessions/550e8400-e29b-41d4-a716-446655440000/request-session-completion \
  -H "Authorization: Bearer TEACHER_TOKEN" \
  -H "Content-Type: application/json"
```

**Success Response (200)**:

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "booking_id": "660e8400-e29b-41d4-a716-446655440001",
  "status": "COMPLETED",
  "actual_start_at": "2025-03-29T10:00:00+00:00",
  "actual_end_at": "2025-03-29T11:08:30+00:00",
  "livekit_room_name": "session-550e8400-e29b-41d4-a716-446655440000"
}
```

### Scenario B: Premature Request (Duration Not Reached)

Request at 30 minutes into a 60-minute session.

```bash
curl -X POST \
  http://localhost:8000/api/v1/sessions/550e8400-e29b-41d4-a716-446655440000/request-session-completion \
  -H "Authorization: Bearer TEACHER_TOKEN" \
  -H "Content-Type: application/json"
```

**Success Response (200)**:

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "booking_id": "660e8400-e29b-41d4-a716-446655440001",
  "status": "IN_PROGRESS",
  "actual_start_at": "2025-03-29T10:00:00+00:00",
  "actual_end_at": null,
  "livekit_room_name": "session-550e8400-e29b-41d4-a716-446655440000"
}
```

Student receives socket event:

```json
{
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "booking_id": "660e8400-e29b-41d4-a716-446655440001",
  "requested_at": "2025-03-29T10:30:00+00:00",
  "remaining_duration_seconds": 1800
}
```

### Error: Duplicate Premature Request (409)

Calling the same endpoint again before student responds.

```bash
curl -X POST \
  http://localhost:8000/api/v1/sessions/550e8400-e29b-41d4-a716-446655440000/request-session-completion \
  -H "Authorization: Bearer TEACHER_TOKEN" \
  -H "Content-Type: application/json"
```

**Error Response (409)**:

```json
{
  "detail": "A premature session completion request already exists for this session"
}
```

### Error: Non-Teacher Caller (403)

```bash
curl -X POST \
  http://localhost:8000/api/v1/sessions/550e8400-e29b-41d4-a716-446655440000/request-session-completion \
  -H "Authorization: Bearer STUDENT_TOKEN" \
  -H "Content-Type: application/json"
```

**Error Response (403)**:

```json
{
  "detail": "Only the teacher can request session completion"
}
```

### Error: Session Not In Progress (400)

```bash
curl -X POST \
  http://localhost:8000/api/v1/sessions/550e8400-e29b-41d4-a716-446655440000/request-session-completion \
  -H "Authorization: Bearer TEACHER_TOKEN" \
  -H "Content-Type: application/json"
```

**Error Response (400)**:

```json
{
  "detail": "Session is not in progress (current: CANCELLED_BY_STUDENT)"
}
```

---

## 2. Accept Session Completion (Student)

Request after teacher has initiated premature completion.

```bash
curl -X POST \
  http://localhost:8000/api/v1/sessions/550e8400-e29b-41d4-a716-446655440000/accept-session-completion \
  -H "Authorization: Bearer STUDENT_TOKEN" \
  -H "Content-Type: application/json"
```

**Success Response (200)**:

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "booking_id": "660e8400-e29b-41d4-a716-446655440001",
  "status": "COMPLETED",
  "actual_start_at": "2025-03-29T10:00:00+00:00",
  "actual_end_at": "2025-03-29T10:31:00+00:00",
  "livekit_room_name": "session-550e8400-e29b-41d4-a716-446655440000"
}
```

Both participants receive socket event:

```json
{
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "booking_id": "660e8400-e29b-41d4-a716-446655440001",
  "duration_seconds": 1860,
  "completed_at": "2025-03-29T10:31:00+00:00"
}
```

### Error: No Pending Request (400)

Calling when teacher never made a request.

```bash
curl -X POST \
  http://localhost:8000/api/v1/sessions/550e8400-e29b-41d4-a716-446655440000/accept-session-completion \
  -H "Authorization: Bearer STUDENT_TOKEN" \
  -H "Content-Type: application/json"
```

**Error Response (400)**:

```json
{
  "detail": "No pending premature session completion request found"
}
```

### Error: Request Expired

Redis key expired (60 seconds without response).

```bash
curl -X POST \
  http://localhost:8000/api/v1/sessions/550e8400-e29b-41d4-a716-446655440000/accept-session-completion \
  -H "Authorization: Bearer STUDENT_TOKEN" \
  -H "Content-Type: application/json"
```

**Error Response (400)**:

```json
{
  "detail": "No pending premature session completion request found"
}
```

### Error: Non-Student Caller (403)

```bash
curl -X POST \
  http://localhost:8000/api/v1/sessions/550e8400-e29b-41d4-a716-446655440000/accept-session-completion \
  -H "Authorization: Bearer TEACHER_TOKEN" \
  -H "Content-Type: application/json"
```

**Error Response (403)**:

```json
{
  "detail": "Only the student can accept session completion"
}
```

---

## 3. Reject Session Completion (Student)

Request after teacher has initiated premature completion.

```bash
curl -X POST \
  http://localhost:8000/api/v1/sessions/550e8400-e29b-41d4-a716-446655440000/reject-session-completion \
  -H "Authorization: Bearer STUDENT_TOKEN" \
  -H "Content-Type: application/json"
```

**Success Response (200)**:

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "booking_id": "660e8400-e29b-41d4-a716-446655440001",
  "status": "IN_PROGRESS",
  "actual_start_at": "2025-03-29T10:00:00+00:00",
  "actual_end_at": null,
  "livekit_room_name": "session-550e8400-e29b-41d4-a716-446655440000"
}
```

Teacher receives socket event:

```json
{
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "booking_id": "660e8400-e29b-41d4-a716-446655440001",
  "rejected_at": "2025-03-29T10:31:00+00:00"
}
```

**Note**: Session remains IN_PROGRESS. No session-ended event is emitted.

### Error: No Pending Request (400)

```bash
curl -X POST \
  http://localhost:8000/api/v1/sessions/550e8400-e29b-41d4-a716-446655440000/reject-session-completion \
  -H "Authorization: Bearer STUDENT_TOKEN" \
  -H "Content-Type: application/json"
```

**Error Response (400)**:

```json
{
  "detail": "No pending premature session completion request found"
}
```

### Error: Non-Student Caller (403)

```bash
curl -X POST \
  http://localhost:8000/api/v1/sessions/550e8400-e29b-41d4-a716-446655440000/reject-session-completion \
  -H "Authorization: Bearer TEACHER_TOKEN" \
  -H "Content-Type: application/json"
```

**Error Response (403)**:

```json
{
  "detail": "Only the student can reject session completion"
}
```

---

## Complete User Flow with Timing

### Timeline Example

Assume a 60-minute session booked (with 8 minutes leniency, total = 68 minutes).

```
10:00:00 - Session starts (actual_start_at set)
10:30:00 - Teacher requests early completion
          ├─ Redis key created: premature_session_completion:{session_id}
          ├─ Socket event sent to student: premature-session-completion-requested
          └─ Remaining: 1800 seconds (30 minutes)

10:30:05 - Student receives socket event
          └─ Shows modal: "Accept (✓) or Reject (✗)"

10:30:30 - Student clicks "Accept"
          ├─ Call: accept-session-completion
          ├─ Session marked COMPLETED
          ├─ Booking counters updated
          ├─ Redis key deleted
          ├─ Session-ended event to both
          └─ Payment processed

Alternative path:

10:30:45 - Student clicks "Reject"
          ├─ Call: reject-session-completion
          ├─ Redis key deleted
          ├─ premature-session-completion-rejected sent to teacher
          └─ Session continues...

11:08:00 - Session reaches 68 minutes (60 + 8 leniency)
          ├─ Teacher calls: request-session-completion
          ├─ Duration check: elapsed_seconds (4080) >= threshold (4080) ✓
          ├─ Auto-complete triggered
          ├─ Session marked COMPLETED
          ├─ Booking counters updated
          ├─ Session-ended event to both
          └─ Payment processed
```

---

## Postman Collection

Import this into Postman for easy testing:

```json
{
  "info": {
    "name": "Session Completion Flow",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Request Session Completion (Premature)",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{TEACHER_TOKEN}}",
            "type": "text"
          }
        ],
        "url": {
          "raw": "{{BASE_URL}}/api/v1/sessions/{{SESSION_ID}}/request-session-completion",
          "host": ["{{BASE_URL}}"],
          "path": [
            "api",
            "v1",
            "sessions",
            "{{SESSION_ID}}",
            "request-session-completion"
          ]
        }
      }
    },
    {
      "name": "Accept Session Completion",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{STUDENT_TOKEN}}",
            "type": "text"
          }
        ],
        "url": {
          "raw": "{{BASE_URL}}/api/v1/sessions/{{SESSION_ID}}/accept-session-completion",
          "host": ["{{BASE_URL}}"],
          "path": [
            "api",
            "v1",
            "sessions",
            "{{SESSION_ID}}",
            "accept-session-completion"
          ]
        }
      }
    },
    {
      "name": "Reject Session Completion",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{STUDENT_TOKEN}}",
            "type": "text"
          }
        ],
        "url": {
          "raw": "{{BASE_URL}}/api/v1/sessions/{{SESSION_ID}}/reject-session-completion",
          "host": ["{{BASE_URL}}"],
          "path": [
            "api",
            "v1",
            "sessions",
            "{{SESSION_ID}}",
            "reject-session-completion"
          ]
        }
      }
    }
  ]
}
```

**Variables to set**:

- `BASE_URL`: http://localhost:8000
- `TEACHER_TOKEN`: Valid JWT token for teacher
- `STUDENT_TOKEN`: Valid JWT token for student
- `SESSION_ID`: Active session UUID
