# Quick Reference: Session Completion Status Flow

## Visual Status State Machine

```
                    ┌─────────────┐
                    │    READY    │
                    └──────┬──────┘
                           │
         (room starts)      │      (teacher/student cancels)
              │             │             │
              v             v             v
         ┌──────────────────────────────────────────┐
         │  Session.status = IN_PROGRESS            │
         │  - Teacher joined?                       │
         │  - Student joined?                       │
         └──────────┬───────────────────────────────┘
                    │
      ┌─────────────┼──────────────────┬──────────────┐
      │             │                  │              │
      │             │                  │              │
      v             v                  v              v
┌─────────────┐ ┌──────────────┐ ┌──────────────────┐ ┌─────────────────────┐
│ COMPLETED   │ │ CANCELLED_BY │ │ CANCELLED_BY_    │ │ CANCELLED_BY_       │
│             │ │ STUDENT      │ │ TEACHER (Timeout)│ │ TEACHER (Manual)    │
│ (normal)    │ │ (early drop) │ │ (Celery task)    │ │ (cancel endpoint)   │
└─────────────┘ └──────────────┘ └──────────────────┘ └─────────────────────┘
      │               │                  │                  │
      └───────────────┴──────────────────┴──────────────────┘
                      │
                      v
            ┌──────────────────────┐
            │ room_finished        │
            │ webhook fires        │
            └──────────────────────┘
                      │
       ┌──────────────┼──────────────┐
       │              │              │
       v              v              v
    CREATE        UPDATE      SCHEDULE
    TRANSACTION   COUNTERS    POST-TASKS
    (conditional) (all)       (only COMPLETED)
```

## Status → Action Matrix

| Status                   | Create Transaction | Update Counters | Schedule Tasks | Refund |
| ------------------------ | :----------------: | :-------------: | :------------: | :----: |
| **COMPLETED**            |         ✅         |       ✅        |       ✅       |   ❌   |
| **CANCELLED_BY_STUDENT** |         ✅         |       ✅        |       ❌       |   ❌   |
| **CANCELLED_BY_TEACHER** |         ❌         |       ✅        |       ❌       |  ✅\*  |

\*TODO: Implement refund logic for teacher cancellations

## Where Status is Set

| Status               | Where                                  | When                              | Who     |
| -------------------- | -------------------------------------- | --------------------------------- | ------- |
| COMPLETED            | request_session_completion()           | Auto-complete (duration reached)  | Teacher |
| COMPLETED            | accept_session_completion()            | Student accepts premature request | Student |
| COMPLETED            | \_async_cleanup_expired_livekit_room() | Timeout cleanup task              | Celery  |
| CANCELLED_BY_TEACHER | cancel_session()                       | Teacher clicks cancel             | Teacher |
| CANCELLED_BY_STUDENT | cancel_session()                       | Student clicks cancel             | Student |
| CANCELLED_BY_STUDENT | participant_left (webhook)             | Student never joined              | LiveKit |
| CANCELLED_BY_TEACHER | participant_left (webhook)             | Teacher never joined              | LiveKit |

## What Happens After Status is Set

```
┌─ Set session.status
├─ Set session.actual_end_at = now
├─ Flush to database
│
├─ Call end_room(room_name)
│  └─ (Idempotent - handles errors internally)
│     ├─ Room exists? Delete it
│     ├─ Room already deleted? Log warning, continue
│     ├─ Room doesn't exist? Log warning, continue
│     └─ API error? Log warning, continue
│
├─ Commit transaction
│
└─ LiveKit emits room_finished webhook
   ├─ Verify session.actual_end_at (safety net)
   ├─ Create transaction (if COMPLETED or CANCELLED_BY_STUDENT)
   ├─ Update booking.completed_sessions (all statuses)
   ├─ Increment teacher.completed_sessions (all statuses)
   ├─ Emit "session_finished" event (all statuses)
   └─ Schedule post-session tasks (only COMPLETED)
```

## Payment Scenarios

```
Teacher Payment Rules:

┌─ COMPLETED
│  └─ Teacher did the work
│     └─ ✅ CREATE TRANSACTION for rate_per_session
│
├─ CANCELLED_BY_STUDENT
│  └─ Student cancelled, teacher's slot was reserved
│     └─ ✅ CREATE TRANSACTION for rate_per_session
│
└─ CANCELLED_BY_TEACHER
   └─ Teacher cancelled, teacher shouldn't get paid
      └─ ❌ DO NOT CREATE TRANSACTION
      └─ TODO: Student gets refunded
```

## Booking Progress Scenarios

```
All Statuses Count Toward Completion:

booking.completed_sessions += 1  (for all statuses)

if booking.completed_sessions >= booking.total_sessions:
    booking.status = BookingStatus.COMPLETED
```

## Experience Points Scenarios

```
All Statuses Increment Experience:

teacher_subject.completed_sessions += 1  (for all statuses)
```

## Transaction Types Reference

```
TransactionType:
├─ CREDIT: Money coming in (teacher paid)
└─ DEBIT: Money going out (student charged)

TransactionReason:
└─ SESSION_RELEASE: Session completed (primary reason)
```

## Webhook Events Reference

```
Event: "session_finished"
Emitted to: Both student and teacher (separate rooms)
Data includes:
├─ session_id
├─ status (value: "COMPLETED" | "CANCELLED_BY_TEACHER" | "CANCELLED_BY_STUDENT")
└─ actual_end_at (ISO format)
```

## Error Handling

```
end_room() Errors:
├─ Room already deleted → ✅ Log warning, continue
├─ Room doesn't exist → ✅ Log warning, continue
├─ API unreachable → ✅ Log warning, continue
├─ Invalid room name → ✅ Return immediately
└─ Unexpected error → ✅ Log warning, continue

Room auto-expires after 24 hours anyway, so being lenient is safe.
```

## Key Guarantees

✅ **Idempotency:** Multiple calls with same status → Same result
✅ **Consistency:** Status set before room deleted
✅ **Accuracy:** Timestamp captures exact deletion moment
✅ **Fairness:** Payment only for work done or reserved
✅ **Completeness:** All sessions count toward booking progress
✅ **Resilience:** Webhook processes regardless of room existence
