# DATABASE_SUPPORT.md - Database Consistency & Webhook Reliability

## Overview

This document explains the database consistency challenges that arise from the current session completion architecture and provides multiple solution options.

**Location:** Root level documentation  
**Applies To:** Backend session completion workflow  
**Priority:** High (before production launch)  
**Status:** Problem identified, solutions documented

---

## Table of Contents

1. [The Problem](#the-problem)
2. [Failure Scenarios](#failure-scenarios)
3. [Risk Assessment](#risk-assessment)
4. [Solution Options](#solution-options)
5. [Recommended Solution](#recommended-solution)
6. [Implementation Guide](#implementation-guide)
7. [Testing Strategy](#testing-strategy)
8. [Monitoring & Recovery](#monitoring--recovery)

---

## The Problem

### Current Architecture

The session completion logic is split across two independent systems:

```
┌─────────────────────────────────────┐
│ LAYER 1: Route Handler              │
├─────────────────────────────────────┤
│ 1. Set session.status               │
│ 2. Set session.actual_end_at        │
│ 3. db.commit() ✅                    │
│ 4. Call end_room()                  │
│ 5. Return success to client         │
└─────────────────────────────────────┘
           ↓
    (Event Emitted)
           ↓
┌─────────────────────────────────────┐
│ LAYER 2: Webhook Handler            │
├─────────────────────────────────────┤
│ 6. Webhook receives room_finished   │
│ 7. Create transaction ❓             │
│ 8. Update counters ❓                │
│ 9. Emit notifications ❓             │
│ 10. Schedule tasks ❓                │
│ 11. db.commit() ❓                   │
└─────────────────────────────────────┘
```

### The Vulnerability

**Question:** What if the webhook never arrives?

```
Scenario: Webhook Lost
─────────────────────

Route Handler: ✅ SUCCEEDS
  ├─ Session status set to COMPLETED
  ├─ Timestamp recorded
  ├─ Database committed
  └─ Client notified of success

Webhook: ❌ NEVER ARRIVES
  ├─ Event lost in transit
  ├─ Network failure
  ├─ Webhook handler crashes
  └─ Or webhook processing fails and rolls back

Result: SILENT DATA INCONSISTENCY
  ✅ session.status = COMPLETED
  ❌ transaction = NOT CREATED
  ❌ booking.completed_sessions = NOT INCREMENTED
  ❌ teacher.completed_sessions = NOT INCREMENTED
  ❌ Socket.IO event = NOT SENT
  ❌ Post-session tasks = NOT SCHEDULED

Consequence:
  • Teacher not paid for session
  • Booking progress counter wrong
  • Teacher's experience not updated
  • Client never gets completion notification
  • Cleanup/billing tasks never run
```

---

## Failure Scenarios

### Scenario 1: Webhook Event Lost

**When:** Network failure, message queue dropped, webhook provider issue

```
timeline:
T+0s    Route commits status=COMPLETED
        Client: "Success!"
T+100ms LiveKit emits room_finished
T+150ms Network failure → Event lost
        Webhook never receives it
T+forever Nothing happens
```

**Impact:** 🔴 High

- No transaction created
- No counter updates
- No notifications

---

### Scenario 2: Webhook Processing Fails

**When:** Database deadlock, constraint violation, timeout, memory error

```
timeline:
T+0s    Route commits status=COMPLETED
T+100ms Webhook receives event
T+105ms Webhook tries to create transaction
        → Database locked by other transaction
        → Exception thrown
        → Webhook handler catches exception
        → Rolls back entire transaction
        → Returns error response
        → No retry mechanism
T+forever Webhook failure is lost
```

**Impact:** 🔴 High

- Same as scenario 1

---

### Scenario 3: Duplicate Webhook Events

**When:** Network retry, LiveKit sends event twice, message redelivery

```
timeline:
T+0s    Route commits status=COMPLETED
T+100ms First webhook arrives
        → Creates transaction ✅
        → Updates counters ✅
        → Commits
T+200ms Network retry
        → Second webhook arrives
        → Creates ANOTHER transaction ❌
        → Increments counters AGAIN ❌
        → Commits duplicate data

Result:
  ❌ Transaction created twice
  ❌ Teacher paid double
  ❌ Booking counters incremented twice
  ❌ Session appears to be completed twice
```

**Impact:** 🟠 Medium

- Financial inconsistency
- Reporting inaccuracy

---

### Scenario 4: Partial Webhook Execution

**When:** Some steps succeed, then failure partway through

```
timeline:
T+100ms Webhook starts processing
T+105ms Create transaction ✅ (flushed)
T+110ms Update counters ✅ (flushed)
T+115ms Try to emit Socket.IO
        → Redis connection fails
        → Exception thrown
        → Entire transaction rolls back
T+120ms Everything rolled back

Result:
  ✅ Route marked session completed
  ❌ Transaction NOT created (rolled back)
  ❌ Counters NOT updated (rolled back)
  ❌ Notifications NOT sent
```

**Impact:** 🔴 High

- All changes rolled back
- Back to scenario 1 (webhook failure)

---

## Risk Assessment

### Current State Risk Matrix

| Failure Mode      | Probability | Impact    | Detection | Recoverability |
| ----------------- | ----------- | --------- | --------- | -------------- |
| Webhook lost      | Low-Medium  | 🔴 High   | Hard      | None           |
| Processing fails  | Medium      | 🔴 High   | Medium    | Manual         |
| Duplicate event   | Low-Medium  | 🟠 Medium | Medium    | Audit required |
| Partial execution | Low         | 🔴 High   | Hard      | Manual         |

### Overall Risk

```
Current State: 🔴 CRITICAL

Risk Factors:
  ✗ No retry mechanism
  ✗ No receipt tracking
  ✗ No recovery mechanism
  ✗ Silent failures (no alerting)
  ✗ Manual recovery required (expensive)
```

---

## Solution Options

### Option 1: Do Nothing (Not Recommended)

**Approach:** Accept the risk, handle manually if it happens

**Pros:**

- ✅ No code changes needed
- ✅ No additional complexity

**Cons:**

- ❌ Risk of silent data inconsistency
- ❌ Manual detection required
- ❌ Manual recovery needed
- ❌ Customer impact (missing payments)
- ❌ Trust issues if discovered

**When to Choose:** Never in production

---

### Option 2: Move All Logic to Route (Not Recommended)

**Approach:** Create transaction and update counters BEFORE deleting room

```python
# In route handler
session.status = COMPLETED

# Create transaction NOW (before room deletion)
db.add(Transaction(...))

# Update counters NOW
booking.completed_sessions += 1
teacher_subject.completed_sessions += 1

await db.commit()

# NOW safe to delete room
await end_room(room_name)

# Webhook only handles Socket.IO
```

**Pros:**

- ✅ All critical logic in route (synchronous)
- ✅ No webhook dependency for core logic
- ✅ Immediate feedback

**Cons:**

- ❌ Couples transaction to room deletion
- ❌ If room deletion fails, transaction already created
- ❌ Socket.IO still dependent on webhook
- ❌ Task scheduling still dependent on webhook
- ❌ Creates new failure modes (room exists but already paid)
- ❌ Makes route more complex (currently clean separation)

**When to Choose:** When webhooks are completely unreliable

---

### Option 3: Event Sourcing Pattern (Recommended Long-term)

**Approach:** Create a SessionCompletionEvent record with state tracking

```python
class SessionCompletionEvent(Base):
    session_id: UUID
    status: SessionStatus
    transaction_created: bool = False
    counters_updated: bool = False
    notifications_sent: bool = False
    tasks_scheduled: bool = False

    # Unique constraint: one event per session
    __table_args__ = (UniqueConstraint('session_id'),)

# In route
event = SessionCompletionEvent(session_id=session.id, status=COMPLETED)
db.add(event)
await db.commit()

# In webhook - process each step with guard
if not event.transaction_created:
    create_transaction()
    event.transaction_created = True

if not event.counters_updated:
    update_counters()
    event.counters_updated = True

# ... and so on
```

**Pros:**

- ✅ Complete audit trail
- ✅ Can replay processing
- ✅ Truly idempotent
- ✅ Can detect stuck steps
- ✅ Foundation for event-driven architecture

**Cons:**

- ⏳ More complex to implement
- ⏳ More database queries
- ⏳ More code to maintain
- ⏳ Requires careful step ordering

**When to Choose:** For production systems with high reliability requirements (after MVP)

---

### Option 4: Webhook Receipt Tracking (Recommended Short-term) ⭐

**Approach:** Track receipt of webhook, process with guards, auto-recovery

```python
class WebhookReceipt(Base):
    room_name: str
    event_type: str
    received_at: DateTime
    processed: bool = False
    error_message: str | None = None
    error_count: int = 0

    # Unique: prevent duplicate processing
    __table_args__ = (UniqueConstraint('room_name', 'event_type'),)

# In webhook handler
# Step 1: Record receipt (fast commit)
receipt = WebhookReceipt(room_name="...", event_type="room_finished")
db.add(receipt)
await db.commit()

# Step 2: Process with guards
try:
    create_transaction_if_not_exists()
    update_counters()
    emit_notifications()
    schedule_tasks()
    receipt.processed = True
    await db.commit()
except Exception as exc:
    receipt.error_message = str(exc)
    receipt.error_count += 1
    await db.commit()  # Save error info
    raise  # Let framework retry

# Cleanup job (every 5 minutes)
unprocessed = db.query(WebhookReceipt).filter(
    processed=False,
    received_at < now - 1hour,
    error_count < 5
).all()

for receipt in unprocessed:
    retry_webhook_processing(receipt)
```

**Pros:**

- ✅ Proves event was received
- ✅ Automatic recovery (cleanup job)
- ✅ Prevents duplicates (unique constraint)
- ✅ Relatively simple to implement (~7 hours)
- ✅ Low risk (additive, doesn't change routes)
- ✅ Observable (can query receipt table)
- ✅ Auditable (full history)
- ✅ Recovers within 1 hour

**Cons:**

- ⏳ Requires cleanup job scheduling
- ⏳ Requires monitoring
- ⏳ One more table to manage

**When to Choose:** For MVP/production before event sourcing

---

## Recommended Solution

### ✅ Implement Option 4: Receipt Tracking (Now)

**Why:**

1. **Time-to-market:** 7 hours development, can ship this week
2. **Risk-to-benefit:** Eliminates 🔴 critical risks with 🟢 low complexity
3. **Evolutionary:** Doesn't block future Event Sourcing upgrade
4. **Observable:** Built-in audit trail and monitoring

### Then Later (Month 2): Upgrade to Option 3

**Once MVP is running successfully:**

- Refactor to Event Sourcing pattern
- Get full auditability and replaying capability
- Prepare for more complex workflows

---

## Implementation Guide

### Phase 1: WebhookReceipt Model (1 hour)

Create `app/models/webhook_receipt.py`:

```python
from datetime import datetime, timezone
from uuid import UUID, uuid4
from sqlalchemy import Boolean, DateTime, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base


class WebhookReceipt(Base):
    """Track webhook event delivery and processing status.

    Ensures no webhook event is lost without detection.
    Enables automatic recovery via cleanup job.
    """

    __tablename__ = "webhook_receipts"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    room_name: Mapped[str] = mapped_column(String(255), index=True)
    event_type: Mapped[str] = mapped_column(String(100), index=True)

    received_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(tz=timezone.utc),
        index=True,
    )

    processed: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    processed_at: Mapped[DateTime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    error_message: Mapped[str | None] = mapped_column(String, nullable=True)
    error_count: Mapped[int] = mapped_column(default=0)

    __table_args__ = (
        UniqueConstraint('room_name', 'event_type', name='uq_webhook_room_event'),
    )
```

### Phase 2: Migration (30 min)

```bash
cd backend
alembic revision --autogenerate -m "Add webhook_receipts table"
alembic upgrade head
```

### Phase 3: Update Webhook Handler (2 hours)

In `app/api/v1/endpoints/livekit.py`, update `room_finished` handler:

```python
elif event.event == "room_finished" and event.room:
    room_name = event.room.name
    now = datetime.now(tz=timezone.utc)

    # STEP 1: Record receipt (fast, minimal transaction)
    try:
        receipt = WebhookReceipt(
            room_name=room_name,
            event_type="room_finished",
        )
        db.add(receipt)
        await db.commit()
    except IntegrityError:
        # Duplicate - webhook already received
        await db.rollback()
        existing = await db.execute(
            select(WebhookReceipt).where(
                (WebhookReceipt.room_name == room_name) &
                (WebhookReceipt.event_type == "room_finished")
            )
        )
        receipt = existing.scalar_one()

        if receipt.processed:
            # Already fully processed
            return {"status": "ok"}

    # STEP 2: Process webhook
    session, booking = await _get_session_and_booking(db, room_name)

    if not session or not booking:
        receipt.processed = True
        receipt.processed_at = now
        await db.commit()
        return {"status": "ok"}

    try:
        # All the existing completion logic here...
        # (create transaction, update counters, emit events, schedule tasks)

        # Mark as processed
        receipt.processed = True
        receipt.processed_at = now
        await db.commit()

    except Exception as exc:
        receipt.error_message = str(exc)
        receipt.error_count += 1
        await db.commit()
        logger.error(f"Webhook processing failed: {exc}")
        raise
```

### Phase 4: Cleanup Job (2 hours)

Create `app/tasks/webhook_cleanup_tasks.py`:

```python
from datetime import datetime, timedelta, timezone
from sqlalchemy import and_, select

from app.core.celery_app import celery_app
from app.db.session import get_async_db_session
from app.models.webhook_receipt import WebhookReceipt
from app.models.booking import Session


@celery_app.task(bind=True, max_retries=3)
async def cleanup_unprocessed_webhooks(self):
    """Retry any webhooks that failed processing."""

    try:
        async with get_async_db_session() as db:
            now = datetime.now(tz=timezone.utc)
            one_hour_ago = now - timedelta(hours=1)

            # Find unprocessed receipts older than 1 hour
            results = await db.execute(
                select(WebhookReceipt).where(
                    and_(
                        WebhookReceipt.processed == False,
                        WebhookReceipt.received_at < one_hour_ago,
                        WebhookReceipt.error_count < 5,
                    )
                )
            )

            unprocessed = results.scalars().all()

            for receipt in unprocessed:
                try:
                    # Retry webhook processing
                    session = await db.execute(
                        select(Session).where(
                            Session.livekit_room_name == receipt.room_name
                        )
                    )
                    session = session.scalar_one_or_none()

                    if not session:
                        receipt.processed = True
                        await db.commit()
                        continue

                    # Process the completion logic
                    # (same as webhook would do)

                    receipt.processed = True
                    receipt.processed_at = now
                    await db.commit()

                except Exception as exc:
                    receipt.error_message = str(exc)
                    receipt.error_count += 1
                    await db.commit()

    except Exception as exc:
        raise self.retry(countdown=60, exc=exc)
```

### Phase 5: Schedule Cleanup Job (30 min)

In `app/core/celery_app.py`:

```python
from celery.schedules import schedule
from datetime import timedelta

app.conf.beat_schedule = {
    'cleanup-unprocessed-webhooks': {
        'task': 'app.tasks.webhook_cleanup_tasks.cleanup_unprocessed_webhooks',
        'schedule': schedule(run_every=timedelta(minutes=5)),
    },
}
```

### Total Implementation Time: ~7 hours

---

## Testing Strategy

### Unit Tests

```python
async def test_webhook_receipt_recorded():
    """Webhook receipt is recorded"""
    # Call webhook handler
    # Verify receipt exists with processed=False

async def test_webhook_duplicate_prevented():
    """Duplicate webhooks prevented by unique constraint"""
    # Call webhook twice with same room_name
    # Second should succeed but not duplicate-process

async def test_idempotent_processing():
    """Processing same webhook twice yields same result"""
    # Process webhook
    # Process again
    # Verify transaction/counters not duplicated
```

### Integration Tests

```python
async def test_webhook_lost_then_recovered():
    """Webhook failure recovered by cleanup job"""
    # Route completes session
    # Simulate webhook failure (exception)
    # Verify receipt has processed=False
    # Run cleanup job
    # Verify receipt now processed=True and data updated

async def test_concurrent_webhooks():
    """Multiple concurrent webhooks handled correctly"""
    # Send 10 webhooks concurrently
    # All should succeed
    # No duplicates created
```

### Load Tests

```python
async def test_high_volume_webhooks():
    """Handle high volume of webhooks"""
    # Generate 1000 webhooks
    # Process concurrently
    # Verify no data corruption
    # Cleanup job should complete in < 1 minute
```

---

## Monitoring & Recovery

### Metrics to Track

```sql
-- Unprocessed webhooks (should be near 0)
SELECT COUNT(*) FROM webhook_receipts WHERE processed = False;

-- Max age of unprocessed (should be < 5 min)
SELECT MAX(EXTRACT(EPOCH FROM (NOW() - received_at)))
FROM webhook_receipts WHERE processed = False;

-- Error rate
SELECT event_type, COUNT(*), SUM(error_count)
FROM webhook_receipts GROUP BY event_type;

-- Receipts with exhausted retries
SELECT * FROM webhook_receipts
WHERE processed = False AND error_count >= 5;
```

### Alerts

1. **Unprocessed Webhooks:** Alert if count > 10
2. **Webhook Age:** Alert if any receipt unprocessed for > 10 minutes
3. **Exhausted Retries:** Page oncall immediately
4. **Cleanup Job Failure:** Alert if job doesn't run 2 consecutive times

### Recovery Procedure (if needed)

```sql
-- Find sessions with missing transactions
SELECT s.id, s.status, s.booking_id, COUNT(t.id)
FROM sessions s
LEFT JOIN transactions t ON s.booking_id = t.booking_id
WHERE s.status IN ('COMPLETED', 'CANCELLED_BY_STUDENT')
GROUP BY s.id
HAVING COUNT(t.id) = 0;

-- Find webhook receipts with errors
SELECT * FROM webhook_receipts
WHERE processed = False
ORDER BY received_at DESC;

-- Manually trigger cleanup job
SELECT cleanup_unprocessed_webhooks();

-- Monitor cleanup job progress
SELECT COUNT(*) FROM webhook_receipts
WHERE processed = False AND error_count < 5;
```

---

## Success Criteria

After implementation, verify:

- ✅ No unprocessed webhooks accumulating (< 1 per hour)
- ✅ Cleanup job runs every 5 minutes
- ✅ Unprocessed receipts are recovered within 1 hour
- ✅ No duplicate transactions created
- ✅ All completed sessions have correct counters
- ✅ No missing notifications
- ✅ Zero alerts in first 24 hours

---

## Timeline

| Phase | Task                        | Time | Target  |
| ----- | --------------------------- | ---- | ------- |
| 1     | Create WebhookReceipt model | 1h   | Day 1   |
| 2     | Create migration            | 0.5h | Day 1   |
| 3     | Update webhook handler      | 2h   | Day 2   |
| 4     | Implement cleanup job       | 2h   | Day 2   |
| 5     | Add tests                   | 1h   | Day 3   |
| 6     | Deploy to staging           | 0.5h | Day 3   |
| 7     | Monitor staging             | 4h   | Day 3-4 |
| 8     | Deploy to production        | 0.5h | Day 4   |
| 9     | Monitor production          | 8h   | Day 4-5 |

**Total: 19.5 hours (3 days with monitoring)**

---

## Conclusion

The current architecture has a **critical vulnerability**: webhook failures cause silent data inconsistency.

**Recommendation:** Implement Option 4 (Receipt Tracking) before production launch.

This provides:

- ✅ Automatic detection of webhook failures
- ✅ Automatic recovery within 1 hour
- ✅ Prevention of duplicate processing
- ✅ Full audit trail
- ✅ Observable system
- ✅ Minimal code complexity

**Risk if not implemented:** Silent data inconsistencies, missing payments, customer trust issues.

**Cost if implemented:** 3 days of development, 1 small table, 1 background job, minimal overhead.

**ROI:** Critical reliability improvement at acceptable cost.

---

## Questions & Answers

**Q: Can webhooks be that unreliable?**  
A: Yes. Network failures, server issues, message queue failures all happen. LiveKit webhooks aren't special. Always plan for failure.

**Q: Why not just implement Event Sourcing now?**  
A: Event Sourcing is more complex. Receipt Tracking is 80% as reliable with 20% of the complexity. Do Receipt Tracking now, upgrade to Event Sourcing later if needed.

**Q: What if cleanup job fails?**  
A: It retries with exponential backoff. Next run (5 min later) will pick up where it left off. Very resilient.

**Q: Can we just ignore this problem?**  
A: Technically yes, but it's a ticking time bomb. Every deployment increases probability of a failure. Better to fix it now.

**Q: Is there a performance cost?**  
A: Minimal. One extra table, one background job every 5 minutes, one extra unique constraint. Total overhead < 1% of system resources.

---

## Contact & Escalation

For questions about this architecture:

1. Review `COMPLETE_SESSION_COMPLETION_EXPLANATION.md` for full context
2. Review `DATABASE_CONSISTENCY_WEBHOOK.md` for problem deep-dive
3. Review `WEBHOOK_CONSISTENCY_IMPLEMENTATION.md` for implementation details
