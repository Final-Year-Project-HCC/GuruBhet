# Transaction Logic by Session Status

## Architecture Principles

### Separation of Concerns

**Routes & Celery Tasks** are responsible for:

- Setting the session status (COMPLETED, CANCELLED_BY_TEACHER, CANCELLED_BY_STUDENT)
- Deleting the LiveKit room

**Webhook Handler** is responsible for:

- Creating transactions (only if session.status == COMPLETED)
- Emitting Socket.IO events (always, with current status)
- Scheduling post-session tasks (only if completed)

### Key Principle: Status-Driven Transactions

**Always emit `"session_finished"` event** to both participants (whether completed or cancelled)

**Only create transactions** when `session.status == COMPLETED`

**Skip transactions** when session is `CANCELLED_BY_TEACHER` or `CANCELLED_BY_STUDENT`

## Session Completion Flows

### 1. ✅ Session Completed Normally

**Trigger:** Teacher requests completion OR Celery task expires after duration + leniency

**Flow:**

```
Route (request_session_completion) or Celery Task (cleanup_expired_livekit_room)
  → Mark session.status = COMPLETED
  → Set session.actual_end_at
  → Flush to DB
  → Call end_room()
    → LiveKit emits room_finished webhook
      → webhook receives event
        → session.status == COMPLETED ✅
          → Create SESSION_RELEASE credit transaction ✅
          → Increment booking.completed_sessions ✅
          → Increment teacher experience ✅
          → Emit "session_finished" Socket.IO event ✅
          → Schedule post-session Celery tasks ✅
```

**Who Sets Status:** Route or Celery Task
**Who Creates Transaction:** Webhook
**Who Emits Event:** Webhook

**Result:**

- Session marked COMPLETED (by route/task)
- Teacher credited with full session fee (by webhook)
- Booking counter updated (by webhook)
- Teacher experience incremented (by webhook)
- Client notified via Socket.IO with `status: "COMPLETED"` (by webhook)
- Post-session tasks scheduled (by webhook)

---

### 2. ❌ Session Cancelled by Teacher

**Trigger:** Teacher calls cancel endpoint

**Flow:**

```
endpoint (cancel_session)
  → session.status = CANCELLED_BY_TEACHER
  → calls end_room()
    → LiveKit emits room_finished webhook
      → webhook receives event
        → session.status = CANCELLED_BY_TEACHER (NOT IN_PROGRESS)
          → Skip transaction creation ✅ (correct!)
          → Skip experience increment ✅ (correct!)
          → Skip booking counter update ✅ (correct!)
          → Emit "session_cancelled" Socket.IO event ✅
          → Skip post-session Celery tasks ✅ (correct!)
```

**Transaction Created:** NONE ❌ (correct - don't credit teacher)

**Socket.IO Event:**

- **Event:** `"session_finished"`
- **Data includes:** `status: "CANCELLED_BY_TEACHER"`

**Additional Logic:**

- TODO: Queue refund task for student (since teacher cancelled)

**Result:**

- Session marked CANCELLED_BY_TEACHER
- **No credit to teacher** (important!)
- Client notified via Socket.IO with cancellation status
- Student should receive refund

---

### 3. ❌ Session Cancelled by Student

**Trigger:** Student calls cancel endpoint

**Flow:**

```
endpoint (cancel_session)
  → session.status = CANCELLED_BY_STUDENT
  → calls end_room()
    → LiveKit emits room_finished webhook
      → webhook receives event
        → session.status = CANCELLED_BY_STUDENT (NOT IN_PROGRESS)
          → Skip transaction creation ✅ (correct!)
          → Skip experience increment ✅ (correct!)
          → Skip booking counter update ✅ (correct!)
          → Emit "session_cancelled" Socket.IO event ✅
          → Skip post-session Celery tasks ✅ (correct!)
```

**Transaction Created:** NONE ❌ (correct - don't credit teacher)

**Socket.IO Event:**

- **Event:** `"session_finished"`
- **Data includes:** `status: "CANCELLED_BY_STUDENT"`

**Additional Logic:**

- **No refund** to student (student cancelled, student loses money)

**Result:**

- Session marked CANCELLED_BY_STUDENT
- **No credit to teacher** (important!)
- Client notified via Socket.IO with cancellation status
- Student keeps payment as penalty

---

## Key Protection: Status Check

The webhook handler now checks session status **before creating any transactions**:

```python
if session.status == SessionStatus.IN_PROGRESS:
    # Create transaction ✅ (normal completion)
    # Update counters ✅
    # Increment experience ✅
elif session.status in (SessionStatus.CANCELLED_BY_STUDENT, SessionStatus.CANCELLED_BY_TEACHER):
    # Emit cancellation event ✅
    # No transaction creation ✅
    # No counter updates ✅
else:
    # Already COMPLETED - just log it
    # No duplicate transaction ✅
```

## Why This Matters

**Before this fix:**

- Any `room_finished` event would create a SESSION_RELEASE transaction
- Cancellations would incorrectly credit the teacher
- This could be exploited: teacher cancels session → still gets paid ❌

**After this fix:**

- Only genuine session completions create transactions
- Cancellations don't generate credit (correctly punish the canceller)
- Transaction logic is idempotent (safe for retries)

## Testing Scenarios

### Scenario A: Normal Completion

1. Session runs for full duration + leniency
2. Teacher requests completion
3. Endpoint calls `end_room()`
4. Webhook fires with session.status = IN_PROGRESS
5. ✅ Transaction created (teacher gets credited)
6. ✅ Client notified with "session_finished" event with `status: "COMPLETED"`

### Scenario B: Teacher Cancels

1. Session is READY (not started yet) or IN_PROGRESS
2. Teacher calls cancel endpoint
3. Session status changed to CANCELLED_BY_TEACHER
4. Endpoint calls `end_room()`
5. Webhook fires with session.status = CANCELLED_BY_TEACHER
6. ❌ No transaction created (teacher NOT credited)
7. ✅ Client notified with "session_finished" event with `status: "CANCELLED_BY_TEACHER"`

### Scenario C: Student Cancels

1. Session is READY (not started yet) or IN_PROGRESS
2. Student calls cancel endpoint
3. Session status changed to CANCELLED_BY_STUDENT
4. Endpoint calls `end_room()`
5. Webhook fires with session.status = CANCELLED_BY_STUDENT
6. ❌ No transaction created (teacher NOT credited)
7. ✅ Client notified with "session_finished" event with `status: "CANCELLED_BY_STUDENT"`

## Edge Cases Handled

### Edge Case: Webhook fires for already-completed session

- Session status is COMPLETED
- Webhook receives room_finished
- ✅ No duplicate transaction (status != IN_PROGRESS)
- ✅ Logs warning for audit purposes

### Edge Case: Rapid cancellation after room deletion

- Teacher initiates completion → end_room() called
- Student simultaneously cancels → marks session CANCELLED_BY_STUDENT
- Webhook fires → finds session.status = CANCELLED_BY_STUDENT
- ✅ No transaction created (correct!)
- ✅ Both cancellation notifications sent

### Edge Case: Celery task retries

- Celery cleanup task calls end_room()
- Webhook fires with whatever current session.status is
- ✅ Idempotent - no duplicate transactions
- ✅ Safe for any number of retries

## Future Enhancements

1. **Refund Logic:** When teacher cancels, queue refund task
   - Still in TODO in `cancel_session()` endpoint
   - Should create DEBIT transaction for refund

2. **Booking State:** Update `booking.cancelled_sessions` counter
   - Currently not tracked
   - Helps with analytics

3. **Payment Retry Logic:** Handle payment failures gracefully
   - Current code assumes transaction creation always succeeds
   - Should have retry mechanism

4. **Notification Customization:** Different messages for different cancellation reasons
   - Currently just sends "cancelled_by" status
   - Could include reason from cancellation_reason field
