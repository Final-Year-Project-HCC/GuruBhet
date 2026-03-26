# GuruBhet Booking Flow (Updated)

## Overview

The booking flow is a simplified multi-step process where students request bookings with session duration, teachers approve them, students pay, and then sessions are created on-demand with mutual agreement.

**Key change:** Sessions are NOT pre-scheduled. Both student and teacher must agree when to hold each session.

---

## Flow Steps

### Step 1: Student Creates Booking Request

**Endpoint:** `POST /api/v1/bookings/request`

**Request Body:**

```json
{
  "teacher_id": "uuid",
  "subject_id": "uuid",
  "total_sessions": 10,
  "rate_per_session": 500.0,
  "session_duration_minutes": 60
}
```

**Validation:**

- `total_sessions` must be > 0
- `rate_per_session` must be > 0
- `session_duration_minutes` must be a multiple of 15 (15, 30, 45, 60, 75, 90, etc.)

**What happens:**

- Student specifies a teacher, subject, number of sessions, rate per session, and **session duration**.
- A Booking record is created with status `PENDING_APPROVAL`.
- Total amount is calculated: `total_sessions * rate_per_session`
- The teacher receives a notification about the booking request.
- **Sessions are NOT created at this point.**

**Response:**

- Returns the created Booking with `PENDING_APPROVAL` status.

---

### Step 2: Teacher Approves/Rejects Booking Request

**Endpoint:** `POST /api/v1/bookings/{booking_id}/approve`

**Request Body:**

```json
{
  "notes": "Looking forward to teaching you!"
}
```

**What happens:**

- Teacher reviews the booking request and decides to approve or reject.
- If approved:
  - Booking status moves from `PENDING_APPROVAL` to `PENDING_PAYMENT`.
  - `teacher_approved_at` timestamp is recorded.
  - `teacher_approval_notes` are stored.

**Response:**

- Returns the updated Booking with `PENDING_PAYMENT` status.

---

### Step 3: Student Initiates Payment

**Endpoint:** `POST /api/v1/bookings/{booking_id}/initiate-payment`

**What happens:**

- Student initiates payment for the booking.
- Booking must be in `PENDING_PAYMENT` status.
- Returns eSewa payment initialization parameters.
- Frontend redirects user to eSewa.
- **No session pre-scheduling required.**

**Response:**

```json
{
  "transaction_uuid": "uuid",
  "total_amount": "5000.00",
  "esewa_url": "https://esewa.com.np/..."
}
```

---

### Step 4: eSewa Payment Callback (Automated)

**Endpoint:** `POST /api/v1/payments/esewa/callback`

**What happens:**

- After user completes (or fails) payment on eSewa, eSewa POSTs to this callback.
- **On SUCCESS:**
  - Booking status changes from `PENDING_PAYMENT` to `ACTIVE`.
  - Escrow amount is captured in student's account.
  - `BOOKING_ESCROW` transaction is recorded.
  - **Sessions are now ready to be created on-demand.**
- **On FAILURE:**
  - Booking status changes to `CANCELLED_BY_STUDENT`.
  - No funds are captured.

---

### Step 5: Sessions Created On-Demand

**Endpoint:** `POST /api/v1/bookings/{booking_id}/start-session`

**When called:**

- Either student or teacher can initiate.
- Only when booking is in `ACTIVE` status.
- Requires mutual agreement between both parties.

**What happens:**

- Creates a new Session record.
- Session inherits the `session_duration_minutes` from the Booking.
- Session starts with status `SCHEDULED` (waiting for both to join).
- Session gets a sequential `session_number` (1, 2, 3, ..., up to `total_sessions`).
- Once `total_sessions` sessions have been created, no more sessions can be added.

**Response:**

- Returns the updated Booking.

**Example flow:**

1. Booking is ACTIVE with 10 total_sessions and 60-minute duration
2. Student calls `/bookings/{id}/start-session` on a convenient time
3. Session #1 is created with status SCHEDULED
4. Student and teacher join the LiveKit room
5. Session transitions to IN_PROGRESS
6. After 60 minutes (or agreed-upon time), session completes
7. Later, when both agree, one of them initiates the next session
8. This repeats until all 10 sessions are created and completed

---

## Booking Statuses

| Status                 | Meaning                                                 | Transitions To                                                   |
| ---------------------- | ------------------------------------------------------- | ---------------------------------------------------------------- |
| `PENDING_APPROVAL`     | Awaiting teacher approval                               | `PENDING_PAYMENT` (if approved)                                  |
| `PENDING_PAYMENT`      | Approved, awaiting student payment                      | `ACTIVE` (on successful payment)                                 |
| `ACTIVE`               | Payment received, sessions can be created and completed | `COMPLETED` (all sessions done), `CANCELLED_BY_*` (if cancelled) |
| `COMPLETED`            | All sessions finished                                   | (terminal)                                                       |
| `CANCELLED_BY_STUDENT` | Student cancelled the booking                           | (terminal)                                                       |
| `CANCELLED_BY_TEACHER` | Teacher cancelled the booking                           | (terminal)                                                       |
| `DISPUTED`             | Booking under dispute (moderation)                      | (terminal or resolved)                                           |

---

## Session Lifecycle

### Session Creation

- Sessions are created on-demand via `POST /bookings/{id}/start-session`
- Each booking can have at most `booking.total_sessions` sessions
- Session duration is fixed at `booking.session_duration_minutes`

### Session Status Flow

```
SCHEDULED
   ↓
(First participant joins LiveKit room)
   ↓
IN_PROGRESS
   ↓
(Session completes or cancelled)
   ↓
COMPLETED or CANCELLED_BY_*
```

---

## Key Differences from Previous Flow

| Previous                               | New                             |
| -------------------------------------- | ------------------------------- |
| Sessions pre-scheduled at booking time | Sessions created on-demand      |
| Fixed schedule grid                    | Flexible timing                 |
| Student must provide all session times | No session times needed upfront |
| Session duration provided per-session  | Duration agreed upon in booking |
| Higher coordination overhead           | Lower overhead, more flexible   |

---

## Customizable Duration Validation

Session duration must be a multiple of 15 minutes:

- Valid: 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, ...
- Invalid: 25, 50, 55, 70, 80, ...

This ensures compatibility with standard time slots (15-minute increments).

---

## Cancellation Policy

### Before Payment (PENDING_APPROVAL or PENDING_PAYMENT)

- Either party can cancel without penalty.
- Booking status becomes `CANCELLED_BY_*`.
- No funds are captured or refunded.

### After Payment (ACTIVE)

- If sessions are completed, booking moves to `COMPLETED` (no refund).
- If sessions are cancelled mid-way:
  - Refund is calculated as: `(total_sessions - completed_sessions) * rate_per_session`.
  - A refund task is queued via Celery.

---

## Role-Based Access

| Endpoint                               | Student | Teacher | Notes                   |
| -------------------------------------- | ------- | ------- | ----------------------- |
| `POST /bookings/request`               | ✅      | ❌      | Student creates request |
| `POST /bookings/{id}/approve`          | ❌      | ✅      | Teacher approves        |
| `POST /bookings/{id}/initiate-payment` | ✅      | ❌      | Student pays            |
| `POST /bookings/{id}/start-session`    | ✅      | ✅      | Either can initiate     |
| `GET /bookings/`                       | ✅      | ✅      | List own bookings       |
| `GET /bookings/{id}`                   | ✅      | ✅      | View if involved        |
| `POST /bookings/{id}/cancel`           | ✅      | ✅      | Cancel if involved      |

---

## Data Model

### Booking Table

**Key fields:**

- `student_id` (UUID) — student
- `teacher_id` (UUID) — teacher
- `subject_id` (UUID) — subject
- `total_sessions` (Int) — agreed number of sessions
- `completed_sessions` (Int) — sessions completed so far
- `cancelled_sessions` (Int) — sessions cancelled
- `rate_per_session` (Decimal) — per-session rate
- `session_duration_minutes` (Int, multiple of 15) — **NEW**
- `status` (BookingStatus) — current status
- `teacher_approved_at` (DateTime) — when teacher approved
- `teacher_approval_notes` (Text) — teacher's notes

### Session Table

**Removed fields:**

- ~~`scheduled_at`~~ — no longer pre-scheduled
- ~~`duration_minutes`~~ — inherited from booking

**Remaining fields:**

- `booking_id` (UUID) — parent booking
- `session_number` (Int) — 1-based sequential number
- `status` (SessionStatus) — SCHEDULED, IN*PROGRESS, COMPLETED, CANCELLED_BY*\*
- `livekit_room_name` (Text) — LiveKit room for this session
- `actual_start_at` (DateTime) — when session started
- `actual_end_at` (DateTime) — when session ended
- `teacher_joined_at` (DateTime) — when teacher joined
- `student_joined_at` (DateTime) — when student joined

---

## API Summary

| Method | Endpoint                          | Step | Status Change                      |
| ------ | --------------------------------- | ---- | ---------------------------------- |
| POST   | `/bookings/request`               | 1    | — → PENDING_APPROVAL               |
| POST   | `/bookings/{id}/approve`          | 2    | PENDING_APPROVAL → PENDING_PAYMENT |
| POST   | `/bookings/{id}/initiate-payment` | 3    | — (returns eSewa params)           |
| POST   | `/payments/esewa/callback`        | 4    | PENDING_PAYMENT → ACTIVE           |
| POST   | `/bookings/{id}/start-session`    | 5    | — (creates session)                |
| GET    | `/bookings/`                      | —    | list filtered by user              |
| GET    | `/bookings/{id}`                  | —    | fetch single booking               |
| POST   | `/bookings/{id}/cancel`           | —    | → CANCELLED*BY*\*                  |

---

## Example Timeline

```
Day 1, 10:00 AM
└─ Student sends booking request:
   - teacher: John (id=...)
   - subject: Physics
   - total_sessions: 5
   - rate: 500 NPR
   - duration: 60 minutes
   Status: PENDING_APPROVAL

Day 1, 2:30 PM
└─ Teacher approves booking
   Status: PENDING_PAYMENT
   teacher_approved_at: 2:30 PM

Day 1, 3:00 PM
└─ Student initiates payment → redirects to eSewa

Day 1, 3:15 PM
└─ eSewa callback succeeds
   Status: ACTIVE
   Escrow: 2500 NPR held (5 sessions × 500 NPR)

Day 1, 4:00 PM
└─ Student calls /start-session
   Session #1 created, status: SCHEDULED

Day 1, 4:00 PM → 5:00 PM
└─ Student joins LiveKit
   Teacher joins LiveKit
   Session: SCHEDULED → IN_PROGRESS
   [Teaching happens for 60 minutes]
   Session: IN_PROGRESS → COMPLETED

Day 5, 2:00 PM
└─ Teacher calls /start-session (both agreed)
   Session #2 created, status: SCHEDULED
   [Session happens...]

... (more sessions over time) ...

Day 50
└─ All 5 sessions completed
   Booking status: ACTIVE → COMPLETED
   All 2500 NPR released to teacher
   Eligible for next weekly payout cycle
```

---

## Future Enhancements

1. **Booking Rejection:** Implement endpoint for teacher to reject requests.
2. **Demo Sessions:** Add concept of demo/trial session before full booking.
3. **Session Rescheduling:** Allow rescheduling individual sessions after creation.
4. **Rate Negotiation:** Multi-round negotiation of terms before approval.
5. **Notifications:** Push/email at each step.
