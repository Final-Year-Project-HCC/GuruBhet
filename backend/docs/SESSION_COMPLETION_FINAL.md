# Session Completion Logic - Final Design

## Core Principle

**All sessions except CANCELLED_BY_TEACHER count as "completed"** for the purposes of booking progress.

The only exception is when the teacher cancels - that's treated as incomplete.

---

## Behavior by Status

### ✅ COMPLETED

- **Transaction:** Yes ✅ (teacher gets paid)
- **Counters:** Yes ✅ (counts as completed_sessions)
- **Experience:** Yes ✅ (teacher's experience increases)
- **Post-Tasks:** Yes ✅ (billing, notifications)

Teacher did the full session → gets paid and gets experience.

### ✅ CANCELLED_BY_STUDENT

- **Transaction:** Yes ✅ (teacher gets paid)
- **Counters:** Yes ✅ (counts as completed_sessions)
- **Experience:** Yes ✅ (teacher's experience increases)
- **Post-Tasks:** No ❌ (no billing/notifications)

Student cancelled → teacher keeps the fee as compensation and gets experience credit.

### ❌ CANCELLED_BY_TEACHER

- **Transaction:** No ❌ (teacher doesn't get paid)
- **Counters:** No ❌ (doesn't count toward completion)
- **Experience:** No ❌ (no experience gained)
- **Post-Tasks:** No ❌ (no billing/notifications)

Teacher cancelled → teacher doesn't get paid, student gets refund.

---

## Webhook Logic

```python
# ── Determine transaction ──
if session.status in (SessionStatus.COMPLETED, SessionStatus.CANCELLED_BY_STUDENT):
    # Create transaction - teacher gets paid
    db.add(Transaction(...))
    # Result: Teacher gets paid in both cases

# ── Update counters ──
if session.status != SessionStatus.CANCELLED_BY_TEACHER:
    # Count as completed session
    booking.completed_sessions += 1
    await ts_repo.increment_completed_sessions(...)
    # Result: COMPLETED and CANCELLED_BY_STUDENT count toward booking
    #         CANCELLED_BY_TEACHER does not count

# ── Post-session tasks ──
if session.status == SessionStatus.COMPLETED:
    # Only for actual completions
    process_session_billing.delay(...)
    send_session_complete_notification.delay(...)
    # Result: Only actual completions trigger billing/notifications
```

---

## Financial Summary

### Teacher Earnings

| Status               | Gets Paid |
| -------------------- | --------- |
| COMPLETED            | ✅ Yes    |
| CANCELLED_BY_STUDENT | ✅ Yes    |
| CANCELLED_BY_TEACHER | ❌ No     |

### Student Charges

| Status               | Charged            | Refund          |
| -------------------- | ------------------ | --------------- |
| COMPLETED            | ✅ Yes             | No              |
| CANCELLED_BY_STUDENT | ✅ Yes             | No (penalty)    |
| CANCELLED_BY_TEACHER | ✅ Yes (initially) | ✅ Yes (refund) |

---

## Booking Progress

### Booking Completion Calculation

```
booking_progress = completed_sessions / total_sessions
```

**Counts toward completion:**

- ✅ COMPLETED sessions
- ✅ CANCELLED_BY_STUDENT sessions

**Does NOT count toward completion:**

- ❌ CANCELLED_BY_TEACHER sessions (remain as unfulfilled)

### Example

Booking has 10 sessions:

- 7 sessions COMPLETED → completed_sessions = 7
- 2 sessions CANCELLED_BY_STUDENT → completed_sessions = 9
- 1 session CANCELLED_BY_TEACHER → completed_sessions still = 9 (not counted)

Progress: 9/10 = 90%
Remaining: 1 session (the CANCELLED_BY_TEACHER one needs to be rescheduled)

---

## Implementation in Code

**File:** `app/api/v1/endpoints/livekit.py`  
**Function:** `livekit_webhook()` → `room_finished` event handler

```python
elif event.event == "room_finished" and event.room:
    session, booking = await _get_session_and_booking(db, event.room.name)

    if not session or not booking:
        return {"status": "ok"}

    try:
        # Set actual_end_at if not already set
        if not session.actual_end_at:
            session.actual_end_at = now
            await db.flush()

        # ── TRANSACTION LOGIC ──
        if session.status in (SessionStatus.COMPLETED, SessionStatus.CANCELLED_BY_STUDENT):
            db.add(Transaction(
                user_id=booking.teacher_id,
                amount=booking.rate_per_session,
                type=TransactionType.CREDIT,
                reason=TransactionReason.SESSION_RELEASE,
                booking_id=booking.id,
            ))
            await db.flush()

        # ── COUNTERS & EXPERIENCE LOGIC ──
        if session.status != SessionStatus.CANCELLED_BY_TEACHER:
            booking.completed_sessions += 1
            if booking.completed_sessions >= booking.total_sessions:
                booking.status = BookingStatus.COMPLETED
            await db.flush()

            ts_repo = TeacherSubjectRepository(db)
            await ts_repo.increment_completed_sessions(
                teacher_id=booking.teacher_id,
                subject_id=booking.subject_id,
            )
            await db.flush()

        # ── EMIT EVENT (always) ──
        sio_manager.emit_to_user(
            event="session_finished",
            data={
                "session_id": str(session.id),
                "status": session.status.value,  # COMPLETED or CANCELLED_BY_*
                "actual_end_at": session.actual_end_at.isoformat(),
            }
        )

        # ── POST-SESSION TASKS (only for actual completions) ──
        if session.status == SessionStatus.COMPLETED:
            process_session_billing.delay(...)
            send_session_complete_notification.delay(...)

        await db.commit()

    except Exception as exc:
        await db.rollback()
        logger.error(...)
```

---

## Key Differences from Previous Implementation

| Aspect                                  | Old                       | New                               |
| --------------------------------------- | ------------------------- | --------------------------------- |
| CANCELLED_BY_STUDENT transaction        | No ❌                     | Yes ✅                            |
| CANCELLED_BY_STUDENT counters           | No ❌                     | Yes ✅                            |
| CANCELLED_BY_STUDENT experience         | No ❌                     | Yes ✅                            |
| Booking progress includes cancellations | No                        | Yes (except CANCELLED_BY_TEACHER) |
| Teacher penalty                         | Only CANCELLED_BY_TEACHER | Only CANCELLED_BY_TEACHER         |
| Student penalty                         | CANCELLED_BY_STUDENT      | CANCELLED_BY_STUDENT              |

---

## Testing Scenarios

### Scenario 1: Normal Completion (5 sessions, 1 completed)

1. Teacher and student meet, session runs
2. Teacher calls `request_session_completion()` or timeout occurs
3. Session status set to COMPLETED
4. Webhook processes:
   - ✅ Transaction created (teacher paid)
   - ✅ Counters: completed_sessions = 1
   - ✅ Experience: teacher's count +1
   - ✅ Post-tasks: billing, notifications scheduled
   - ✅ Event: "session_finished" with status COMPLETED
5. Booking progress: 1/5 = 20%

### Scenario 2: Student Cancels (5 sessions, 1 completed + 1 cancelled by student)

1. Teacher and student meet, session runs
2. Student calls `cancel_session()` before completion
3. Session status set to CANCELLED_BY_STUDENT
4. Webhook processes:
   - ✅ Transaction created (teacher paid anyway)
   - ✅ Counters: completed_sessions = 2 (counts this cancellation)
   - ✅ Experience: teacher's count +1
   - ❌ Post-tasks: NOT scheduled (not an actual completion)
   - ✅ Event: "session_finished" with status CANCELLED_BY_STUDENT
5. Booking progress: 2/5 = 40% (cancellation counts as completed)
6. Student loses the payment (no refund - penalty)

### Scenario 3: Teacher Cancels (5 sessions, 1 completed + 1 cancelled by teacher)

1. Teacher and student meet
2. Teacher calls `cancel_session()`
3. Session status set to CANCELLED_BY_TEACHER
4. Webhook processes:
   - ❌ No transaction (teacher not paid)
   - ❌ Counters: completed_sessions stays at 1 (doesn't count)
   - ❌ Experience: teacher's count unchanged
   - ❌ Post-tasks: NOT scheduled
   - ✅ Event: "session_finished" with status CANCELLED_BY_TEACHER
5. Booking progress: 1/5 = 20% (cancellation doesn't count)
6. Student gets refund (teacher's mistake)
7. Session remains to be rescheduled

---

## Edge Cases

### Edge Case 1: All sessions cancelled by student

- Booking shows 5/5 complete (but they're all cancellations)
- Teacher earned full amount
- Students lost full payment
- Intended behavior ✅

### Edge Case 2: All sessions cancelled by teacher

- Booking shows 0/5 complete
- Teacher earned nothing
- Students all got refunded
- Intended behavior ✅

### Edge Case 3: Mixed scenario

- 3 completed + 2 cancelled by student + 1 cancelled by teacher
- Booking shows 5/6 complete
- Teacher earned for 5 sessions
- Remaining 1 needs to be rescheduled
- Intended behavior ✅
