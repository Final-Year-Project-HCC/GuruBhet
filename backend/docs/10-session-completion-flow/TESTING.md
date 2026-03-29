# Session Completion Flow - Integration Tests

This document outlines how to test the session completion flow.

## Test Scenarios

### Scenario 1: Auto-Complete (Duration + Leniency Reached)

**Setup**:

- Create a 60-minute session booking
- Start the session, wait until `actual_start_at + 60min + leniency` has elapsed
- Leniency: (60 / 15) × 2 = 8 minutes, so total = 68 minutes

**Test Steps**:

1. Call `/api/v1/sessions/{session_id}/request-session-completion` as teacher
2. Verify response is 200 OK
3. Verify `session.status` = COMPLETED
4. Verify `booking.completed_sessions` incremented
5. Verify `session-ended` socket event emitted
6. Verify LiveKit room torn down
7. Verify Celery tasks triggered

**Expected Socket Events**:

- `session-ended` to both participants

---

### Scenario 2: Premature Request (Duration Not Reached)

**Setup**:

- Create a 60-minute session
- Start session
- Wait 30 minutes (half duration)

**Test Steps**:

1. Call `/api/v1/sessions/{session_id}/request-session-completion` as teacher
2. Verify response is 200 OK
3. Verify Redis key `premature_session_completion:{session_id}` exists with 60s TTL
4. Verify `premature-session-completion-requested` socket event sent to student
5. Verify `remaining_duration_seconds` ≈ 1800 (30 minutes)
6. Verify session.status still IN_PROGRESS

---

### Scenario 3: Duplicate Premature Request

**Setup**:

- Same as Scenario 2, with Redis key already set

**Test Steps**:

1. Call `/api/v1/sessions/{session_id}/request-session-completion` again as teacher
2. Verify response is 409 Conflict
3. Verify error message mentions "request already exists"

---

### Scenario 4: Student Accepts Premature Completion

**Setup**:

- Scenario 2 completed (premature request pending)

**Test Steps**:

1. Call `/api/v1/sessions/{session_id}/accept-session-completion` as student
2. Verify response is 200 OK
3. Verify `session.status` = COMPLETED
4. Verify Redis key deleted
5. Verify `session-ended` socket event emitted
6. Verify payment processed
7. Verify booking counters updated

**Expected Socket Events**:

- `session-ended` to both participants
- No other events

---

### Scenario 5: Student Rejects Premature Completion

**Setup**:

- Scenario 2 completed (premature request pending)

**Test Steps**:

1. Call `/api/v1/sessions/{session_id}/reject-session-completion` as student
2. Verify response is 200 OK
3. Verify Redis key deleted
4. Verify `session.status` still IN_PROGRESS
5. Verify `premature-session-completion-rejected` socket event sent to teacher
6. Verify NO payment processed
7. Verify NO booking counters updated

**Expected Socket Events**:

- `premature-session-completion-rejected` to teacher only

---

### Scenario 6: Accept Without Pending Request

**Setup**:

- Session is IN_PROGRESS
- No Redis key exists

**Test Steps**:

1. Call `/api/v1/sessions/{session_id}/accept-session-completion` as student
2. Verify response is 400 Bad Request
3. Verify error message mentions "No pending request"

---

### Scenario 7: Reject Without Pending Request

**Setup**:

- Session is IN_PROGRESS
- No Redis key exists

**Test Steps**:

1. Call `/api/v1/sessions/{session_id}/reject-session-completion` as student
2. Verify response is 400 Bad Request
3. Verify error message mentions "No pending request"

---

### Scenario 8: Request as Non-Teacher

**Setup**:

- Session is IN_PROGRESS
- Current user is student

**Test Steps**:

1. Call `/api/v1/sessions/{session_id}/request-session-completion` as student
2. Verify response is 403 Forbidden

---

### Scenario 9: Accept as Non-Student

**Setup**:

- Premature request pending
- Current user is teacher

**Test Steps**:

1. Call `/api/v1/sessions/{session_id}/accept-session-completion` as teacher
2. Verify response is 403 Forbidden

---

### Scenario 10: Redis Key Expiration

**Setup**:

- Premature request created
- Wait 61+ seconds

**Test Steps**:

1. Call `/api/v1/sessions/{session_id}/accept-session-completion` as student
2. Verify response is 400 Bad Request (key expired)
3. Verify error message mentions "No pending request"

---

## Manual Testing with cURL

### Request Session Completion

```bash
curl -X POST http://localhost:8000/api/v1/sessions/{session_id}/request-session-completion \
  -H "Authorization: Bearer {teacher_token}"
```

### Accept Session Completion

```bash
curl -X POST http://localhost:8000/api/v1/sessions/{session_id}/accept-session-completion \
  -H "Authorization: Bearer {student_token}"
```

### Reject Session Completion

```bash
curl -X POST http://localhost:8000/api/v1/sessions/{session_id}/reject-session-completion \
  -H "Authorization: Bearer {student_token}"
```

---

## Socket.IO Testing

Use a WebSocket client to:

1. Connect as student
2. Join room `user:{student_id}`
3. Listen for `premature-session-completion-requested` event
4. Verify payload contains correct session/booking IDs and remaining duration

Alternatively, for teacher:

1. Connect as teacher
2. Join room `user:{teacher_id}`
3. Listen for `premature-session-completion-rejected` event
4. Verify payload contains correct session/booking IDs

---

## Database Verification

After tests, verify:

```sql
-- Check session status
SELECT id, booking_id, status, actual_start_at, actual_end_at
FROM sessions
WHERE id = '{session_id}';

-- Check booking counters
SELECT id, completed_sessions, total_sessions, status
FROM bookings
WHERE id = '{booking_id}';

-- Check transaction created
SELECT id, user_id, type, reason, amount
FROM transactions
WHERE booking_id = '{booking_id}'
  AND reason = 'SESSION_RELEASE';
```

---

## Redis Verification

```bash
# Check if premature completion key exists
redis-cli GET "premature_session_completion:{session_id}"

# Should return nil after 60 seconds or after accept/reject
```
