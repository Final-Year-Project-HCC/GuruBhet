# Database Consistency: Visual Analysis

## Current Architecture (VULNERABLE)

```
┌─────────────────────────────────────────────┐
│ Route: request_session_completion()         │
├─────────────────────────────────────────────┤
│                                             │
│ 1. session.status = COMPLETED               │
│ 2. session.actual_end_at = now              │
│ 3. db.flush()                               │
│ 4. db.commit() ✅                            │
│                                             │
│ 5. end_room()                               │
│    └─ LiveKit deletes room                  │
│    └─ room_finished event triggered ✅      │
│                                             │
│ 6. return session to client                 │
│ ✅ CLIENT THINKS EVERYTHING IS DONE        │
│                                             │
└─────────────────────────────────────────────┘
                      │
                      │ room_finished event
                      │ (may or may not arrive!)
                      v
┌─────────────────────────────────────────────┐
│ Webhook: /livekit/webhook                   │
├─────────────────────────────────────────────┤
│                                             │
│ 7. GET session from DB                      │
│ 8. if session.status in (COMPLETED, ...):   │
│    - CREATE transaction ❌ MISSING IF NO WH │
│ 9. booking.completed_sessions += 1          │
│    ❌ MISSING IF NO WEBHOOK                 │
│10. emit Socket.IO event                     │
│    ❌ MISSING IF NO WEBHOOK                 │
│11. schedule post-session tasks              │
│    ❌ MISSING IF NO WEBHOOK                 │
│12. db.commit()                              │
│                                             │
└─────────────────────────────────────────────┘

FAILURE POINT:
If webhook never arrives (network, dropped event, etc.):
  ✅ Status is set
  ✅ Client is happy
  ❌ Teacher not paid
  ❌ Counters not updated
  ❌ Notifications not sent
  ❌ Tasks not scheduled
  = SILENT DATA INCONSISTENCY
```

## Failure Scenarios

### Scenario A: Webhook Lost in Transit

```
Route                          Network              Webhook
─────                          ───────              ───────
session.status = COMPLETED
session.actual_end_at = now
db.commit() ✅
end_room() calls LiveKit
                               room_finished
                               event created

                               ❌ Event lost
                                  (network, queue, etc.)

                               ❌ Webhook never runs

RESULT:
✅ Session.status = COMPLETED
✅ Session.actual_end_at set
❌ Transaction = NOT created
❌ Counters = NOT updated
❌ Notifications = NOT sent
❌ Tasks = NOT scheduled
```

### Scenario B: Webhook Processes But Fails

```
Webhook receives event
runs transaction logic
tries to create Transaction record
  └─ Database lock/deadlock
  └─ Out of memory error
  └─ Unique constraint violation
  └─ Any exception

Exception caught
Transaction rolls back
Webhook returns error

RESULT: Same as Scenario A
```

### Scenario C: Duplicate Webhooks

```
First webhook arrives
  └─ Creates transaction
  └─ Increments counters
  └─ Commits

Second webhook arrives (network retry)
  └─ Session.status is still COMPLETED
  └─ Creates ANOTHER transaction ❌
  └─ Increments counters AGAIN ❌
  └─ Commits

RESULT:
❌ Transaction created twice
❌ Counters incremented twice
❌ Teacher paid double
❌ Session complete_sessions wrong
```

## Recommended Solution: Receipt + Cleanup Pattern

```
┌─────────────────────────────────────────────┐
│ Route: request_session_completion()         │
├─────────────────────────────────────────────┤
│ 1. session.status = COMPLETED               │
│ 2. session.actual_end_at = now              │
│ 3. db.commit()                              │
│ 4. end_room()                               │
│ 5. return success                           │
└─────────────────────────────────────────────┘
           │
           │ room_finished event
           v
┌─────────────────────────────────────────────┐
│ Webhook: /livekit/webhook                   │
├─────────────────────────────────────────────┤
│                                             │
│ STEP 1: Record receipt (FAST)               │
│ ┌─────────────────────────────────────────┐ │
│ │ receipt = WebhookReceipt(                │ │
│ │   room_name="session-xxx",               │ │
│ │   event_type="room_finished",            │ │
│ │ )                                        │ │
│ │ db.add(receipt)                          │ │
│ │ db.commit() ✅ (just 1 record)          │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ STEP 2: Process webhook (with guards)       │
│ ┌─────────────────────────────────────────┐ │
│ │ if not receipt.processed:                │ │
│ │   - CREATE transaction (idempotent)      │ │
│ │   - UPDATE counters (with row version)   │ │
│ │   - EMIT notifications                   │ │
│ │   - SCHEDULE tasks                       │ │
│ │                                          │ │
│ │ receipt.processed = True                 │ │
│ │ db.commit() ✅                           │ │
│ └─────────────────────────────────────────┘ │
│                                             │
└─────────────────────────────────────────────┘

BENEFITS:
✅ Receipt proves event arrived
✅ Unique constraint prevents duplicates
✅ Can detect if webhook processing fails
✅ Can retry incomplete processing
```

## With Cleanup Recovery Job

```
Every 5 minutes:
┌─────────────────────────────────────────────┐
│ Celery Job: cleanup_unprocessed_webhooks    │
├─────────────────────────────────────────────┤
│                                             │
│ Find all WebhookReceipts where:             │
│   processed = False AND                     │
│   received_at < now - 1 hour                │
│                                             │
│ For each unprocessed receipt:                │
│   └─ LOG WARNING                            │
│   └─ GET associated session                 │
│   └─ IF session.status in (COMPLETED, ...):│
│      └─ PROCESS IT NOW (idempotent)        │
│      └─ Mark receipt.processed = True      │
│                                             │
└─────────────────────────────────────────────┘

RESULT:
✅ No session falls through cracks
✅ Missing webhooks recovered within 1 hour
✅ Duplicates prevented by unique constraints
✅ Full audit trail in WebhookReceipt table
```

## Comparison Table: States

### Current Architecture

| State                             | Explanation             | Risk     |
| --------------------------------- | ----------------------- | -------- |
| Webhook arrives, processes        | ✅ Everything works     | Low      |
| Webhook lost, never arrives       | ❌ Silent inconsistency | **HIGH** |
| Webhook arrives, processing fails | ❌ Partial state        | **HIGH** |
| Webhook arrives twice             | ❌ Duplicate records    | Medium   |

### With Receipt + Cleanup

| State                                       | Explanation                             | Risk |
| ------------------------------------------- | --------------------------------------- | ---- |
| Webhook arrives, processes                  | ✅ Marked processed                     | Low  |
| Webhook lost, recovery job retries          | ✅ Recovered in 1hr                     | Low  |
| Webhook fails, logged, recovery job retries | ✅ Recovered in 1hr                     | Low  |
| Webhook arrives twice                       | ✅ Unique constraint prevents duplicate | Low  |

## Timeline: Current vs Proposed

### Current (VULNERABLE)

```
T+0s   Route commits session.status = COMPLETED
       Client receives success ✅
       end_room() called

T+100ms LiveKit emits room_finished
        Webhook receives it
        Webhook processes...
        └─ IF FAILS HERE: No retry, no recovery

T+102ms Webhook commits
        OR webhook fails silently

FOREVER: Session.completed_sessions never updated ❌
         Teacher never paid ❌
         Booking progress wrong ❌
```

### Proposed (SAFE)

```
T+0s   Route commits session.status = COMPLETED
       Client receives success ✅
       end_room() called

T+100ms LiveKit emits room_finished
        Webhook records receipt (fast commit)

T+102ms Webhook processes completion logic
        └─ IF FAILS HERE: Receipt shows it was received
           Cleanup job will retry in <1 hour

T+105ms Webhook commits
        Completion is finalized

OR (if webhook fails):

T+3660s (1 hour later)
        Cleanup job runs
        Finds unprocessed receipts
        Retries the webhook logic
        Now processes successfully ✅
```

## Data Flow Diagrams

### Happy Path (Both Work)

```
session.status = COMPLETED
         ↓
    end_room()
         ↓
room_finished event
         ↓
webhook receives
         ↓
[CURRENT] ──→ Create transaction ──→ Commit ✅
[PROPOSED] ──→ Record receipt ──→ Process ──→ Mark processed ──→ Commit ✅
```

### Failure Path: Webhook Lost

```
[CURRENT]
session.status = COMPLETED
         ↓
    end_room()
         ↓
room_finished event
         ↓
❌ LOST IN TRANSIT ❌
         ↓
🔴 SILENT FAILURE - No recovery possible

[PROPOSED]
session.status = COMPLETED
         ↓
    end_room()
         ↓
room_finished event
         ↓
❌ LOST IN TRANSIT ❌
         ↓
After 1 hour:
cleanup_unprocessed_webhooks() runs
         ↓
Detects unprocessed receipt
         ↓
Processes it now ✅
```

### Failure Path: Processing Fails

```
[CURRENT]
webhook receives event
         ↓
tries to create transaction
         ↓
❌ Database deadlock/error ❌
         ↓
Exception logged, but no retry
         ↓
🔴 PERMANENT INCONSISTENCY

[PROPOSED]
receipt recorded ✅
         ↓
tries to create transaction
         ↓
❌ Database deadlock/error ❌
         ↓
Exception logged
receipt.processed still False
         ↓
After 1 hour:
cleanup_unprocessed_webhooks() runs
         ↓
Finds receipt with processed=False
         ↓
Retries the processing ✅
```

## Risk Heat Map

### Current Architecture

```
              Loss    Failure   Duplicate
             Risk      Risk      Risk
Webhook      ⭐⭐⭐   ⭐⭐⭐   ⭐⭐
Processing   ⭐⭐⭐   ⭐⭐⭐   ⭐
Recovery     ⭐       ⭐       ⭐

Overall Risk: 🔴 CRITICAL
```

### Proposed Architecture

```
              Loss    Failure   Duplicate
             Risk      Risk      Risk
Webhook      ⭐        ⭐⭐⭐   ⭐
Processing   ⭐⭐      ⭐       ⭐
Recovery     ⭐⭐⭐   ⭐⭐⭐   ⭐⭐⭐

Overall Risk: 🟡 LOW TO MEDIUM
```

## Implementation Effort

```
Quick Win (Day 1):
- Add WebhookReceipt model
- Update webhook handler to record receipt
- Update cleanup job

Medium Term (Week 1):
- Add monitoring/alerts for unprocessed webhooks
- Add tests for recovery scenarios
- Document recovery procedures

Long Term (Month 1):
- Add SessionCompletionEvent for full event sourcing
- Add replay capability
- Add audit dashboard
```
