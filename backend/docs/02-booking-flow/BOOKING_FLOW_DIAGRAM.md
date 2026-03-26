# Booking Flow Diagram

## Visual Sequence Diagram

```
Student                    Teacher                 eSewa              DB/System
  │                          │                       │                    │
  ├─────────────────────────────────────────────────────────────────────>│
  │  POST /bookings/request                                              │
  │  (teacher_id, subject_id, sessions, rate)                           │
  │                                                                       │ Create Booking
  │                                                                       │ status: PENDING_APPROVAL
  │<─────────────────────────────────────────────────────────────────────┤
  │  Return Booking (PENDING_APPROVAL)                                   │
  │                                                                       │
  │  [Student gets notification: "Waiting for teacher approval"]         │
  │                                                                       │
  │                          ├─────────────────────────────────────────>│
  │                          │  Receives booking request                 │
  │                          │  [Teacher reviews and decides]            │
  │                          │                                           │
  │                          ├─────────────────────────────────────────>│
  │                          │  POST /bookings/{id}/approve              │
  │                          │  (notes)                                  │
  │                          │                                    Update Booking
  │                          │                                    PENDING_APPROVAL
  │                          │                                       → PENDING_PAYMENT
  │                          │                                    Set teacher_approved_at
  │<─────────────────────────┤<─────────────────────────────────────────┤
  │  Return Booking (PENDING_PAYMENT)                                    │
  │                                                                       │
  │  [Student gets notification: "Booking approved! Schedule sessions"]  │
  │                                                                       │
  ├─────────────────────────────────────────────────────────────────────>│
  │  POST /bookings/{id}/schedule-sessions                               │
  │  (sessions: [{scheduled_at, duration_minutes}, ...])                │
  │                                                                       │ Create Session records
  │                                                                       │ For each session:
  │                                                                       │ - session_number (1-based)
  │                                                                       │ - status: SCHEDULED
  │<─────────────────────────────────────────────────────────────────────┤
  │  Return Booking + Sessions (PENDING_PAYMENT)                         │
  │                                                                       │
  │  [Student reviews sessions]                                          │
  │                                                                       │
  ├─────────────────────────────────────────────────────────────────────>│
  │  POST /bookings/{id}/initiate-payment                                │
  │                                                                       │ Validate:
  │                                                                       │ - Status = PENDING_PAYMENT
  │                                                                       │ - All sessions scheduled
  │<─────────────────────────────────────────────────────────────────────┤
  │  Return EsewaPaymentInitResponse                                     │
  │  (transaction_uuid, total_amount, esewa_url)                         │
  │                                                                       │
  ├──────────────────────────────┐                                       │
  │ Redirect to eSewa             │                                       │
  ├──────────────────────────────────────────────────────>│               │
  │                              │                        │               │
  │                              │                    [eSewa processes]   │
  │                              │                    [User pays]         │
  │                              │                        │               │
  │                              │                   [Success callback]   │
  │                              │                        │               │
  │                              │<─────────────────────────────────────>│
  │                              │  POST /payments/esewa/callback         │
  │                              │  (verification, transaction details)   │ Update Booking
  │                              │                                        │ PENDING_PAYMENT → ACTIVE
  │                              │                                        │ Create BOOKING_ESCROW
  │                              │                                        │ Transaction
  │                              │<─────────────────────────────────────┤
  │  [Booking ACTIVE]            │  [Sessions ready to start]            │
  │  [Sessions ready]            │                                        │
  │                              │                                        │
  │  [Later: sessions happen]    │                                        │
  │  Each session:               │                                        │
  │  ├─ Student joins LiveKit                                           │
  │  ├─ Teacher joins LiveKit                                           │
  │  ├─ Session status → IN_PROGRESS                                    │
  │  ├─ [Teaching happens]                                              │
  │  ├─ Session completes                                               │
  │  └─ Session status → COMPLETED                                      │
  │                              │                                        │
  │  [All sessions done]         │                                        │
  │                              │                                        │ Update Booking
  │                              │                                        │ ACTIVE → COMPLETED
  │                              │                                        │ Release escrow funds
  │                              │                                        │ Create SESSION_RELEASE
  │                              │                                        │ Transactions
```

---

## State Machine Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                    BOOKING STATUS FLOW                            │
└──────────────────────────────────────────────────────────────────┘

                    ┌─────────────────────┐
                    │ PENDING_APPROVAL    │
                    │ (awaiting teacher)  │
                    └──────────┬──────────┘
                               │
                   ┌───────────┴───────────┐
                   │                       │
            [Teacher Approves]      [Rejected]
                   │                       │
                   ▼                       ▼
        ┌──────────────────┐       ┌────────────┐
        │ PENDING_PAYMENT  │       │ CANCELLED  │
        │ (awaiting $$$)   │       │ (terminal) │
        └────────┬─────────┘       └────────────┘
                 │
      ┌──────────┴──────────┐
      │                     │
[Payment SUCCESS]   [Payment FAILED/Cancelled]
      │                     │
      ▼                     ▼
   ┌──────┐          ┌──────────────┐
   │ACTIVE│          │ CANCELLED    │
   │      │          │ (terminal)   │
   └───┬──┘          └──────────────┘
       │
    ┌──┴──────────────────┐
    │                     │
[All sessions done]  [Cancelled mid-way]
    │                     │
    ▼                     ▼
┌──────────┐        ┌─────────────────┐
│COMPLETED │        │ CANCELLED_BY_*  │
│(terminal)│        │ (terminal)      │
└──────────┘        └─────────────────┘
```

---

## Session Status Lifecycle

```
Student or Teacher creates Booking Request

                    ↓

            Teacher approves

                    ↓

Student schedules N sessions → Each session created with status:

┌─────────────────────────────────────────────────────────────┐
│         SESSION LIFECYCLE (per individual session)           │
└─────────────────────────────────────────────────────────────┘

   ┌──────────┐
   │SCHEDULED │  ← initial state when scheduled
   └─────┬────┘
         │
    [First participant joins LiveKit room]
         │
         ▼
   ┌───────────────┐
   │  IN_PROGRESS  │  ← ongoing session
   └────────┬──────┘
            │
    ┌───────┴────────┐
    │                │
[Session completes] [Cancelled before end]
    │                │
    ▼                ▼
┌──────────┐    ┌──────────────────┐
│COMPLETED │    │ CANCELLED_BY_*   │
│(terminal)│    │ (terminal)       │
└──────────┘    └──────────────────┘
```

---

## Data Flow: Escrow to Teacher Payout

```
STUDENT SIDE                          PLATFORM (Escrow)           TEACHER SIDE
────────────────────────────────────────────────────────────────────────────────

1. Initiates Payment
   └─> eSewa Redirect

2. Completes Payment
   └─> eSewa Callback → POST /payments/esewa/callback
                          ├─ Verify HMAC
                          ├─ Update Booking: PENDING_PAYMENT → ACTIVE
                          ├─ Record BOOKING_ESCROW Transaction
                          │  (Student DEBIT, Platform CREDIT)
                          │
                          └─> Escrow Amount held in platform account
                              ├─ Per-session as completed:
                              │  └─ When student_joined_at AND teacher_joined_at set
                              │  └─ Generate SESSION_RELEASE Transaction
                              │  └─ Release rate_per_session to Teacher's ledger
                              │
                              └─ On Cancellation:
                                 └─ Calculate refund for uncompleted sessions
                                 └─ Generate REFUND_CANCELLED Transaction
                                 └─ Queue Celery task: refund_to_student()
                                    └─ Send back via eSewa (if supported)
                                       or manual admin handling

3. Ledger Entry:
   TRANSACTION: BOOKING_ESCROW
   ├─ user_id: student.id
   ├─ amount: booking.total_amount
   ├─ type: DEBIT
   └─ booking_id: booking.id

                              PLATFORM Escrow Account
                              (all bookings' escrows aggregated)
                                        ↓
                                        ↓ (Weekly Payout Cycle)
                                        ↓
                                   Calculate payouts:
                                   For each teacher in period:
                                   ├─ Sum SESSION_RELEASE amounts
                                   ├─ Subtract PLATFORM_FEE (10%)
                                   └─ net_amount = gross - fee

                                        ↓
                                   Teacher Payout
                                   ├─ status: PENDING → PROCESSING → COMPLETED
                                   ├─ Create WEEKLY_PAYOUT Transaction
                                   ├─ Create PLATFORM_FEE Transaction (separate)
                                   └─ Initiate eSewa transfer
                                      (via batch payout API or manual)

                                                              ← Funds arrive
                                                              ← Teacher receives
                                                                 weekly payout
```

---

## Rejection Flow (Future)

```
PENDING_APPROVAL
       ↓
[Teacher rejects via endpoint]
       ↓
   REJECTED (new status - future)
       ↓
[Student can view reason]
[Student can delete request]
       ↓
   DELETED (new status - future)
```

---

## Example Timeline

```
Day 1, 10:00 AM
└─ Student sends booking request for 10 sessions @ 500/session
   Status: PENDING_APPROVAL

Day 1, 2:30 PM
└─ Teacher approves booking
   Status: PENDING_PAYMENT
   teacher_approved_at: 2:30 PM

Day 1, 3:00 PM
└─ Student schedules all 10 sessions (over next 2.5 months)
   Sessions created with scheduled_at dates
   Status: still PENDING_PAYMENT

Day 1, 3:15 PM
└─ Student initiates payment
   └─> Redirect to eSewa
   └─> User completes payment

Day 1, 3:25 PM
└─ eSewa callback succeeds
   Status: ACTIVE
   Escrow: 5000 NPR held

Day 1, 4:00 PM (First Session Scheduled)
└─ Session 1 scheduled_at: now
   ├─ Student joins LiveKit
   ├─ Teacher joins LiveKit
   ├─ Session status: SCHEDULED → IN_PROGRESS
   └─ [Teaching happens for 60 min]

Day 1, 5:00 PM
└─ Session ends
   ├─ Session status: IN_PROGRESS → COMPLETED
   ├─ LiveKit webhook: room_finished
   ├─ Create SESSION_RELEASE Transaction
   ├─ Release 500 NPR to Teacher's balance
   └─ Booking: completed_sessions = 1/10

... (more sessions over time) ...

Day 50+
└─ All 10 sessions completed
   ├─ Booking status: ACTIVE → COMPLETED
   └─ All 5000 NPR released to teacher
   └─ Funds eligible for next weekly payout cycle
```
