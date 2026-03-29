# Session Completion Architecture - Complete Implementation

## Overview

This document summarizes the complete session completion lifecycle implementation, including the most recent change to make `end_room()` idempotent.

## Complete Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ THREE WAYS A SESSION CAN END                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ 1. TEACHER REQUESTS (request_session_completion)                │
│    └─ Duration + leniency reached?                              │
│       ├─ YES: Auto-complete immediately                         │
│       └─ NO: Set Redis key, notify student                      │
│                                                                 │
│ 2. STUDENT ACCEPTS (accept_session_completion)                  │
│    └─ Check Redis key exists, then complete                     │
│                                                                 │
│ 3. TIMEOUT (Celery cleanup task)                                │
│    └─ Duration + leniency expired? Delete room                  │
│                                                                 │
│ OR CANCEL (cancel_session)                                      │
│    └─ Set status CANCELLED_BY_TEACHER or CANCELLED_BY_STUDENT   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Three Independent Dimensions

### 1. Booking Progress (Completion Tracking)

```
All three statuses count toward booking completion:
├─ COMPLETED ✅
├─ CANCELLED_BY_STUDENT ✅
└─ CANCELLED_BY_TEACHER ✅
```

### 2. Teacher Experience (Reputation/Stats)

```
All three statuses increment teacher's completed sessions:
├─ COMPLETED ✅
├─ CANCELLED_BY_STUDENT ✅
└─ CANCELLED_BY_TEACHER ✅
```

### 3. Teacher Payment (Financial)

```
Only COMPLETED and CANCELLED_BY_STUDENT create transactions:
├─ COMPLETED ✅ (teacher did the work)
├─ CANCELLED_BY_STUDENT ✅ (teacher's time was reserved)
└─ CANCELLED_BY_TEACHER ❌ (teacher's own cancellation, no payment)
```

## Architecture: Three-Layer Separation of Concerns

### Layer 1: Status Assignment (Routes + Celery)

**Responsibility:** Set session status before deleting room

**Files:**

- `app/api/v1/endpoints/sessions.py` - Three endpoints
- `app/tasks/livekit_tasks.py` - Celery cleanup task

**Pattern:**

```python
session.status = SessionStatus.COMPLETED  # or CANCELLED_BY_*
session.actual_end_at = now               # Record exact timing
await db.flush()
await end_room(session.livekit_room_name) # Delete room (idempotent)
await db.commit()
# Webhook fires and handles common logic...
```

### Layer 2: Room Deletion (LiveKit Utility)

**Responsibility:** Delete LiveKit room idempotently

**Files:**

- `app/utils/livekit.py` - end_room() function

**Key Feature:** Handles all failure cases internally

- Room already deleted → ✅ Logs warning, returns normally
- Room doesn't exist → ✅ Logs warning, returns normally
- API unreachable → ✅ Logs warning, returns normally
- Empty room name → ✅ Returns immediately

### Layer 3: Common Logic (Webhook)

**Responsibility:** Process room_finished event and handle post-completion

**Files:**

- `app/api/v1/endpoints/livekit.py` - room_finished webhook handler

**Logic Flow:**

1. Verify session.actual_end_at is set (safety net for routes that set it)
2. Create transaction (only if status in COMPLETED or CANCELLED_BY_STUDENT)
3. Update booking.completed_sessions counter (all statuses)
4. Increment teacher.completed_sessions experience (all statuses)
5. Emit "session_finished" event with status to both participants
6. Schedule post-session tasks (only if status == COMPLETED)

## Key Implementation Details

### Timestamp Management

```
┌─ Request/Task sets actual_end_at = now
│  (accurate timing when room is deleted)
│
├─ Room deletion occurs
│
├─ Webhook fires (may be 50-150ms later)
│
└─ Webhook checks: if not session.actual_end_at
   (safety net, respects route's value if already set)
```

### Transaction Logic

```python
if session.status in (SessionStatus.COMPLETED, SessionStatus.CANCELLED_BY_STUDENT):
    # Credit teacher
    db.add(Transaction(
        user_id=booking.teacher_id,
        amount=booking.rate_per_session,
        type=TransactionType.CREDIT,
        reason=TransactionReason.SESSION_RELEASE,
    ))
```

### Idempotent end_room()

```python
async def end_room(room_name: str) -> None:
    if not room_name:
        return
    try:
        await get_livekit_api().room.delete_room(...)
    except Exception as exc:
        logger.warning(f"Failed to delete room: {exc}")
        # Don't raise - room auto-expires after 24 hours
```

## Files & Their Responsibilities

### Route Endpoints (sessions.py)

| Endpoint                   | Status Set                                   | When                        | Flow                        |
| -------------------------- | -------------------------------------------- | --------------------------- | --------------------------- |
| request_session_completion | COMPLETED                                    | Duration + leniency reached | Delete room → Webhook fires |
| accept_session_completion  | COMPLETED                                    | Student accepts request     | Delete room → Webhook fires |
| cancel_session             | CANCELLED_BY_TEACHER or CANCELLED_BY_STUDENT | Immediately                 | Delete room → Webhook fires |

### Celery Task (livekit_tasks.py)

| Task                                 | Status Set | When                        | Flow                        |
| ------------------------------------ | ---------- | --------------------------- | --------------------------- |
| \_async_cleanup_expired_livekit_room | COMPLETED  | Duration + leniency expired | Delete room → Webhook fires |

### Webhook Handler (livekit.py)

| Event         | Action             | Happens For                     |
| ------------- | ------------------ | ------------------------------- |
| room_finished | Create transaction | COMPLETED, CANCELLED_BY_STUDENT |
| room_finished | Update counters    | All statuses                    |
| room_finished | Emit event         | All statuses                    |
| room_finished | Schedule tasks     | Only COMPLETED                  |

### Utility Function (livekit.py)

| Function   | Idempotent | Handles Errors      |
| ---------- | ---------- | ------------------- |
| end_room() | ✅ Yes     | ✅ Yes (internally) |

## Documentation Files

1. **SESSION_COMPLETION_FINAL_v2.md** - Complete specification with all business rules
2. **FINAL_SESSION_LOGIC_SUMMARY.md** - Quick reference truth table
3. **WHY_ACTUAL_END_AT_DUPLICATION.md** - Explains why timestamp is set in two places
4. **IDEMPOTENT_END_ROOM.md** - Details of idempotent end_room() design
5. **CHANGES_END_ROOM_IDEMPOTENT.md** - Change summary (this feature)

## Testing Checklist

- [ ] Happy path: Teacher initiates completion → Session marked COMPLETED
- [ ] Happy path: Student accepts → Session marked COMPLETED
- [ ] Happy path: Timeout → Session marked COMPLETED
- [ ] Teacher cancels → Session marked CANCELLED_BY_TEACHER, no transaction
- [ ] Student cancels → Session marked CANCELLED_BY_STUDENT, transaction created
- [ ] Webhook idempotency: Process same room_finished twice → No duplicate transactions
- [ ] end_room() idempotency: Delete same room twice → Second call succeeds silently
- [ ] Counters: All statuses increment completed_sessions
- [ ] Experience: All statuses increment teacher experience
- [ ] Post-tasks: Only COMPLETED status schedules billing/notifications

## Edge Cases Handled

### Double Deletion

If `end_room()` is called twice (somehow):

- First call: Deletes room ✅
- Second call: Logs warning, returns normally ✅

### Webhook After Crash

If server crashes between setting status and webhook processing:

- Status already set in database ✅
- Webhook reads the status and continues ✅

### Concurrent Requests

If two endpoints try to delete same room:

- Both call `end_room()` → Both succeed idempotently ✅

### Missing Room

If room was never created or was auto-cleaned:

- `end_room()` still returns normally ✅

## Future Work

- [ ] Implement TODO: Refund logic for CANCELLED_BY_TEACHER (queue Celery task to refund student)
- [ ] Add metrics/telemetry for session completions by status
- [ ] Add audit log for session status changes

## Summary

The session completion system is now:

- ✅ **Separated:** Status assignment in routes, webhook handles common logic
- ✅ **Idempotent:** end_room() gracefully handles already-deleted rooms
- ✅ **Precise:** Timestamp captures exact moment of deletion
- ✅ **Fair:** All statuses count toward progress/experience, only appropriate ones get paid
- ✅ **Robust:** Error handling centralized and logged consistently
- ✅ **Documented:** Every design decision explained in detail
