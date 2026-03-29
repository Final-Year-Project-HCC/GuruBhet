# Complete Session Completion Architecture Explanation

## Overview

This document explains the complete session completion architecture including all three dimensions of behavior, transaction logic, and critical consistency guarantees.

---

## Part 1: Architecture Pattern

### Separation of Concerns

The session completion logic is distributed across three layers:

```
Layer 1: Routes/Celery Tasks
├─ Responsibility: Set session status
├─ Set actual_end_at timestamp
├─ Call end_room() to delete LiveKit room
└─ Commit to database
   └─ At this point: DONE from route perspective, client gets success

Layer 2: LiveKit API
├─ Room is deleted
├─ room_finished event is emitted
└─ Webhook infrastructure receives and routes it

Layer 3: Webhook Handler
├─ Responsibility: Handle common completion logic
├─ Create transactions (if applicable)
├─ Update booking counters
├─ Increment teacher experience
├─ Emit Socket.IO notifications
├─ Schedule post-session tasks (if applicable)
└─ Commit to database
```

### Why This Design?

**Status Assignment in Routes/Tasks:**

- Routes/tasks know WHEN the session is ending
- Routes/tasks know WHO is ending it (teacher vs student vs timeout)
- Routes/tasks can set the appropriate status immediately
- Client doesn't have to wait for webhook to get acknowledgment

**Common Logic in Webhook:**

- Webhook handler runs after room is definitely deleted
- Webhook can handle all statuses uniformly (with conditional blocks)
- Webhook guarantees room_finished is the trigger for completion logic
- Cleaner separation: status comes from business logic, completion comes from API confirmation

---

## Part 2: Session Status Lifecycle

### Status Values

```
READY
  ↓
IN_PROGRESS (when room starts)
  ↓
┌─────────────────────────────────────┐
│ Terminal States                     │
├─────────────────────────────────────┤
│ COMPLETED                           │
│ CANCELLED_BY_TEACHER                │
│ CANCELLED_BY_STUDENT                │
└─────────────────────────────────────┘
```

### Where Status is Set

| Status               | Endpoint/Task                          | When                      | Condition                         |
| -------------------- | -------------------------------------- | ------------------------- | --------------------------------- |
| IN_PROGRESS          | webhook (room_started)                 | Room starts               | Always                            |
| COMPLETED            | request_session_completion()           | Duration reached          | elapsed >= duration + leniency    |
| COMPLETED            | accept_session_completion()            | Student accepts early end | Teacher requested, student agreed |
| COMPLETED            | \_async_cleanup_expired_livekit_room() | Timeout                   | No one finished it manually       |
| CANCELLED_BY_TEACHER | cancel_session()                       | Teacher cancels           | current_user = teacher            |
| CANCELLED_BY_STUDENT | cancel_session()                       | Student cancels           | current_user = student            |
| CANCELLED_BY_STUDENT | webhook (participant_left)             | No-show                   | Student never joined              |
| CANCELLED_BY_TEACHER | webhook (participant_left)             | Teacher no-show           | Teacher never joined              |

### Key Points

1. **Status is set BEFORE calling end_room()**
   - Route/task has full control over status value
   - Route/task commits status to DB first
   - end_room() is best-effort (idempotent, can fail safely)

2. **Status is set ONCE**
   - Once in a terminal state, doesn't change
   - Webhook only reads status, doesn't modify it

3. **Webhook respects pre-set status**
   - Gets session from DB
   - Reads the status
   - Takes different actions based on status
   - Never overwrites status

---

## Part 3: Three Dimensions of Behavior

Each session completion must handle three independent dimensions:

### Dimension 1: Booking Progress (Completion Counting)

**Rule: ALL statuses count toward booking completion**

```python
# In webhook, always increment
booking.completed_sessions += 1
if booking.completed_sessions >= booking.total_sessions:
    booking.status = BookingStatus.COMPLETED
```

**Applies to:**

- ✅ COMPLETED
- ✅ CANCELLED_BY_TEACHER
- ✅ CANCELLED_BY_STUDENT

**Why?** All three represent "a slot that was used up" - whether completed, cancelled, or no-show.

### Dimension 2: Teacher Experience (Skill Points)

**Rule: ALL statuses increment completed_sessions**

```python
# In webhook, always increment
await ts_repo.increment_completed_sessions(
    teacher_id=booking.teacher_id,
    subject_id=booking.subject_id,
)
```

**Applies to:**

- ✅ COMPLETED
- ✅ CANCELLED_BY_TEACHER
- ✅ CANCELLED_BY_STUDENT

**Why?** Teacher's skill improves from experience of all teaching attempts, including cancellations.

### Dimension 3: Teacher Payment (Financial Compensation)

**Rule: Only COMPLETED and CANCELLED_BY_STUDENT get transactions**

```python
# In webhook, conditional creation
if session.status in (SessionStatus.COMPLETED, SessionStatus.CANCELLED_BY_STUDENT):
    db.add(Transaction(
        user_id=booking.teacher_id,
        amount=booking.rate_per_session,
        type=TransactionType.CREDIT,
        reason=TransactionReason.SESSION_RELEASE,
        booking_id=booking.id,
    ))
```

**Payment Matrix:**

| Status               | Create Transaction | Why                                                                                            |
| -------------------- | :----------------: | ---------------------------------------------------------------------------------------------- |
| COMPLETED            |         ✅         | Teacher did the work, deserves payment                                                         |
| CANCELLED_BY_STUDENT |         ✅         | Student cancelled, teacher's slot was reserved, teacher should be compensated                  |
| CANCELLED_BY_TEACHER |         ❌         | Teacher's own cancellation, not teacher's fault student was charged, teacher shouldn't be paid |

### Dimension 4: Post-Session Tasks

**Rule: Only COMPLETED gets post-session tasks scheduled**

```python
# In webhook, conditional scheduling
if session.status == SessionStatus.COMPLETED:
    process_session_billing.delay(...)
    send_session_complete_notification.delay(...)
```

**Applies to:**

- ✅ COMPLETED → Schedule billing, notifications, reports
- ❌ CANCELLED_BY_TEACHER → No tasks
- ❌ CANCELLED_BY_STUDENT → No tasks

**Why?** Only genuinely completed sessions need follow-up tasks. Cancellations don't require billing finalization.

---

## Part 4: Timestamp Handling (actual_end_at)

### Why It's Set in Two Places

**Route sets it first** (at exact moment of end_room() call):

```python
session.actual_end_at = now  # Precise moment
await db.flush()
await end_room(room_name)    # Exact timing captured
await db.commit()
```

**Webhook has safety net**:

```python
if not session.actual_end_at:  # Only if route didn't set it
    session.actual_end_at = now
```

### This is Intentional

| Scenario          | Who Sets It   | Timing   | Accuracy                        |
| ----------------- | ------------- | -------- | ------------------------------- |
| Normal route      | Route         | T+0ms    | Precise (exact deletion moment) |
| External deletion | Webhook       | T+100ms  | Good (within 100ms of deletion) |
| Edge case         | Webhook guard | Fallback | Acceptable (better than NULL)   |

### Pattern Name

This is the **Safety Net Pattern**:

1. Primary code path (route) sets the value precisely
2. Fallback code path (webhook) has guard to catch edge cases
3. Both paths are safe, can't create inconsistency
4. Guard clause (`if not actual_end_at`) prevents overwriting

---

## Part 5: Error Handling (Idempotent end_room)

### The Function

```python
async def end_room(room_name: str) -> None:
    """Delete a LiveKit room, disconnecting all participants.

    This is idempotent - if the room doesn't exist, it's a no-op.
    Handles cases where:
    - Room was already deleted by another process
    - Room name is invalid or empty
    - LiveKit API is unreachable (non-fatal)
    """
    if not room_name:
        return

    try:
        await get_livekit_api().room.delete_room(
            api.DeleteRoomRequest(room=room_name)
        )
    except Exception as exc:
        # Log but don't raise - room deletion is best-effort
        # Rooms auto-expire after empty_timeout anyway
        logger.warning(
            f"Failed to delete LiveKit room '{room_name}': {exc}",
            extra={"room_name": room_name},
        )
```

### Why Idempotent?

```
Scenario: Call end_room() for a room that's already deleted

Before (FAILED):
end_room() ──→ LiveKit API ──→ Error: Room not found
             ↓
           Exception raised
             ↓
           Caught by try/except
             ↓
           Silent failure (pass)

After (SUCCESS):
end_room() ──→ LiveKit API ──→ Error: Room not found
             ↓
           Caught internally
             ↓
           Logged as warning
             ↓
           Returns normally
```

### Benefits

- ✅ Routes can call `end_room()` without try/catch
- ✅ Safe to call multiple times (idempotent)
- ✅ Room auto-expires anyway, so best-effort is safe
- ✅ All errors logged consistently

---

## Part 6: Database Consistency with Webhooks

### Critical Issue: What If Webhook Never Arrives?

```
Route Sets Status:
✅ session.status = COMPLETED
✅ session.actual_end_at = now
✅ db.commit()

Client: "Session complete!"

Webhook Should Process:
└─ Create transaction ❓ MISSING IF NO WEBHOOK
└─ Update counters ❓ MISSING IF NO WEBHOOK
└─ Send notifications ❓ MISSING IF NO WEBHOOK
└─ Schedule tasks ❓ MISSING IF NO WEBHOOK

If webhook never arrives:
  ✅ Status is set
  ❌ But nothing else happens
  = SILENT INCONSISTENCY
```

### Solution: Receipt Tracking + Cleanup Job

**Add three layers of safety:**

1. **Record Receipt** - Webhook records that it was received
2. **Process Idempotently** - With guards to prevent duplicates
3. **Recovery Job** - Cleanup job retries any failed processing

```
Webhook Arrives
  ↓
Record WebhookReceipt(processed=False)
  ↓
Try to process completion logic
  ↓
Success? → Mark receipt.processed=True, commit
Failure? → Don't mark processed, commit error info
  ↓
Every 5 minutes:
  Cleanup job finds receipts with processed=False
    If still old enough to retry:
      Process the completion logic again
    If succeeded: Mark processed=True
    If failed: Increment error_count, try again later (max 5 times)
```

**Components Needed:**

1. **WebhookReceipt Model**

```python
class WebhookReceipt(Base):
    id: UUID
    room_name: str
    event_type: str
    received_at: DateTime
    processed: bool  # False = needs retry, True = complete
    error_message: str | None
    error_count: int

    # Unique constraint prevents duplicate processing
    __table_args__ = (UniqueConstraint('room_name', 'event_type'),)
```

2. **Updated Webhook Handler**

```python
# Step 1: Record receipt (fast commit)
receipt = WebhookReceipt(room_name=..., event_type="room_finished")
db.add(receipt)
await db.commit()

# Step 2: Process with guards
try:
    create_transaction_if_needed()
    update_counters()
    emit_notifications()
    schedule_tasks()
    receipt.processed = True
    await db.commit()
except Exception:
    receipt.error_message = str(exc)
    receipt.error_count += 1
    await db.commit()
    # Don't mark processed, so cleanup job will retry
```

3. **Cleanup Job (Every 5 minutes)**

```python
@celery_app.task
def cleanup_unprocessed_webhooks():
    # Find receipts not processed in last 1 hour
    unprocessed = db.query(WebhookReceipt).filter(
        processed=False,
        received_at < now - 1hour,
        error_count < 5
    )
    for receipt in unprocessed:
        # Retry webhook processing
        # If succeeds: Mark processed=True
        # If fails: Increment error_count
```

### Guarantees This Provides

✅ **No Lost Webhooks** - Event recorded, can be recovered within 1 hour
✅ **No Duplicates** - Unique constraint prevents re-processing
✅ **Self-Healing** - Automatic retry without manual intervention
✅ **Observable** - Full audit trail of webhook delivery and processing
✅ **Auditable** - Can check WebhookReceipt table to verify completion

---

## Part 7: Complete Flow Diagrams

### Happy Path: Teacher Completes Session

```
1. Teacher calls /accept-premature-session-completion
   ├─ session.status = COMPLETED
   ├─ session.actual_end_at = now
   ├─ db.flush()
   ├─ await end_room(room_name)
   │  └─ LiveKit deletes room, emits room_finished
   └─ db.commit() → Return success to client

2. Webhook: room_finished event arrives
   ├─ Record WebhookReceipt(processed=False)
   ├─ db.commit() → Receipt stored
   ├─ Get session from DB
   ├─ Create transaction (COMPLETED → yes)
   ├─ booking.completed_sessions += 1
   ├─ teacher_subject.completed_sessions += 1
   ├─ Emit "session_finished" event to both users
   ├─ Schedule post-session tasks (COMPLETED → yes)
   ├─ receipt.processed = True
   └─ db.commit() → ALL DONE

3. Client receives notifications via Socket.IO
   └─ "session_finished" event with status=COMPLETED

Status Update Path:
   READY → IN_PROGRESS → COMPLETED ✅
```

### Failure Path: Teacher Cancels

```
1. Teacher calls /cancel
   ├─ session.status = CANCELLED_BY_TEACHER
   ├─ session.actual_end_at = now
   ├─ db.flush()
   ├─ await end_room(room_name)
   │  └─ LiveKit deletes room, emits room_finished
   └─ db.commit() → Return success to client

2. Webhook: room_finished event arrives
   ├─ Record WebhookReceipt(processed=False)
   ├─ db.commit() → Receipt stored
   ├─ Get session from DB
   ├─ Check session.status = CANCELLED_BY_TEACHER
   ├─ Create transaction? NO (CANCELLED_BY_TEACHER → no)
   ├─ booking.completed_sessions += 1 (all count)
   ├─ teacher_subject.completed_sessions += 1 (all count)
   ├─ Emit "session_finished" event
   ├─ Schedule tasks? NO (not COMPLETED)
   ├─ TODO: Queue refund for student
   ├─ receipt.processed = True
   └─ db.commit() → DONE

3. Client receives notification
   └─ "session_finished" event with status=CANCELLED_BY_TEACHER

Status Update Path:
   READY → IN_PROGRESS → CANCELLED_BY_TEACHER ✅

Payment Path:
   Teacher: NO TRANSACTION ✅
   Student: REFUND QUEUED (TODO) ⏳
```

### Recovery Path: Webhook Fails

```
1. Same as above: Route sets status and calls end_room()
2. Webhook: room_finished arrives
   ├─ Record WebhookReceipt(processed=False)
   ├─ db.commit()
   ├─ Try to create transaction
   ├─ ❌ Database error (deadlock, constraint, etc.)
   ├─ Receipt.error_message = "deadlock detected"
   ├─ Receipt.error_count += 1
   └─ db.commit() (error info saved, not marked processed)

3. Client: Already has success from route ✅
   └─ Doesn't know webhook failed

4. Cleanup Job (5 minutes later)
   ├─ Finds WebhookReceipt with processed=False, error_count=1
   ├─ Retries webhook processing
   ├─ This time it succeeds (deadlock resolved)
   ├─ Receipt.processed = True
   └─ db.commit()

5. Client: Eventually gets notifications (delayed)
   └─ "session_finished" event arrives

Result: Eventually consistent ✅
Recovery Time: < 5 minutes (next job run)
```

---

## Part 8: Decision Tree

### Which endpoint to call?

```
Is it a teacher?
├─ YES
│  ├─ Is duration reached?
│  │  ├─ YES → POST /request-session-completion
│  │  └─ NO → POST /request-session-completion (to request early end)
│  └─ Does teacher want to cancel?
│     └─ YES → POST /cancel
│
└─ NO (it's a student)
   ├─ Did teacher request early completion?
   │  ├─ YES → POST /accept-premature-session-completion
   │  └─ NO → POST /reject-premature-session-completion
   └─ Does student want to cancel?
      └─ YES → POST /cancel
```

### What status should be set?

```
Who is completing the session?
├─ CELERY TIMEOUT JOB → SessionStatus.COMPLETED
├─ TEACHER manually → SessionStatus.COMPLETED
├─ STUDENT accepts early → SessionStatus.COMPLETED
├─ TEACHER cancels → SessionStatus.CANCELLED_BY_TEACHER
├─ STUDENT cancels → SessionStatus.CANCELLED_BY_STUDENT
├─ STUDENT no-show → SessionStatus.CANCELLED_BY_STUDENT (webhook)
└─ TEACHER no-show → SessionStatus.CANCELLED_BY_TEACHER (webhook)
```

### What should webhook do?

```
Webhook receives room_finished event

✅ ALWAYS:
   ├─ Record receipt
   ├─ Set actual_end_at (if not set)
   ├─ Update booking.completed_sessions
   ├─ Update teacher.completed_sessions
   ├─ Emit Socket.IO event
   └─ Log completion

❓ DEPENDS ON STATUS:
   ├─ If COMPLETED or CANCELLED_BY_STUDENT:
   │  └─ Create transaction
   ├─ If COMPLETED:
   │  └─ Schedule post-session tasks
   └─ If CANCELLED_BY_TEACHER:
      └─ TODO: Queue refund task
```

---

## Part 9: Summary Table

| Aspect             | Details                                        |
| ------------------ | ---------------------------------------------- |
| **Status Set By**  | Routes/Tasks (before end_room)                 |
| **Status Read By** | Webhook (for conditional logic)                |
| **Dimensions**     | 4 (progress, experience, payment, tasks)       |
| **Payment Logic**  | COMPLETED + CANCELLED_BY_STUDENT = transaction |
| **No-Payment**     | CANCELLED_BY_TEACHER = no transaction          |
| **Counter Logic**  | ALL statuses count (progress + experience)     |
| **Task Logic**     | Only COMPLETED schedules tasks                 |
| **Timestamp**      | Route sets, webhook validates (safety net)     |
| **Error Handling** | end_room() is idempotent                       |
| **Consistency**    | Receipt tracking + cleanup job                 |
| **Recovery Time**  | < 5 minutes (cleanup job interval)             |
| **Duplicates**     | Prevented by unique constraint on receipt      |
| **Audit Trail**    | Full WebhookReceipt history                    |

---

## Implementation Checklist

### Phase 1: Status Assignment (DONE)

- ✅ request_session_completion() sets COMPLETED
- ✅ accept_session_completion() sets COMPLETED
- ✅ cancel_session() sets CANCELLED_BY_TEACHER or CANCELLED_BY_STUDENT
- ✅ \_async_cleanup_expired_livekit_room() sets COMPLETED
- ✅ participant_left webhook sets CANCELLED_BY_STUDENT or CANCELLED_BY_TEACHER

### Phase 2: Idempotent end_room() (DONE)

- ✅ end_room() handles all error cases internally
- ✅ No try/catch at call sites needed
- ✅ Rooms auto-expire after 24 hours anyway

### Phase 3: Webhook Handler (DONE)

- ✅ Always creates transaction for COMPLETED and CANCELLED_BY_STUDENT
- ✅ Never creates transaction for CANCELLED_BY_TEACHER
- ✅ Always updates counters (all statuses)
- ✅ Always updates experience (all statuses)
- ✅ Always emits Socket.IO event
- ✅ Only schedules tasks if COMPLETED
- ✅ Has timestamp safety net

### Phase 4: Database Consistency (TODO)

- ⏳ Create WebhookReceipt model
- ⏳ Update webhook handler to record receipt
- ⏳ Implement cleanup job
- ⏳ Schedule cleanup job (every 5 minutes)
- ⏳ Add monitoring and alerts
- ⏳ Add tests for recovery scenarios

---

## Key Lessons

1. **Separation of Concerns is Critical**
   - Routes set status (what happened)
   - Webhook handles consequences (what to do about it)

2. **Timestamps Should Be Precise**
   - Set at the moment of action (route level)
   - Fallback option if action is deferred (webhook level)

3. **Idempotency Prevents Cascading Failures**
   - If end_room() can be called safely multiple times
   - Routes don't need error handling boilerplate

4. **Not All Actions Are Equal**
   - Some apply to all statuses (counters, experience)
   - Some apply to specific statuses (transactions, tasks)
   - Make these distinctions explicit in code

5. **Webhooks Are Unreliable**
   - Always plan for webhook loss
   - Always have a recovery mechanism
   - Receipt tracking is cheap insurance

6. **Use Unique Constraints**
   - Prevent duplicate processing
   - Let database enforce idempotency
   - Cheaper than application logic

---

## References

- **SESSION_COMPLETION_QUICK_REFERENCE.md** - Visual quick lookup
- **WHY_ACTUAL_END_AT_DUPLICATION.md** - Timestamp design explanation
- **IDEMPOTENT_END_ROOM.md** - Error handling design
- **DATABASE_CONSISTENCY_WEBHOOK.md** - Webhook reliability analysis
- **DATABASE_CONSISTENCY_VISUAL.md** - Failure scenario diagrams
- **WEBHOOK_CONSISTENCY_IMPLEMENTATION.md** - Step-by-step implementation
- **DATABASE_CONSISTENCY_SUMMARY.md** - Executive summary
