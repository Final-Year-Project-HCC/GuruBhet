# LiveKit Integration - API Endpoint Reference

---

## Existing Endpoints (Unchanged)

### 1. Create Booking Request

```
POST /api/v1/bookings/request
Content-Type: application/json
Authorization: Bearer <student_token>

{
  "teacher_id": "uuid",
  "subject_id": "uuid",
  "total_sessions": 10,
  "rate_per_session": 500.00,
  "session_duration_minutes": 60
}

Response 201:
{
  "id": "booking-uuid",
  "status": "PENDING_APPROVAL",
  ...
}
```

### 2. Approve Booking

```
POST /api/v1/bookings/{booking_id}/approve
Content-Type: application/json
Authorization: Bearer <teacher_token>

{
  "notes": "Optional approval notes"
}

Response 200:
{
  "id": "booking-uuid",
  "status": "PENDING_PAYMENT",
  ...
}
```

### 3. Initiate Payment

```
POST /api/v1/bookings/{booking_id}/initiate-payment
Authorization: Bearer <student_token>

No body

Response 200:
{
  "transaction_uuid": "txn-uuid",
  "total_amount": "5000.00",
  "esewa_url": "https://esewa.com.np/epay/main?..."
}
```

### 4. List Bookings

```
GET /api/v1/bookings/
Authorization: Bearer <token>

Response 200:
[
  {
    "id": "booking-uuid",
    "status": "ACTIVE",
    "sessions": [...]
  },
  ...
]
```

### 5. Get Booking Details

```
GET /api/v1/bookings/{booking_id}
Authorization: Bearer <token>

Response 200:
{
  "id": "booking-uuid",
  "student_id": "student-uuid",
  "teacher_id": "teacher-uuid",
  "status": "ACTIVE",
  "sessions": [...]
}
```

### 6. Cancel Booking

```
POST /api/v1/bookings/{booking_id}/cancel
Content-Type: application/json
Authorization: Bearer <token>

{
  "reason": "Cancellation reason"
}

Response 200:
{
  "id": "booking-uuid",
  "status": "CANCELLED_BY_STUDENT",
  ...
}
```

---

## NEW Endpoints with LiveKit

### 7. Teacher Initiates Session ⭐

```
POST /api/v1/bookings/{booking_id}/start-session
Authorization: Bearer <teacher_token>

No body

Response 200: SessionRead
{
  "id": "session-uuid",
  "booking_id": "booking-uuid",
  "session_number": 1,
  "status": "PENDING_STUDENT_ACCEPTANCE",
  "teacher_initiated_at": "2026-03-24T10:45:00.000Z",
  "student_accepted_at": null,
  "livekit_room_name": null,
  "actual_start_at": null,
  "actual_end_at": null
}

Errors:
- 403 "Only teachers can initiate sessions"
- 400 "Booking must be ACTIVE to start sessions"
- 400 "All N sessions have already been created"
```

---

### 8. Student Accepts Session ⭐ NEW

```
POST /api/v1/bookings/{booking_id}/accept-session
Authorization: Bearer <student_token>

No body

Response 200: LiveKitTokenResponse
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "room_name": "session-<uuid>",
  "livekit_url": "https://livekit.example.com"
}

Errors:
- 403 "Only students can accept sessions"
- 410 "Session acceptance window expired. Teacher must request again."
- 404 "Booking not found"
- 404 "Session not found"

Key Features:
✅ Must call within 60 seconds of teacher initiating
✅ Creates LiveKit SFU room immediately
✅ Sets session to READY status
✅ Webhook will transition READY → IN_PROGRESS
✅ Returns LiveKit token for immediate access
```

---

### 9. Sync Session (Get Fresh Token) ⭐ NEW

```
GET /api/v1/bookings/{booking_id}/sync
Authorization: Bearer <access_token>

No body

Response 200: LiveKitTokenResponse
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "room_name": "session-<uuid>",
  "livekit_url": "https://livekit.example.com"
}

Errors:
- 403 "Not your booking"
- 403 "Session window expired. Window closed at..."
- 410 "Booking is no longer active"
- 410 "No active session found"
- 404 "Booking not found"

Key Features:
✅ Both teacher and student can call (same endpoint)
✅ For reconnection/page refresh recovery
✅ Validates session is IN_PROGRESS (via webhook)
✅ Checks leniency window (configurable per 15 minutes)
✅ Records join timestamps:
   - teacher_joined_at (if teacher calls)
   - student_joined_at (if student calls)
✅ Returns fresh JWT token
```

---

### 10. Complete Session (Existing, in sessions.py)

```
POST /api/v1/sessions/{session_id}/complete
Authorization: Bearer <teacher_token>

No body

Response 200: SessionRead
{
  "id": "session-uuid",
  "status": "COMPLETED",
  "actual_end_at": "2026-03-24T11:47:00.000Z",
  ...
}

Effects:
✅ Marks session COMPLETED
✅ Sets actual_end_at
✅ Tears down LiveKit room
✅ Creates SESSION_RELEASE transaction
✅ Updates booking counters
```

---

## Complete Flow Example

```bash
# 1. Student creates booking
curl -X POST http://localhost:8000/api/v1/bookings/request \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "teacher_id": "teacher-uuid",
    "subject_id": "subject-uuid",
    "total_sessions": 5,
    "rate_per_session": 500,
    "session_duration_minutes": 60
  }'
# Response: Booking { status: "PENDING_APPROVAL", ... }

# 2. Teacher approves
curl -X POST http://localhost:8000/api/v1/bookings/$BOOKING_ID/approve \
  -H "Authorization: Bearer $TEACHER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"notes": "Looks good!"}'
# Response: Booking { status: "PENDING_PAYMENT", ... }

# 3. Student initiates payment
curl -X POST http://localhost:8000/api/v1/bookings/$BOOKING_ID/initiate-payment \
  -H "Authorization: Bearer $STUDENT_TOKEN"
# Response: { esewa_url: "...", ... }
# [Frontend redirects, payment happens, callback triggers]
# Booking status now: ACTIVE

# 4. Teacher requests session
curl -X POST http://localhost:8000/api/v1/bookings/$BOOKING_ID/request-session \
  -H "Authorization: Bearer $TEACHER_TOKEN"
# Response: {
#   status: "ready",
#   completed_sessions: 0,
#   total_sessions: 5,
#   remaining_sessions: 5,
#   online_status: "online",
#   ...
# }

# 5. Student accepts (within 60 seconds)
curl -X POST http://localhost:8000/api/v1/bookings/$BOOKING_ID/accept-session \
  -H "Authorization: Bearer $STUDENT_TOKEN"
# Response: LiveKitTokenResponse {
#   token: "eyJhbGc...",
#   room_name: "session-uuid",
#   livekit_url: "https://livekit.example.com"
# }
# Side effect: Session created with status READY

# [Webhook fires: LiveKit room_started event triggers]
# [Session status: READY → IN_PROGRESS, actual_start_at set]

# 6. Teacher syncs to get fresh token
curl -X GET http://localhost:8000/api/v1/bookings/$BOOKING_ID/sync \
  -H "Authorization: Bearer $TEACHER_TOKEN"
# Response: {
#   token: "eyJhbGc...",
#   room_name: "session-uuid",
#   livekit_url: "https://livekit.example.com"
# }
# Side effect: teacher_joined_at recorded

# 7. Student syncs to get fresh token
curl -X GET http://localhost:8000/api/v1/bookings/$BOOKING_ID/sync \
  -H "Authorization: Bearer $STUDENT_TOKEN"
# Response: {
#   token: "eyJhbGc...",
#   room_name: "session-uuid",
#   livekit_url: "https://livekit.example.com"
# }
# Side effect: student_joined_at recorded

# [Both connect to LiveKit, stream begins]

# 8. Teacher completes session (from sessions endpoint)
curl -X POST http://localhost:8000/api/v1/sessions/$SESSION_ID/complete \
  -H "Authorization: Bearer $TEACHER_TOKEN"
# Response: Session { status: "COMPLETED", actual_end_at: "...", ... }
# Side effects: Room torn down, transaction created

# [Repeat steps 4-8 for remaining sessions]
```

---

## Response Models

### SessionRead (Response for request-session, reject-session endpoints)

```json
{
  "id": "uuid",
  "booking_id": "uuid",
  "session_number": 1,
  "status": "READY | IN_PROGRESS | COMPLETED | CANCELLED_BY_*",
  "livekit_room_name": "session-uuid or null",
  "teacher_initiated_at": "ISO 8601 timestamp or null",
  "student_accepted_at": "ISO 8601 timestamp or null",
  "actual_start_at": "ISO 8601 timestamp or null",
  "actual_end_at": "ISO 8601 timestamp or null"
}
```

### LiveKitTokenResponse (Response for accept-session and sync endpoints)

```json
{
  "token": "JWT token signed by LiveKit private key",
  "room_name": "session-uuid-based-identifier",
  "livekit_url": "https://livekit.example.com"
}
```

### BookingRead (Comprehensive booking response)

```json
{
  "id": "uuid",
  "student_id": "uuid",
  "teacher_id": "uuid",
  "subject_id": "uuid",
  "total_sessions": 10,
  "completed_sessions": 0,
  "cancelled_sessions": 0,
  "rate_per_session": "500.00",
  "session_duration_minutes": 60,
  "total_amount": "5000.00",
  "refunded_amount": "0.00",
  "status": "PENDING_APPROVAL | PENDING_PAYMENT | ACTIVE | COMPLETED | CANCELLED_BY_*",
  "teacher_approved_at": "ISO 8601 timestamp or null",
  "teacher_approval_notes": "string or null",
  "created_at": "ISO 8601 timestamp",
  "sessions": [SessionRead, ...]
}
```

---

## Status Transitions

```
Session Lifecycle:
PENDING_STUDENT_ACCEPTANCE
    ↓ (student accepts within 1 min)
SCHEDULED
    ↓ (first person gets token)
IN_PROGRESS
    ↓ (teacher completes)
COMPLETED

Or at any time:
    ↓ (either cancels)
CANCELLED_BY_STUDENT / CANCELLED_BY_TEACHER
```

---

## Key Validation Rules

### Accept Endpoint

| Rule           | Validation                           | Error |
| -------------- | ------------------------------------ | ----- |
| Caller         | Must be STUDENT                      | 403   |
| Session Status | Must be PENDING_STUDENT_ACCEPTANCE   | 400   |
| Time Window    | (now - teacher_initiated_at) ≤ 1 min | 400   |
| Ownership      | Student must own booking             | 403   |

### LiveKit Token Endpoint

| Rule           | Validation                            | Error |
| -------------- | ------------------------------------- | ----- |
| Caller         | Must be teacher or student of booking | 403   |
| Session Status | Must be SCHEDULED or IN_PROGRESS      | 400   |
| Booking Status | Must be ACTIVE                        | 400   |
| Room Created   | livekit_room_name must exist          | 500   |

---

## Query Parameters

None. All endpoints use path parameters and bearer token authentication.

---

## Rate Limiting

Not specified; inherit from API gateway settings.

---

## Idempotency

- **Accept endpoint:** ❌ Not idempotent (will error if called twice on same session)
- **Token endpoint:** ✅ Idempotent (safe to call multiple times, returns same token)
- **Initiate endpoint:** ✅ Idempotent within same booking (creates new session each call)

---

## Webhook Events (Future)

When implemented, these events could be triggered:

```
SessionInitiated
{
  session_id: uuid,
  booking_id: uuid,
  timestamp: ISO 8601,
  teacher_id: uuid,
}

SessionAccepted
{
  session_id: uuid,
  booking_id: uuid,
  timestamp: ISO 8601,
  student_id: uuid,
  livekit_room_name: string,
}

SessionStarted (first person joined)
{
  session_id: uuid,
  booking_id: uuid,
  timestamp: ISO 8601,
  first_joiner_id: uuid,
}

SessionCompleted
{
  session_id: uuid,
  booking_id: uuid,
  timestamp: ISO 8601,
  duration_seconds: int,
}
```
