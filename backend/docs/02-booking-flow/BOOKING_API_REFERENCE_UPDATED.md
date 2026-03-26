# Booking API Quick Reference (Updated)

## Endpoints

### 1. Create Booking Request

```
POST /api/v1/bookings/request
Authorization: Bearer <student_access_token>

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
  "student_id": "student-uuid",
  "teacher_id": "teacher-uuid",
  "subject_id": "subject-uuid",
  "total_sessions": 10,
  "completed_sessions": 0,
  "cancelled_sessions": 0,
  "rate_per_session": 500.00,
  "session_duration_minutes": 60,
  "total_amount": 5000.00,
  "refunded_amount": 0.00,
  "status": "PENDING_APPROVAL",
  "teacher_approved_at": null,
  "teacher_approval_notes": null,
  "created_at": "2026-03-24T10:00:00Z",
  "sessions": []
}
```

---

### 2. Approve Booking Request

```
POST /api/v1/bookings/{booking_id}/approve
Authorization: Bearer <teacher_access_token>

{
  "notes": "Looking forward to teaching you!"
}

Response 200:
{
  "id": "booking-uuid",
  "status": "PENDING_PAYMENT",  // ← Changed
  "teacher_approved_at": "2026-03-24T10:30:00Z",  // ← Set
  "teacher_approval_notes": "Looking forward to teaching you!",  // ← Set
  "session_duration_minutes": 60,
  // ... rest of booking fields
}
```

---

### 3. Initiate Payment

```
POST /api/v1/bookings/{booking_id}/initiate-payment
Authorization: Bearer <student_access_token>

No body required.

Response 200:
{
  "transaction_uuid": "txn-uuid",
  "total_amount": "5000.00",
  "esewa_url": "https://esewa.com.np/epay/main?amt=5000&psc=0&pdc=0&txAmt=5000&tAmt=5000&pid=BOOKING-{booking_id}&scd=ESEWA_PAYMENT&su=http://frontend.app/bookings/{booking_id}/success&fu=http://frontend.app/bookings/{booking_id}/failed"
}
```

Frontend redirects user to `esewa_url`.

---

### 4. eSewa Callback (Automated - Step 4)

```
POST /api/v1/payments/esewa/callback
(No auth required; verified via HMAC)

On success:
- Booking status: PENDING_PAYMENT → ACTIVE
- Create BOOKING_ESCROW transaction
- Sessions ready to be created on-demand

On failure:
- Booking status: → CANCELLED_BY_STUDENT
- No funds charged
```

---

### 5a. Teacher Initiates Session Request

```
POST /api/v1/bookings/{booking_id}/start-session
Authorization: Bearer <teacher_access_token>

No body required.

Response 200:
{
  "id": "booking-uuid",
  "status": "ACTIVE",
  "total_sessions": 10,
  "completed_sessions": 0,
  "cancelled_sessions": 0,
  "session_duration_minutes": 60,
  "sessions": [
    {
      "id": "session-1-uuid",
      "booking_id": "booking-uuid",
      "session_number": 1,
      "status": "PENDING_STUDENT_ACCEPTANCE",  // ← Waiting for student
      "teacher_initiated_at": "2026-03-24T10:45:00Z",
      "student_accepted_at": null,
      "livekit_room_name": null,
      "actual_start_at": null,
      "actual_end_at": null
    }
  ]
  // ... rest of booking fields
}
```

---

### 5b. Student Accepts Session Request

```
POST /api/v1/bookings/{booking_id}/sessions/{session_id}/accept
Authorization: Bearer <student_access_token>

No body required.

Response 200:
{
  "id": "booking-uuid",
  "status": "ACTIVE",
  "sessions": [
    {
      "id": "session-1-uuid",
      "booking_id": "booking-uuid",
      "session_number": 1,
      "status": "SCHEDULED",  // ← Now ready to join
      "teacher_initiated_at": "2026-03-24T10:45:00Z",
      "student_accepted_at": "2026-03-24T10:48:00Z",  // ← Set on accept
      "livekit_room_name": null,
      "actual_start_at": null,
      "actual_end_at": null
    }
  ]
  // ... rest of booking fields
}
```

---

## List Bookings

```
GET /api/v1/bookings/
Authorization: Bearer <access_token>

Response 200:
[
  {
    "id": "booking-uuid",
    "student_id": "student-uuid",
    "teacher_id": "teacher-uuid",
    "status": "ACTIVE",
    "session_duration_minutes": 60,
    // ... all booking fields
  },
  // ... more bookings
]
```

---

## Get Single Booking

```
GET /api/v1/bookings/{booking_id}
Authorization: Bearer <access_token>

Response 200:
{
  "id": "booking-uuid",
  "student_id": "student-uuid",
  "teacher_id": "teacher-uuid",
  "status": "ACTIVE",
  "session_duration_minutes": 60,
  // ... all booking fields including sessions
}
```

---

## Cancel Booking

```
POST /api/v1/bookings/{booking_id}/cancel
Authorization: Bearer <access_token>

{
  "reason": "Teacher is unavailable"
}

Response 200:
{
  "id": "booking-uuid",
  "status": "CANCELLED_BY_STUDENT",  // or CANCELLED_BY_TEACHER
  "cancellation_reason": "Teacher is unavailable",
  "cancelled_at": "2026-03-24T11:00:00Z",
  // ... rest of booking fields
}
```

---

## Status Codes

| Code | Meaning                                       |
| ---- | --------------------------------------------- |
| 200  | Success                                       |
| 201  | Created                                       |
| 400  | Bad request (validation error)                |
| 401  | Unauthorized (auth required or invalid token) |
| 403  | Forbidden (wrong role or not your booking)    |
| 404  | Not found                                     |
| 500  | Server error                                  |

---

## Error Responses

```json
{
  "detail": "Only students can create booking requests"
}
```

---

## Common Errors

| Error                                       | Cause                                             | Fix                                  |
| ------------------------------------------- | ------------------------------------------------- | ------------------------------------ |
| "Duration must be a multiple of 15 minutes" | Invalid session_duration_minutes                  | Use 15, 30, 45, 60, 75, 90, etc.     |
| "Only teachers can approve bookings"        | Non-teacher tried to approve                      | Use teacher account                  |
| "Booking cannot be paid in status X"        | Wrong status for payment                          | Check booking status                 |
| "All N sessions have already been created"  | Tried to create more sessions than total_sessions | No more sessions needed              |
| "Booking must be ACTIVE to start sessions"  | Tried to create session before payment            | Initiate and complete payment first  |
| "Not your booking"                          | Accessing someone else's booking                  | Use correct booking_id for your role |
| "Booking not found"                         | Invalid booking_id                                | Verify booking_id exists             |

---

## Flow Summary

```
Student                         Teacher                     System
────────────────────────────────────────────────────────────────────

POST /bookings/request
(teacher_id, subject_id, total_sessions, rate, duration)
    ├─> Booking created (PENDING_APPROVAL)
    └─> Teacher gets notification

                                POST /bookings/{id}/approve
                                    ├─> Booking → PENDING_PAYMENT
                                    └─> Student gets notification

POST /bookings/{id}/initiate-payment
    ├─> Receives eSewa URL
    └─> Redirects to eSewa

                                        POST /payments/esewa/callback
                                            ├─> Booking → ACTIVE
                                            └─> BOOKING_ESCROW transaction

[Whenever both agree to have a session]

POST /bookings/{id}/start-session  (by student or teacher)
    └─> Session #1 created (SCHEDULED)
    └─> Session duration = booking.session_duration_minutes

[Session progresses]

    [Both join LiveKit]
    └─> Session #1 → IN_PROGRESS

    [Teaching happens for agreed time]
    └─> Session #1 → COMPLETED

[Repeat for sessions #2-#N as needed]

[All sessions completed]

Booking → COMPLETED
```

---

## Roles

| Endpoint                                  | Student        | Teacher        | Admin  |
| ----------------------------------------- | -------------- | -------------- | ------ |
| POST /bookings/request                    | ✅             | ❌             | ❌     |
| POST /bookings/{id}/approve               | ❌             | ✅             | ❌     |
| POST /bookings/{id}/initiate-payment      | ✅             | ❌             | ❌     |
| POST /bookings/{id}/start-session         | ❌             | ✅ (initiates) | ❌     |
| POST /bookings/{id}/sessions/{sid}/accept | ✅             | ❌             | ❌     |
| GET /bookings/                            | ✅ own         | ✅ own         | ✅ all |
| GET /bookings/{id}                        | ✅ if involved | ✅ if involved | ✅     |
| POST /bookings/{id}/cancel                | ✅ if owner    | ✅ if owner    | ✅     |

---

## Booking Statuses

| Status               | Can transition to          | Notes                            |
| -------------------- | -------------------------- | -------------------------------- |
| PENDING_APPROVAL     | PENDING_PAYMENT            | Awaiting teacher approval        |
| PENDING_PAYMENT      | ACTIVE, CANCELLED*BY*\*    | Awaiting student payment         |
| ACTIVE               | COMPLETED, CANCELLED*BY*\* | Sessions being created on-demand |
| COMPLETED            | (terminal)                 | All sessions done                |
| CANCELLED_BY_STUDENT | (terminal)                 | Student cancelled                |
| CANCELLED_BY_TEACHER | (terminal)                 | Teacher cancelled                |
| DISPUTED             | (terminal)                 | Under moderation                 |

---

## Session Statuses

| Status          | When                      | Next        |
| --------------- | ------------------------- | ----------- |
| SCHEDULED       | Created via start-session | IN_PROGRESS |
| IN_PROGRESS     | First participant joins   | COMPLETED   |
| COMPLETED       | Session time ends         | (terminal)  |
| CANCELLED*BY*\* | Cancelled before end      | (terminal)  |

---

## Session Duration Values (Multiples of 15)

Valid values:

- 15 minutes
- 30 minutes
- 45 minutes
- 60 minutes (1 hour)
- 75 minutes
- 90 minutes (1.5 hours)
- 105 minutes
- 120 minutes (2 hours)
- 135 minutes
- 150 minutes (2.5 hours)
- ... and so on

---

## Example: Full Flow

```bash
# 1. Student creates request with duration
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
# Returns booking with status PENDING_APPROVAL

# 2. Teacher approves
curl -X POST http://localhost:8000/api/v1/bookings/{booking_id}/approve \
  -H "Authorization: Bearer $TEACHER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"notes": "Looks good!"}'
# Returns booking with status PENDING_PAYMENT

# 3. Student initiates payment
curl -X POST http://localhost:8000/api/v1/bookings/{booking_id}/initiate-payment \
  -H "Authorization: Bearer $STUDENT_TOKEN"
# Returns eSewa URL; frontend redirects user

# 4. (Automatic) eSewa callback
# ... user pays on eSewa ...
# Booking status → ACTIVE

# 5. Later, start first session (student initiates)
curl -X POST http://localhost:8000/api/v1/bookings/{booking_id}/start-session \
  -H "Authorization: Bearer $STUDENT_TOKEN"
# Session #1 created with 60-minute duration

# 6. Start second session (teacher initiates)
curl -X POST http://localhost:8000/api/v1/bookings/{booking_id}/start-session \
  -H "Authorization: Bearer $TEACHER_TOKEN"
# Session #2 created with 60-minute duration

# ... repeat for remaining 3 sessions ...
```

---

## Notes

- All timestamps are UTC (timezone-aware).
- All monetary amounts are `Decimal` to prevent floating-point errors.
- Session numbers are 1-based within a booking.
- Session duration is fixed for all sessions in a booking (inherited from booking).
- Sessions can be created in any order; session_number is assigned sequentially.
