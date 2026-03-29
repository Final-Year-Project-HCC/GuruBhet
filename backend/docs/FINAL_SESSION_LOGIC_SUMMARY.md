# Session Logic - Final Design Summary

## The Three Dimensions

The webhook handler now operates on **three independent dimensions**:

### 1. **Booking Progress** (All sessions count)

```
completed_sessions += 1  ← Always, regardless of status
```

- COMPLETED ✅
- CANCELLED_BY_STUDENT ✅
- CANCELLED_BY_TEACHER ✅

### 2. **Teacher Experience** (All sessions count)

```
increment_completed_sessions(...)  ← Always, regardless of status
```

- COMPLETED ✅
- CANCELLED_BY_STUDENT ✅
- CANCELLED_BY_TEACHER ✅

### 3. **Teacher Payment** (Only some sessions pay)

```
if session.status in (COMPLETED, CANCELLED_BY_STUDENT):
    create_transaction(...)  ← Only these two
```

- COMPLETED ✅
- CANCELLED_BY_STUDENT ✅
- CANCELLED_BY_TEACHER ❌

---

## The Code

```python
# All sessions increment counters
booking.completed_sessions += 1

# All sessions increment experience
await ts_repo.increment_completed_sessions(...)

# Only some sessions create transactions
if session.status in (SessionStatus.COMPLETED, SessionStatus.CANCELLED_BY_STUDENT):
    db.add(Transaction(...))
```

---

## Why This Design?

| Question                                                   | Answer                                                                     |
| ---------------------------------------------------------- | -------------------------------------------------------------------------- |
| Why do all sessions count toward progress?                 | Objective measure: sessions were scheduled and concluded                   |
| Why do all sessions count toward experience?               | Teacher invested time, should gain experience                              |
| Why only COMPLETED and CANCELLED_BY_STUDENT pay?           | Creates incentive: teacher shouldn't cancel, but gets paid if student does |
| Why does CANCELLED_BY_TEACHER not pay?                     | Financial penalty for teacher's own cancellation                           |
| Why does student get refund only for CANCELLED_BY_TEACHER? | Student's payment is protected if teacher cancels                          |

---

## Real World Example

**Booking:** 10 sessions at $50 each = $500 total

**Actual Sessions:**

- Session 1-5: COMPLETED
- Session 6-8: CANCELLED_BY_STUDENT
- Session 9-10: CANCELLED_BY_TEACHER

**Results:**

| Metric             | Value | Calculation                                 |
| ------------------ | ----- | ------------------------------------------- |
| Booking Progress   | 100%  | 10/10 sessions                              |
| Teacher Earned     | $400  | 5 + 3 = 8 fees @ $50                        |
| Teacher Lost       | $100  | 2 cancellations × $50                       |
| Teacher Experience | +10   | All sessions count                          |
| Student Charged    | $500  | Full amount (initially)                     |
| Student Refunded   | $100  | 2 cancellations × $50                       |
| Student Final Cost | $400  | Penalty: lost $100 to student cancellations |

---

## Status Meanings

### COMPLETED ✅

- "Session was completed normally"
- → Teacher gets paid, counts as experience, counts toward booking
- → Student paid in full

### CANCELLED_BY_STUDENT ✅

- "Student cancelled before/during session"
- → Teacher gets paid (penalty on student), counts as experience, counts toward booking
- → Student paid in full (no refund)

### CANCELLED_BY_TEACHER ✅

- "Teacher cancelled before/during session"
- → Teacher doesn't get paid, counts as experience, counts toward booking
- → Student gets refund

---

## Implementation Checklist

✅ Transaction creation: Only COMPLETED and CANCELLED_BY_STUDENT  
✅ Booking counters: All statuses  
✅ Teacher experience: All statuses  
✅ Post-session tasks: Only COMPLETED  
✅ Socket.IO events: Always emitted with status  
✅ Booking status: Updated to COMPLETED when all sessions done

---

## Edge Cases Handled

### Case 1: Booking with only cancellations

- 5 sessions, all CANCELLED_BY_TEACHER
- Booking: 100% complete (5/5)
- Teacher: Earns $0, experience +5
- Student: Refunded $250 (all)
- ✅ Works correctly

### Case 2: Booking with mixed cancellations

- 3 COMPLETED, 2 CANCELLED_BY_STUDENT, 1 CANCELLED_BY_TEACHER
- Booking: 100% complete (6/6)
- Teacher: Earns 5 × $50 = $250, experience +6
- Student: Refunded 1 × $50 = $50
- ✅ Works correctly

### Case 3: Partial booking

- 10 total sessions, only 4 completed so far
- Booking: 40% complete (4/10)
- Teacher: Can still earn from future sessions
- ✅ Works correctly

---

## Final Truth Table

```
Status                | Progress | Experience | Payment | Refund
──────────────────────────────────────────────────────────────────
COMPLETED             | ✅ +1    | ✅ +1      | ✅ Yes  | No
CANCELLED_BY_STUDENT  | ✅ +1    | ✅ +1      | ✅ Yes  | No
CANCELLED_BY_TEACHER  | ✅ +1    | ✅ +1      | ❌ No   | ✅ Yes
```

All roads lead to booking completion, but payment and refunds are independent!
