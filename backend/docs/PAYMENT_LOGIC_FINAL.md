# Session Payment & Status Logic - Final Design

## Overview

The webhook handler decides whether to credit the teacher based on the session status set by routes or Celery tasks.

## Transaction Logic - Who Gets Paid?

### ✅ COMPLETED

- **Transaction:** Yes ✅
- **Counters updated:** Yes ✅
- **Experience incremented:** Yes ✅
- **Post-session tasks:** Yes ✅
- **Why:** Teacher did the work

### ✅ CANCELLED_BY_STUDENT

- **Transaction:** Yes ✅
- **Counters updated:** Yes ✅
- **Experience incremented:** Yes ✅
- **Post-session tasks:** No ❌
- **Why:** Treat as completed (teacher reserved time, student cancelled); teacher gets paid

### ❌ CANCELLED_BY_TEACHER

- **Transaction:** No ❌
- **Counters updated:** No ❌
- **Experience incremented:** No ❌
- **Post-session tasks:** No ❌
- **Why:** Teacher's fault; don't count as completed; student should get refund

---

## Code Logic in Webhook

```python
# ── Credit transaction (COMPLETED or CANCELLED_BY_STUDENT) ──
if session.status in (SessionStatus.COMPLETED, SessionStatus.CANCELLED_BY_STUDENT):
    # Create transaction - teacher gets paid
    db.add(Transaction(
        user_id=booking.teacher_id,
        amount=booking.rate_per_session,
        type=TransactionType.CREDIT,
        reason=TransactionReason.SESSION_RELEASE,
        booking_id=booking.id,
    ))

# ── Update counters (all except CANCELLED_BY_TEACHER) ──
if session.status != SessionStatus.CANCELLED_BY_TEACHER:
    # Treat as completed for booking counter
    booking.completed_sessions += 1

    # Increment teacher experience
    await ts_repo.increment_completed_sessions(...)

# ── Post-session tasks (only COMPLETED, not cancellations) ──
if session.status == SessionStatus.COMPLETED:
    process_session_billing.delay(...)
    send_session_complete_notification.delay(...)
```

---

## Payment Scenarios

| Scenario          | Session Status       | Transaction | Experience | Counters | Post-Tasks | Student Refund  |
| ----------------- | -------------------- | ----------- | ---------- | -------- | ---------- | --------------- |
| Normal completion | COMPLETED            | ✅ Yes      | ✅ Yes     | ✅ Yes   | ✅ Yes     | N/A             |
| Session expires   | COMPLETED            | ✅ Yes      | ✅ Yes     | ✅ Yes   | ✅ Yes     | N/A             |
| Student cancels   | CANCELLED_BY_STUDENT | ✅ Yes      | ✅ Yes     | ✅ Yes   | ❌ No      | ❌ No (penalty) |
| Teacher cancels   | CANCELLED_BY_TEACHER | ❌ No       | ❌ No      | ❌ No    | ❌ No      | ✅ Yes (TODO)   |

---

## Route Changes

All routes now set status **before** calling `end_room()`:

### request_session_completion()

```python
# Mark COMPLETED before deleting room
session.status = SessionStatus.COMPLETED
session.actual_end_at = now
await db.flush()

# Then delete room
await end_room(session.livekit_room_name)

# Webhook handles: transaction, experience, counters, events, tasks
```

### accept_session_completion()

```python
# Mark COMPLETED before deleting room
session.status = SessionStatus.COMPLETED
session.actual_end_at = now
await db.flush()

# Then delete room
await end_room(session.livekit_room_name)

# Webhook handles: transaction, experience, counters, events, tasks
```

### cancel_session()

```python
# Mark status before deleting room
is_teacher = current_user.id == booking.teacher_id
session.status = (SessionStatus.CANCELLED_BY_TEACHER
                  if is_teacher
                  else SessionStatus.CANCELLED_BY_STUDENT)
session.actual_end_at = now
await db.flush()

# Queue refund if teacher cancelled (TODO)
if is_teacher:
    # refund_student(...)

# Then delete room
await end_room(session.livekit_room_name)

# Webhook handles: transaction (if CANCELLED_BY_STUDENT), events
```

---

## Celery Task Changes

### cleanup_expired_livekit_room()

```python
# Mark COMPLETED before deleting room
session.status = SessionStatus.COMPLETED
session.actual_end_at = now
await db.flush()

# Then delete room
await end_room(session.livekit_room_name)

# Webhook handles: transaction, experience, counters, events, tasks
```

---

## Financial Outcomes

### Teacher Revenue Model

- **Completed sessions:** Get paid for work done
- **Student cancellations:** Get paid (they reserved the time)
- **Teacher cancellations:** Don't get paid (their mistake)

### Student Payment Model

- **Completed sessions:** Pay for work received
- **Student cancellations:** Lose payment (penalty for cancelling)
- **Teacher cancellations:** Get refund (teacher's mistake)

---

## Events Always Emitted

Regardless of status, webhook always emits `"session_finished"` with the current status:

```python
await sio_manager.emit_to_user(
    event="session_finished",
    data={
        "session_id": str(session.id),
        "status": session.status.value,  # Can be COMPLETED, CANCELLED_BY_TEACHER, etc.
        "actual_end_at": session.actual_end_at.isoformat(),
    }
)
```

Client can check the `status` field to determine what happened.

---

## TODO Items

1. **Implement student refund task** when CANCELLED_BY_TEACHER
   - Create DEBIT transaction to student account
   - Send refund notification
   - Update booking.refunded_amount

2. **Implement teacher cancellation notification**
   - Alert to student that teacher cancelled
   - Explain that they'll receive a refund

3. **Implement student cancellation tracking**
   - Log or analytics: track which students cancel frequently
   - Consider penalties for repeated cancellations

4. **Update booking.cancelled_sessions counter**
   - Currently not updated when sessions are cancelled
   - Helps track booking completion accurately
