# Implementation Summary: New Booking Flow

## Overview

Implemented a multi-step booking flow where students request bookings with negotiated terms, teachers approve them, students schedule sessions, and then payment is processed. This replaces the previous direct-to-payment model.

---

## Files Changed

### 1. `app/core/enums.py`

**Change:** Added `PENDING_APPROVAL` status to `BookingStatus` enum.

```python
class BookingStatus(str, Enum):
    PENDING_APPROVAL = "PENDING_APPROVAL"  # ← NEW
    PENDING_PAYMENT = "PENDING_PAYMENT"
    ACTIVE = "ACTIVE"
    COMPLETED = "COMPLETED"
    CANCELLED_BY_STUDENT = "CANCELLED_BY_STUDENT"
    CANCELLED_BY_TEACHER = "CANCELLED_BY_TEACHER"
    DISPUTED = "DISPUTED"
```

**Why:** The first status a booking enters is now `PENDING_APPROVAL` (awaiting teacher approval), not `PENDING_PAYMENT`.

---

### 2. `app/models/booking.py`

**Changes:**

- Changed default status from `PENDING_PAYMENT` → `PENDING_APPROVAL`
- Added two new columns:
  - `teacher_approved_at: DateTime | None` — timestamp when teacher approved
  - `teacher_approval_notes: Text | None` — optional notes from teacher

```python
status: Mapped[BookingStatus] = mapped_column(
    SAEnum(BookingStatus), default=BookingStatus.PENDING_APPROVAL, nullable=False, index=True
)

# Teacher approval tracking
teacher_approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
teacher_approval_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
```

**Why:** Track when and whether the teacher approved the booking request.

---

### 3. `app/schemas/booking.py`

**Changes:** Completely refactored request/response schemas for the new flow.

**Removed:**

- `BookingCreate` (replaced by multi-schema flow)
- `SessionSlot` (moved and renamed)

**Added:**

1. **BookingRequestCreate** — for `/bookings/request` endpoint

   ```python
   class BookingRequestCreate(BaseModel):
       teacher_id: UUID
       subject_id: UUID
       total_sessions: int
       rate_per_session: Decimal
   ```

   Student specifies teacher, subject, number of sessions, and rate.

2. **BookingApproveRequest** — for `/bookings/{id}/approve` endpoint

   ```python
   class BookingApproveRequest(BaseModel):
       notes: str | None = None
   ```

   Teacher optionally adds notes when approving.

3. **SessionSlot** — for session scheduling

   ```python
   class SessionSlot(BaseModel):
       scheduled_at: datetime
       duration_minutes: int
   ```

4. **SessionsScheduleRequest** — for `/bookings/{id}/schedule-sessions` endpoint
   ```python
   class SessionsScheduleRequest(BaseModel):
       sessions: list[SessionSlot]
   ```
   Student provides all session schedules.

**Updated:**

- **BookingRead** — added `teacher_approved_at` and `teacher_approval_notes` fields.

---

### 4. `app/api/v1/endpoints/bookings.py`

**Changes:** Complete rewrite with new endpoints.

**New Endpoints:**

1. **`POST /bookings/request`** (Step 1)
   - Only students can call
   - Creates booking with `PENDING_APPROVAL` status
   - Requires: teacher_id, subject_id, total_sessions, rate_per_session
   - Returns: BookingRead (with PENDING_APPROVAL status)

2. **`POST /bookings/{booking_id}/approve`** (Step 2)
   - Only teachers can call
   - Moves booking from `PENDING_APPROVAL` → `PENDING_PAYMENT`
   - Sets `teacher_approved_at` and `teacher_approval_notes`
   - Returns: BookingRead (with PENDING_PAYMENT status)

3. **`POST /bookings/{booking_id}/schedule-sessions`** (Step 3)
   - Only students can call
   - Requires booking to be in `PENDING_PAYMENT` status
   - Creates Session records for each slot
   - Validates: number of sessions = total_sessions in booking
   - Returns: BookingRead with all Session records

4. **`POST /bookings/{booking_id}/initiate-payment`** (Step 4)
   - Only students can call
   - Requires booking to be in `PENDING_PAYMENT` status with all sessions scheduled
   - Returns eSewa payment initialization parameters
   - Frontend redirects user to eSewa

**Updated Endpoints:**

- **`GET /bookings/`** — now filters by student_id or teacher_id (no changes to logic, just integration)
- **`GET /bookings/{booking_id}`** — verifies user is student or teacher in booking
- **`POST /bookings/{booking_id}/cancel`** — updated to set `status = CANCELLED_BY_*` based on who cancels; includes cancellation reason and timestamp

**Removed:**

- Old `POST /bookings/` (replaced by `/bookings/request` flow)

---

### 5. `app/api/v1/endpoints/payments.py`

**Changes:** Updated documentation and imports for new flow.

**Updated:**

- `POST /payments/esewa/callback` docstring now specifies:
  - On SUCCESS: Booking `PENDING_PAYMENT` → `ACTIVE`
  - Records `BOOKING_ESCROW` transaction
  - Sessions now ready to start

**Imports added:**

- `from app.core.enums import BookingStatus, TransactionType, TransactionReason`
- `from app.models.booking import Booking`
- `from app.models.payment import Transaction`

---

### 6. `migrations/versions/4b6ea5e158b8_initial_schema.py`

**Changes:** Updated migration to reflect new booking structure.

**Updated enum:**

```python
sa.Enum('PENDING_APPROVAL', 'PENDING_PAYMENT', 'ACTIVE', 'COMPLETED',
        'CANCELLED_BY_STUDENT', 'CANCELLED_BY_TEACHER', 'DISPUTED',
        name='bookingstatus')
```

**Added columns:**

```python
sa.Column('teacher_approved_at', sa.DateTime(timezone=True), nullable=True),
sa.Column('teacher_approval_notes', sa.Text(), nullable=True),
```

---

## New Documentation Files Created

### 1. `BOOKING_FLOW.md`

Comprehensive guide covering:

- 5-step booking flow with detailed descriptions
- Endpoint specifications with example payloads
- Booking and session status transitions
- Role-based access control
- Cancellation policy
- Data model changes

### 2. `BOOKING_FLOW_DIAGRAM.md`

Visual diagrams:

- Sequence diagram showing actor interactions
- Booking state machine
- Session lifecycle
- Escrow-to-payout flow
- Example timeline

---

## Breaking Changes

| Old Behavior                          | New Behavior                      | Impact                               |
| ------------------------------------- | --------------------------------- | ------------------------------------ |
| Direct payment after booking creation | Multi-step flow with approval     | Clients must implement new endpoints |
| Sessions created at booking time      | Sessions created after approval   | No pre-scheduled sessions            |
| Immediate PENDING_PAYMENT status      | Initial PENDING_APPROVAL status   | Different status workflows           |
| No teacher approval tracking          | Tracks approval timestamp & notes | Enhanced audit trail                 |

---

## Database Migration Notes

If you have an existing production database with existing bookings:

1. **Update the enum:** Add `PENDING_APPROVAL` to the bookingstatus enum type.
2. **Add new columns:** Add `teacher_approved_at` and `teacher_approval_notes` columns.
3. **Update existing bookings:** All existing bookings in `PENDING_PAYMENT` status can remain; they won't be affected. If there are completed or active bookings, you may want to set `teacher_approved_at` to their creation timestamp (or leave NULL to indicate they pre-date this change).

**Alembic migration command:**

```bash
poetry run alembic revision -m "add teacher approval tracking to bookings"
```

Then edit the generated file to include:

```python
# In upgrade():
op.add_column('bookings',
    sa.Column('teacher_approved_at', sa.DateTime(timezone=True), nullable=True)
)
op.add_column('bookings',
    sa.Column('teacher_approval_notes', sa.Text(), nullable=True)
)

# Update enum (complex; may need to recreate it)
# ... (see Alembic enum docs)

# In downgrade():
op.drop_column('bookings', 'teacher_approval_notes')
op.drop_column('bookings', 'teacher_approved_at')
```

---

## Testing Checklist

### Unit Tests

- [ ] Test `POST /bookings/request` creates booking with PENDING_APPROVAL status
- [ ] Test `POST /bookings/{id}/approve` requires teacher role and correct booking status
- [ ] Test `POST /bookings/{id}/schedule-sessions` requires exact number of sessions
- [ ] Test `POST /bookings/{id}/initiate-payment` validates sessions are scheduled
- [ ] Test cancellation sets correct status based on actor role

### Integration Tests

- [ ] Full flow: request → approve → schedule → pay → activate
- [ ] Rejection flow: request → cancel
- [ ] Teacher cancel before approval
- [ ] Student cancel after approval but before payment
- [ ] eSewa callback transitions booking to ACTIVE

### Manual Testing

- [ ] Verify endpoints return correct status codes
- [ ] Verify timestamps are set correctly
- [ ] Check database state after each step
- [ ] Verify role-based access control

---

## Future Work

1. **Booking Rejection:** Implement `/bookings/{id}/reject` for teachers.
2. **Demo Sessions:** Add concept of demo/trial session before full booking.
3. **Session Rescheduling:** Allow rescheduling individual sessions.
4. **Rate Negotiation:** Multi-round negotiation before approval.
5. **Session Customization:** Allow per-session rate or duration variations.
6. **Notifications:** Add push/email notifications at each step.
7. **Refund Workflow:** Complete implementation of refund task queue.

---

## Summary

✅ **Booking flow now follows real-world interaction pattern:**

1. Student and teacher have a conversation and agree on terms
2. Student formally requests booking with terms (rate, duration, subject)
3. Teacher reviews and approves
4. Student schedules actual sessions
5. Student pays via eSewa
6. Sessions can be completed

✅ **Key improvements:**

- Clear approval step before payment
- Separate session scheduling from booking creation
- Better audit trail (approval timestamps)
- More flexible negotiations

✅ **All endpoints implemented** and ready for integration.
