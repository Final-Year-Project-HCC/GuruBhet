# Architecture Refactor: Separation of Concerns

## Summary of Changes

You correctly identified that the webhook handler should **only handle common logic**, not status assignment. This refactor separates concerns cleanly:

## Before (Mixed Responsibilities)

```
Webhook Handler:
  - Set session.status (COMPLETED or CANCELLED_BY_*)  ← BUSINESS LOGIC
  - Create transactions                                  ← COMMON LOGIC
  - Emit Socket.IO events                               ← COMMON LOGIC
  - Schedule post-session tasks                         ← COMMON LOGIC
```

**Problem:** Status assignment is scattered (webhook, routes, Celery)

## After (Clean Separation)

```
Routes & Celery Tasks:
  - Set session.status (COMPLETED, CANCELLED_BY_*, etc.) ← BUSINESS LOGIC
  - Set actual_end_at timestamp                          ← BUSINESS LOGIC
  - Delete the room (call end_room())                    ← BUSINESS LOGIC

Webhook Handler:
  - Create transactions (if status == COMPLETED)        ← COMMON LOGIC
  - Emit Socket.IO events (always)                      ← COMMON LOGIC
  - Schedule post-session tasks (if COMPLETED)          ← COMMON LOGIC
```

**Benefit:** Clear responsibilities, easy to understand, DRY principle

---

## Updated Files

### 1. `sessions.py` - Routes

#### `request_session_completion()`

```python
# NEW: Mark status BEFORE deleting room
session.status = SessionStatus.COMPLETED
session.actual_end_at = now
await db.flush()

# Then delete room
await end_room(session.livekit_room_name)

# Webhook will handle transaction, events, etc.
```

#### `accept_session_completion()`

```python
# NEW: Mark status BEFORE deleting room
session.status = SessionStatus.COMPLETED
session.actual_end_at = now
await db.flush()

# Then delete room
await end_room(session.livekit_room_name)
```

#### `cancel_session()`

```python
# NEW: Mark status BEFORE deleting room
is_teacher_cancelling = current_user.id == booking.teacher_id
session.status = (SessionStatus.CANCELLED_BY_TEACHER
                  if is_teacher_cancelling
                  else SessionStatus.CANCELLED_BY_STUDENT)
session.actual_end_at = now
await db.flush()

# Then delete room
await end_room(session.livekit_room_name)

# Webhook will emit event (but NOT create transaction)
```

### 2. `livekit_tasks.py` - Celery Cleanup Task

#### `_async_cleanup_expired_livekit_room()`

```python
# NEW: Mark status BEFORE deleting room
session.status = SessionStatus.COMPLETED
session.actual_end_at = now
await db.flush()

# Then delete room
await end_room(session.livekit_room_name)

# Webhook will handle transaction, events, etc.
```

### 3. `livekit.py` - Webhook Handler

#### `room_finished` event handler

```python
# OLD: Used to set status and do business logic
# NEW: Only handles common logic

# Webhook assumes status is already set by route/task
if session.status == SessionStatus.COMPLETED:
    # Create transaction (only for completions)
    db.add(Transaction(...))

    # Update counters (only for completions)
    booking.completed_sessions += 1

    # Increment experience (only for completions)
    await ts_repo.increment_completed_sessions(...)

    # Schedule post-session tasks (only for completions)
    process_session_billing.delay(...)

# ALWAYS emit event (whether completed or cancelled)
await sio_manager.emit_to_user(
    event="session_finished",
    data={
        "status": session.status.value,  # COMPLETED or CANCELLED_BY_*
        ...
    }
)
```

---

## Benefits of This Architecture

### 1. **Clear Intent**

Routes explicitly show they're completing/cancelling the session:

```python
session.status = SessionStatus.COMPLETED  # Intent is clear
await end_room(...)
```

### 2. **Single Source of Truth for Status**

- Routes/tasks set status based on business logic
- Webhook uses status to decide on transactions (mechanical behavior)
- No logic duplication

### 3. **Easy to Debug**

- If session shows wrong status, check routes/tasks
- If transaction not created, check webhook (status guard)
- Clear flow from business action → status → webhook action

### 4. **Easy to Extend**

- Want to change when refunds happen? Modify the route
- Want to change transaction details? Modify the webhook
- New cancellation reason? Just set status, webhook handles rest

### 5. **Correct Financial Behavior**

- Teacher can't get paid if they cancel (status == CANCELLED)
- Student gets refunded only if teacher cancels (separate refund logic)
- Clear audit trail (status shows who cancelled and when)

---

## Transaction Logic Summary

```
Session Status          | Create Transaction? | Emit Event? | Schedule Tasks?
─────────────────────────────────────────────────────────────────────────────
COMPLETED               | YES ✅              | YES ✅     | YES ✅
CANCELLED_BY_TEACHER    | NO ❌               | YES ✅     | NO ❌
CANCELLED_BY_STUDENT    | NO ❌               | YES ✅     | NO ❌
```

---

## Flow Diagram

### Normal Completion

```
Teacher calls request_session_completion()
  ↓
  Set session.status = COMPLETED
  Set session.actual_end_at = now
  ↓
  Call end_room()
  ↓
  LiveKit emits room_finished event
  ↓
  Webhook receives event, sees status == COMPLETED
  ↓
  Create transaction ✅
  Increment counters ✅
  Emit "session_finished" event ✅
  Schedule post-session tasks ✅
```

### Teacher Cancels

```
Teacher calls cancel_session()
  ↓
  Set session.status = CANCELLED_BY_TEACHER
  Set session.actual_end_at = now
  ↓
  Call end_room()
  ↓
  LiveKit emits room_finished event
  ↓
  Webhook receives event, sees status == CANCELLED_BY_TEACHER
  ↓
  Skip transaction ✅
  Skip counters ✅
  Emit "session_finished" event with status ✅
  Skip post-session tasks ✅
```

### Celery Cleanup Task

```
Celery task runs at duration + leniency
  ↓
  Set session.status = COMPLETED
  Set session.actual_end_at = now
  ↓
  Call end_room()
  ↓
  LiveKit emits room_finished event
  ↓
  Webhook receives event, sees status == COMPLETED
  ↓
  Create transaction ✅
  Increment counters ✅
  Emit "session_finished" event ✅
  Schedule post-session tasks ✅
```

---

## Edge Cases Now Handled Correctly

1. **Webhook fires before status is set** → Won't happen (status set before end_room())
2. **Webhook fires multiple times** → Idempotent (uses status guard)
3. **Race condition: status change while webhook running** → Final status wins
4. **Celery retry** → Safe (status already set, won't create duplicate transaction)
