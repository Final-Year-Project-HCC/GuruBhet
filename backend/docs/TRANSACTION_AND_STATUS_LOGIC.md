# Transaction and Status Assignment Logic

## Architecture Principles

### Separation of Concerns

**Routes & Celery Tasks** are respo## Key Protection: Status Check in Webhook

The webhook handler checks session status to decide what to do:

````python
# ── Transaction: COMPLETED or CANCELLED_BY_STUDENT ──
if session.status in (SessionStatus.COMPLETED, SessionStatus.CANCELLED_BY_STUDENT):
    # Create transaction ✅ (teacher gets paid)
    db.add(Transaction(...))

# ── Counters & Experience: All except CANCELLED_BY_TEACHER ──
if session.status != SessionStatus.CANCELLED_BY_TEACHER:
    # Count as completed session
    booking.completed_sessions += 1  ✅
    await ts_repo.increment_completed_sessions(...)  ✅

# ── Post-session tasks: Only COMPLETED ──
if session.status == SessionStatus.COMPLETED:
    # Schedule billing and notification tasks
    process_session_billing.delay(...)
    send_session_complete_notification.delay(...)
```ting the session status (COMPLETED, CANCELLED_BY_TEACHER, CANCELLED_BY_STUDENT)
- Setting actual_end_at timestamp
- Deleting the LiveKit room

**Webhook Handler** (`room_finished` event) is responsible for:
- Creating transactions (only if session.status == COMPLETED)
- Emitting Socket.IO events (always, with current status)
- Scheduling post-session tasks (only if completed)

### Key Principle: Status-Driven Transactions

**Always emit `"session_finished"` event** to both participants

**Create transaction when:**
- `session.status == COMPLETED` → Teacher gets paid (they did the work)
- `session.status == CANCELLED_BY_STUDENT` → Teacher gets paid (their time was reserved)

**Skip transaction when:**
- `session.status == CANCELLED_BY_TEACHER` → No payment (teacher cancelled)

---

## Session Completion Flows

### 1. ✅ Session Completed Normally

**Trigger:** Teacher requests completion OR Celery task expires after duration + leniency

**Who sets status:** Route or Celery Task
**Who creates transaction:** Webhook
**Who emits event:** Webhook

**Flow:**
````

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

**Result:**
- Session marked COMPLETED (by route/task)
- Teacher credited with full session fee (by webhook)
- Booking counter updated (by webhook)
- Teacher experience incremented (by webhook)
- Client notified: `"session_finished"` event with `status: "COMPLETED"`
- Post-session tasks scheduled: billing, notifications

---

### 2. ❌ Session Cancelled by Teacher

**Trigger:** Teacher calls cancel endpoint

**Who sets status:** Route
**Who creates transaction:** Nobody (webhook skips it)
**Who emits event:** Webhook

**Flow:**
```

Route (cancel_session)
→ Mark session.status = CANCELLED_BY_TEACHER
→ Set session.actual_end_at
→ Flush to DB
→ TODO: Queue refund task for student
→ Call end_room()
→ LiveKit emits room_finished webhook
→ webhook receives event
→ session.status == CANCELLED_BY_TEACHER ✅
→ Skip transaction creation ✅ (teacher NOT credited)
→ Skip experience increment ✅
→ Skip booking counter update ✅
→ Emit "session_finished" Socket.IO event ✅
→ Skip post-session Celery tasks ✅

```

**Result:**
- Session marked CANCELLED_BY_TEACHER (by route)
- **No credit to teacher** ✅ (teacher cancelled, shouldn't be paid)
- Client notified: `"session_finished"` event with `status: "CANCELLED_BY_TEACHER"`
- Student receives refund (via separate refund task - TODO)

---

### 3. ✅ Session Cancelled by Student

**Trigger:** Student calls cancel endpoint

**Who sets status:** Route
**Who creates transaction:** Webhook (teacher gets paid!)
**Who emits event:** Webhook

**Flow:**
```

Route (cancel_session)
→ Mark session.status = CANCELLED_BY_STUDENT
→ Set session.actual_end_at
→ Flush to DB
→ Call end_room()
→ LiveKit emits room_finished webhook
→ webhook receives event
→ session.status == CANCELLED_BY_STUDENT ✅
→ Create SESSION_RELEASE credit transaction ✅ (teacher gets paid)
→ Increment experience ✅ (count as completed session)
→ Update booking counter ✅ (count as completed session)
→ Emit "session_finished" Socket.IO event ✅
→ Skip post-session Celery tasks ❌ (not actual completion)

````

**Result:**
- Session marked CANCELLED_BY_STUDENT (by route)
- **Teacher credited** ✅ (student cancelled, teacher's time was reserved)
- **Counted as completed session** ✅ (increments counters and experience)
- Client notified: `"session_finished"` event with `status: "CANCELLED_BY_STUDENT"`
- Student loses payment (no refund - they cancelled)

---

## Key Protection: Status Check in Webhook

The webhook handler checks session status **before creating transactions**:

```python
# Credit teacher if:
# 1. Session was COMPLETED (they did the work)
# 2. Session was CANCELLED_BY_STUDENT (their time was reserved)
# Skip if CANCELLED_BY_TEACHER (their own cancellation)
if session.status in (SessionStatus.COMPLETED, SessionStatus.CANCELLED_BY_STUDENT):
    # Create transaction ✅
    # Update counters (only if COMPLETED) ✅
    # Increment experience (only if COMPLETED) ✅
elif session.status == SessionStatus.CANCELLED_BY_TEACHER:
    # No transaction ✅ (correct!)
    # No counter updates ✅
````

## Why This Matters

**Before this architecture:**

- Webhook would create transactions regardless of session status
- Cancellations would incorrectly credit the teacher
- This could be exploited: teacher cancels session → still gets paid ❌

**After this architecture:**

- Routes/tasks set the status (clear intent)
- Webhook uses status to decide on transactions (automatic behavior)
- Only genuine completions create transactions
- Cancellations don't generate credit (correctly punish the canceller)
- Clear separation of concerns (no duplicated logic)

---

## Testing Scenarios

### Scenario A: Normal Completion

1. Session runs for full duration + leniency
2. Teacher calls `request_session_completion` endpoint
3. Endpoint marks session `COMPLETED` and calls `end_room()`
4. Webhook fires with session.status = COMPLETED
5. ✅ Transaction created (teacher gets credited)
6. ✅ Counters updated, experience incremented
7. ✅ Client notified: `"session_finished"` with `status: "COMPLETED"`

### Scenario B: Celery Cleanup Task

1. Session is scheduled for cleanup (duration + leniency expired)
2. Celery task runs `cleanup_expired_livekit_room`
3. Task marks session `COMPLETED` and calls `end_room()`
4. Webhook fires with session.status = COMPLETED
5. ✅ Transaction created (teacher gets credited)
6. ✅ Counters updated, experience incremented
7. ✅ Client notified: `"session_finished"` with `status: "COMPLETED"`

### Scenario C: Teacher Cancels Early

1. Session is READY or IN_PROGRESS
2. Teacher calls `cancel_session` endpoint
3. Endpoint marks session `CANCELLED_BY_TEACHER` and calls `end_room()`
4. Webhook fires with session.status = CANCELLED_BY_TEACHER
5. ❌ No transaction created (teacher cancelled, shouldn't be paid)
6. ✅ Client notified: `"session_finished"` with `status: "CANCELLED_BY_TEACHER"`
7. Refund task queued for student (TODO implementation)

### Scenario D: Student Cancels

1. Session is READY or IN_PROGRESS
2. Student calls `cancel_session` endpoint
3. Endpoint marks session `CANCELLED_BY_STUDENT` and calls `end_room()`
4. Webhook fires with session.status = CANCELLED_BY_STUDENT
5. ✅ Transaction created (teacher gets paid - they reserved their time)
6. ✅ Client notified: `"session_finished"` with `status: "CANCELLED_BY_STUDENT"`
7. No refund (student loses payment as penalty)

---

## Edge Cases Handled

### Edge Case 1: Webhook fires for already-completed session

- Another call to end_room() after webhook already processed it
- Webhook checks if session.status is already COMPLETED
- ✅ No duplicate transaction (status guard prevents it)
- ✅ Logs info for audit purposes

### Edge Case 2: Rapid status change

- Route marks session COMPLETED and calls end_room()
- Student simultaneously cancels (race condition)
- Whichever status is in DB when webhook fires wins
- ✅ Correct behavior regardless (either gets transaction or doesn't based on final status)

### Edge Case 3: Celery task retries

- Celery cleanup task calls end_room()
- Webhook fires
- Webhook retries on error
- ✅ Idempotent - no duplicate transactions
- ✅ Safe for any number of retries

### Edge Case 4: Room already deleted

- end_room() called, but room was already deleted by LiveKit
- LiveKit doesn't send room_finished event
- Session stays in current status (COMPLETED or CANCELLED)
- ✅ Eventual consistency - monitoring task checks for orphaned rooms

---

## Implementation Details

### Files Involved

1. **Routes (sessions.py)**
   - `request_session_completion()` - Sets status COMPLETED before end_room()
   - `accept_session_completion()` - Sets status COMPLETED before end_room()
   - `cancel_session()` - Sets status CANCELLED_BY_TEACHER or CANCELLED_BY_STUDENT before end_room()

2. **Celery Task (livekit_tasks.py)**
   - `_async_cleanup_expired_livekit_room()` - Sets status COMPLETED before end_room()

3. **Webhook (livekit.py)**
   - `livekit_webhook()` - room_finished handler
   - Checks session.status and creates transactions only if COMPLETED
   - Always emits "session_finished" event with current status
   - Schedules post-session tasks only if COMPLETED

### Transaction Details

**Created only when status == COMPLETED:**

- Type: CREDIT
- Reason: SESSION_RELEASE
- Amount: booking.rate_per_session
- Recipient: booking.teacher_id

---

## Future Enhancements

1. **Refund Logic:** When teacher cancels, queue refund task
   - Currently in TODO in `cancel_session()` endpoint
   - Should create DEBIT transaction for refund to student

2. **Cancelled Sessions Counter:** Update `booking.cancelled_sessions`
   - Currently not tracked
   - Helps with booking completion status

3. **Payment Retry Logic:** Handle payment failures gracefully
   - Current code assumes transaction creation always succeeds
   - Should have retry mechanism for financial operations

4. **Participant No-Show Detection:** Leverage participant_left event
   - Detect if one participant left before session started
   - Mark as cancelled appropriately
