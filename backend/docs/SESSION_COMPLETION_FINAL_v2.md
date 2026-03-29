# Session Completion Logic - Final Design v2

## Core Principle

**All sessions (COMPLETED, CANCELLED_BY_STUDENT, CANCELLED_BY_TEACHER) count toward booking completion.**

The only difference is whether the teacher receives payment:

- **Transaction created:** COMPLETED and CANCELLED_BY_STUDENT
- **No transaction:** CANCELLED_BY_TEACHER

---

## Behavior by Status

### ✅ COMPLETED

- **Transaction:** Yes ✅ (teacher gets paid)
- **Counters:** Yes ✅ (counts toward completed_sessions)
- **Experience:** Yes ✅ (teacher's experience increases)
- **Post-Tasks:** Yes ✅ (billing, notifications)

Teacher did the full session → gets paid and gets experience.

### ✅ CANCELLED_BY_STUDENT

- **Transaction:** Yes ✅ (teacher gets paid)
- **Counters:** Yes ✅ (counts toward completed_sessions)
- **Experience:** Yes ✅ (teacher's experience increases)
- **Post-Tasks:** No ❌ (no billing/notifications)

Student cancelled → teacher keeps the fee and counts the session. No refund for student.

### ✅ CANCELLED_BY_TEACHER

- **Transaction:** No ❌ (teacher doesn't get paid)
- **Counters:** Yes ✅ (still counts toward completed_sessions)
- **Experience:** Yes ✅ (still counts toward experience)
- **Post-Tasks:** No ❌ (no billing/notifications)

Teacher cancelled → doesn't get paid but session still counts toward booking progress and teacher experience.

---

## Webhook Logic

```python
# ── Determine transaction (only COMPLETED and CANCELLED_BY_STUDENT) ──
if session.status in (SessionStatus.COMPLETED, SessionStatus.CANCELLED_BY_STUDENT):
    # Create transaction - teacher gets paid
    db.add(Transaction(...))
    # CANCELLED_BY_TEACHER does NOT get transaction

# ── Update counters (ALL statuses) ──
booking.completed_sessions += 1  # Always increment
if booking.completed_sessions >= booking.total_sessions:
    booking.status = BookingStatus.COMPLETED
# Result: All sessions count toward booking completion

# ── Increment experience (ALL statuses) ──
await ts_repo.increment_completed_sessions(...)
# Result: All sessions count toward teacher experience

# ── Post-session tasks (only COMPLETED) ──
if session.status == SessionStatus.COMPLETED:
    process_session_billing.delay(...)
    send_session_complete_notification.delay(...)
```

---

## Summary Table

| Status                   | Transaction | Counters | Experience | Booking Progress | Post-Tasks |
| ------------------------ | ----------- | -------- | ---------- | ---------------- | ---------- |
| **COMPLETED**            | ✅ Yes      | ✅ Yes   | ✅ Yes     | ✅ Counts        | ✅ Yes     |
| **CANCELLED_BY_STUDENT** | ✅ Yes      | ✅ Yes   | ✅ Yes     | ✅ Counts        | ❌ No      |
| **CANCELLED_BY_TEACHER** | ❌ No       | ✅ Yes   | ✅ Yes     | ✅ Counts        | ❌ No      |

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

## Booking Progress Calculation

```
booking_progress = completed_sessions / total_sessions
```

**All sessions count toward completed_sessions:**

- ✅ COMPLETED sessions
- ✅ CANCELLED_BY_STUDENT sessions
- ✅ CANCELLED_BY_TEACHER sessions

This means a booking with 10 sessions will show 100% completion regardless of status mix.

### Example

Booking has 10 sessions:

- 5 sessions COMPLETED
- 3 sessions CANCELLED_BY_STUDENT
- 2 sessions CANCELLED_BY_TEACHER

Results:

- **Booking progress:** 10/10 = 100% ✅
- **Teacher earned:** 5 + 3 = 8 fees (didn't get paid for 2)
- **Teacher experience:** +10 sessions (all count)
- **Student refunds:** 2 sessions (from CANCELLED_BY_TEACHER)

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

        # ── TRANSACTION LOGIC (only for COMPLETED and CANCELLED_BY_STUDENT) ──
        if session.status in (SessionStatus.COMPLETED, SessionStatus.CANCELLED_BY_STUDENT):
            db.add(Transaction(
                user_id=booking.teacher_id,
                amount=booking.rate_per_session,
                type=TransactionType.CREDIT,
                reason=TransactionReason.SESSION_RELEASE,
                booking_id=booking.id,
            ))
            await db.flush()

        # ── COUNTERS & EXPERIENCE (all statuses) ──
        booking.completed_sessions += 1  # All sessions count
        if booking.completed_sessions >= booking.total_sessions:
            booking.status = BookingStatus.COMPLETED
        await db.flush()

        ts_repo = TeacherSubjectRepository(db)
        await ts_repo.increment_completed_sessions(
            teacher_id=booking.teacher_id,
            subject_id=booking.subject_id,
        )  # All sessions count toward experience
        await db.flush()

        # ── EMIT EVENT (always) ──
        sio_manager.emit_to_user(
            event="session_finished",
            data={
                "session_id": str(session.id),
                "status": session.status.value,
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

## Key Insights

1. **Booking Completion:** All sessions (regardless of status) count toward the booking completion percentage
2. **Teacher Experience:** All sessions increase teacher's experience (they "worked" even if they cancelled)
3. **Teacher Payment:** Only COMPLETED and CANCELLED_BY_STUDENT sessions generate payment
4. **Teacher Penalty:** CANCELLED_BY_TEACHER loses the fee for that session
5. **Student Penalty:** CANCELLED_BY_STUDENT loses their payment (no refund)
6. **Student Refund:** Only CANCELLED_BY_TEACHER triggers a refund

---

## Testing Scenarios

### Scenario 1: All Sessions Completed

- 10 sessions, all COMPLETED
- Booking progress: 10/10 = 100%
- Teacher earned: 10 fees
- Teacher experience: +10
- Student paid: Full amount, no refund

### Scenario 2: All Sessions Cancelled by Student

- 10 sessions, all CANCELLED_BY_STUDENT
- Booking progress: 10/10 = 100%
- Teacher earned: 10 fees
- Teacher experience: +10
- Student paid: Full amount, no refund

### Scenario 3: All Sessions Cancelled by Teacher

- 10 sessions, all CANCELLED_BY_TEACHER
- Booking progress: 10/10 = 100%
- Teacher earned: 0 fees
- Teacher experience: +10
- Student paid: Full amount, gets 100% refund

### Scenario 4: Mixed Scenario

- 5 COMPLETED + 3 CANCELLED_BY_STUDENT + 2 CANCELLED_BY_TEACHER
- Booking progress: 10/10 = 100%
- Teacher earned: 8 fees (5 + 3)
- Teacher experience: +10
- Student paid: Full amount, gets refund for 2 sessions
- Status: Booking marked COMPLETED (meets total_sessions)

---

## Design Philosophy

This design separates three concerns:

1. **Booking Completion** → All sessions count (progress tracking)
2. **Teacher Experience** → All sessions count (skill building)
3. **Teacher Payment** → Only COMPLETED and CANCELLED_BY_STUDENT count (financial incentive)

This way:

- Booking progress is objective (number of sessions conducted)
- Teacher experience reflects time invested (even if penalized financially)
- Teacher payment creates incentive to not cancel, but still get paid if student cancels
- Student penalty is consistent (loses money if they cancel)
