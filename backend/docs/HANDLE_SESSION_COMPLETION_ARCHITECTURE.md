# Architecture: Single Source of Truth for Session Completion

## Overview

All session completion logic is now centralized in a single function: `handle_session_completion()` in `app/utils/livekit.py`.

This function is called by:

- **Routes** (request_session_completion, accept_session_completion, cancel_session)
- **Celery tasks** (cleanup_expired_livekit_room)
- **Webhook** (room_finished - safety net only)

## The Problem This Solves

Previously, session completion logic was scattered across multiple files:

- Routes set status and deleted room
- Webhook created transactions and updated counters
- Celery task just set status and waited for webhook

This created:

- ❌ Silent failures (webhook might not arrive)
- ❌ Data inconsistencies
- ❌ Code duplication
- ❌ Difficult to maintain

## The Solution: Centralized Handler

```
┌─────────────────────────────────────────────────────────────┐
│  request_session_completion()                               │
│  accept_session_completion()                                │
│  cancel_session()                                           │
│  cleanup_expired_livekit_room() [Celery]                    │
│  room_finished [Webhook - safety net only]                  │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────────┐
        │ handle_session_completion()      │
        │ ──────────────────────────────── │
        │ 1. Set status & end time         │
        │ 2. Create transaction (if ok)    │
        │ 3. Update counters (all cases)   │
        │ 4. Increment experience (all)    │
        │ 5. Commit to database            │
        │ 6. Emit Socket.IO events         │
        │ 7. Schedule post-session tasks   │
        │ 8. Delete LiveKit room           │
        └──────────────────────────────────┘
```

## Implementation Details

### Function Signature

```python
async def handle_session_completion(
    session,
    booking,
    db,
    completion_status,
) -> None:
    """
    Handle all common session completion logic.

    Called by:
    - Routes: request_session_completion, accept_session_completion, cancel_session
    - Celery: cleanup_expired_livekit_room
    - Webhook: room_finished (safety net only)

    Handles:
    1. Mark session with completion_status (COMPLETED, CANCELLED_BY_TEACHER, CANCELLED_BY_STUDENT)
    2. Record actual_end_at timestamp
    3. Create transaction (only for COMPLETED and CANCELLED_BY_STUDENT)
    4. Update booking counters (for all statuses)
    5. Increment teacher experience (for all statuses)
    6. Emit Socket.IO events
    7. Schedule post-session Celery tasks (only for COMPLETED)
    8. Delete the LiveKit room
    """
```

### Transaction Logic

| Status               | Transaction | Counters | Experience | Reason                              |
| -------------------- | ----------- | -------- | ---------- | ----------------------------------- |
| COMPLETED            | ✅ Yes      | ✅ Yes   | ✅ Yes     | Teacher did the work                |
| CANCELLED_BY_STUDENT | ✅ Yes      | ✅ Yes   | ✅ Yes     | Teacher's time reserved (penalty)   |
| CANCELLED_BY_TEACHER | ❌ No       | ✅ Yes   | ✅ Yes     | Teacher's own cancellation (no pay) |

### Error Handling

```python
# Critical operations (failures stop execution)
session.status = ...
db.add(Transaction(...))
booking.completed_sessions += 1
await db.commit()  # ← All data is now safe

# Non-critical operations (failures logged but not re-raised)
try:
    await end_room(...)  # Best effort
except Exception:
    logger.warning(...)

try:
    await sio.emit(...)  # Best effort
except Exception:
    logger.warning(...)

try:
    schedule_celery_tasks()  # Fire and forget
except Exception:
    logger.warning(...)
```

## Usage Examples

### Route: Auto-Complete (Duration Reached)

```python
@router.post("/{session_id}/request-session-completion")
async def request_session_completion(session_id, current_user, db):
    session, booking = await _get_session_with_booking(db, session_id)

    if elapsed_seconds >= required_duration_seconds:
        # Call the common handler
        await handle_session_completion(
            session=session,
            booking=booking,
            db=db,
            completion_status=SessionStatus.COMPLETED,
        )
        return session
```

### Route: Premature Completion (Student Accepts)

```python
@router.post("/{session_id}/accept-premature-session-completion")
async def accept_session_completion(session_id, current_user, db):
    session, booking = await _get_session_with_booking(db, session_id)

    # Clean up Redis
    await cache_delete(redis_key)

    # Call the common handler
    await handle_session_completion(
        session=session,
        booking=booking,
        db=db,
        completion_status=SessionStatus.COMPLETED,
    )
    return session
```

### Route: Cancel Session

```python
@router.post("/{session_id}/cancel")
async def cancel_session(session_id, current_user, db):
    session, booking = await _get_session_with_booking(db, session_id)

    is_teacher = current_user.id == booking.teacher_id
    cancel_status = (
        SessionStatus.CANCELLED_BY_TEACHER
        if is_teacher
        else SessionStatus.CANCELLED_BY_STUDENT
    )

    # Call the common handler with appropriate status
    await handle_session_completion(
        session=session,
        booking=booking,
        db=db,
        completion_status=cancel_status,
    )
    return session
```

### Celery Task: Cleanup Expired Session

```python
async def _async_cleanup_expired_livekit_room(session_id):
    async with AsyncSessionLocal() as db:
        session = fetch_session_with_booking()

        if session.status != SessionStatus.IN_PROGRESS:
            return  # Already completed

        # Call the common handler
        await handle_session_completion(
            session=session,
            booking=session.booking,
            db=db,
            completion_status=SessionStatus.COMPLETED,
        )
```

### Webhook: Safety Net (Only If Not IN_PROGRESS)

```python
@router.post("/webhook")
async def livekit_webhook(request, db, authorization):
    # ... validation ...

    if event.event == "room_finished":
        session, booking = await _get_session_and_booking(db, event.room.name)

        # Only process if routes/tasks failed
        if session.status == SessionStatus.IN_PROGRESS:
            logger.warning("Route/task failed, completing as fallback")
            await handle_session_completion(
                session=session,
                booking=booking,
                db=db,
                completion_status=SessionStatus.COMPLETED,
            )
        else:
            logger.debug("Already processed by routes/tasks")
```

## Database Consistency Guarantee

✅ **Atomic Commits** - All critical data (status, counters, transactions) commit together  
✅ **All or Nothing** - Either all succeeds or entire transaction rolls back  
✅ **No Silent Failures** - Errors are caught synchronously  
✅ **Non-Critical Failures Ignored** - Socket.IO/room deletion failures don't affect data  
✅ **Webhook Idempotency** - Webhook only acts if status is still IN_PROGRESS

## Execution Flow

### Scenario 1: Teacher Ends Session (Normal Path)

```
1. Teacher clicks "End Session"
2. Route validates: session IN_PROGRESS, duration reached
3. Route calls: handle_session_completion(status=COMPLETED)
   ├─ Set session.status = COMPLETED ✓
   ├─ Create transaction (CREDIT teacher) ✓
   ├─ Update booking.completed_sessions += 1 ✓
   ├─ Increment experience ✓
   ├─ Commit to DB ✓ (all data safe)
   ├─ Delete room (best effort)
   ├─ Emit Socket.IO (best effort)
   └─ Schedule tasks (fire & forget)
4. Webhook receives room_finished
   └─ Sees status = COMPLETED
   └─ Logs: "Already processed"
```

### Scenario 2: Session Expires (Celery Path)

```
1. T = session start + duration + leniency
2. Celery task runs: cleanup_expired_livekit_room()
3. Checks: session status = IN_PROGRESS? ✓
4. Calls: handle_session_completion(status=COMPLETED)
   ├─ Set status = COMPLETED ✓
   ├─ Create transaction ✓
   ├─ Update counters ✓
   ├─ Increment experience ✓
   ├─ Commit ✓ (all safe)
   └─ Delete room + notify + schedule (best effort)
5. Webhook receives room_finished
   └─ Sees status = COMPLETED
   └─ Already processed
```

### Scenario 3: Routes/Tasks Failed (Webhook Safety Net)

```
1. Something failed in routes or Celery
2. Session status still IN_PROGRESS
3. Webhook receives room_finished
4. Checks: status = IN_PROGRESS? ✓
5. Logs warning: "Route/task failed, completing now"
6. Calls: handle_session_completion(status=COMPLETED)
   ├─ Set status = COMPLETED ✓
   ├─ Create transaction ✓
   ├─ Update counters ✓
   └─ Everything is now consistent
```

## Files Modified

### 1. `app/utils/livekit.py`

- ✅ Added: `handle_session_completion()` function

### 2. `app/api/v1/endpoints/sessions.py`

- ✅ Removed: `_complete_session()` helper (moved to utils)
- ✅ Updated: `request_session_completion()` to call handler
- ✅ Updated: `accept_session_completion()` to call handler
- ✅ Updated: `cancel_session()` to call handler

### 3. `app/tasks/livekit_tasks.py`

- ✅ Updated: `_async_cleanup_expired_livekit_room()` to call handler

### 4. `app/api/v1/endpoints/livekit.py`

- ✅ Updated: `room_finished` webhook to be safety net only

## Benefits

| Aspect                     | Before                   | After                    |
| -------------------------- | ------------------------ | ------------------------ |
| **Single Source of Truth** | ❌ Logic scattered       | ✅ Centralized           |
| **Consistency**            | ❌ High risk of failures | ✅ Guaranteed            |
| **Code Duplication**       | ❌ Yes (multiple places) | ✅ No                    |
| **Webhook Dependency**     | ❌ Critical path         | ✅ Safety net only       |
| **Silent Failures**        | ❌ Possible              | ✅ Eliminated            |
| **Atomicity**              | ❌ Multiple commits      | ✅ Single atomic commit  |
| **Testability**            | ❌ Hard to test          | ✅ Easy to test function |
| **Maintainability**        | ❌ Hard to maintain      | ✅ Easy to maintain      |

## Testing Checklist

- [ ] Test auto-completion route (duration reached)
- [ ] Test premature completion route (student accepts)
- [ ] Test cancellation by teacher
- [ ] Test cancellation by student
- [ ] Test Celery cleanup task
- [ ] Test webhook safety net (if routes fail)
- [ ] Verify database transactions are atomic
- [ ] Verify counters are updated correctly
- [ ] Verify transactions created for right statuses
- [ ] Verify Socket.IO events emitted
- [ ] Verify Celery tasks scheduled

## Deployment Notes

✅ No breaking changes  
✅ Backward compatible  
✅ All logic in one place makes it easy to debug  
✅ Webhook logs will show "Already processed" for normal cases  
✅ Monitor webhook logs for safety net invocations (sign that routes/tasks failed)

## Next Steps

1. Run all tests to verify functionality
2. Deploy to staging
3. Test all completion paths manually
4. Monitor production logs
5. If webhook ever completes a session, investigate why routes/tasks didn't
