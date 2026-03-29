# Critical: Database Consistency When room_finished Webhook Doesn't Arrive

## The Problem

The current architecture has a critical inconsistency vulnerability:

```
Route/Task                          Webhook
─────────────────────────────────  ──────────────────
1. Set session.status
2. Set session.actual_end_at
3. Flush to DB ✅
4. Call end_room()
5. Commit ✅
6. Return success to client

                                    7. room_finished event arrives
                                    8. Create transaction
                                    9. Update counters
                                    10. Emit Socket.IO
                                    11. Schedule tasks
                                    12. Commit

WHAT IF: room_finished NEVER arrives?
```

## Failure Scenarios

### Scenario 1: Webhook Event Lost

```
LiveKit deletes room → Webhook event created but lost in transit → Never arrives

Result:
✅ Session.status = COMPLETED (set by route)
✅ Session.actual_end_at = recorded (set by route)
❌ Transaction NOT created (webhook never ran)
❌ Booking.completed_sessions NOT incremented (webhook never ran)
❌ Teacher.completed_sessions NOT incremented (webhook never ran)
❌ Socket.IO event NOT emitted (webhook never ran)
❌ Post-session tasks NOT scheduled (webhook never ran)

Inconsistency: Session looks "done" but no payment, no counter updates, no notifications
```

### Scenario 2: Webhook Processing Fails

```
Route sets status → end_room() called → room_finished webhook arrives →
  Webhook starts processing → Database error → Webhook transaction rolls back →
  Returns error response but event is not retried

Result:
✅ Session.status = COMPLETED
✅ Session.actual_end_at = recorded
❌ Transaction NOT created (rolled back)
❌ Counters NOT updated (rolled back)
```

### Scenario 3: Database Transaction Deadlock in Webhook

```
Route committed → end_room() called → room_finished arrives →
  Webhook acquires lock on session → Deadlock occurs → Exception thrown →
  Webhook dies without retry

Result: Same as above - partial state
```

### Scenario 4: Multiple room_finished Events

```
LiveKit sends room_finished multiple times (network retry) →
  First webhook processes fully → Second webhook processes again →
  Creates duplicate transaction, double-counts everything

Result:
❌ Transaction created twice
❌ Booking.completed_sessions incremented twice
❌ Teacher.completed_sessions incremented twice
```

## Risk Analysis

| Scenario                 | Probability            | Impact               | Detection                       |
| ------------------------ | ---------------------- | -------------------- | ------------------------------- |
| Webhook event lost       | Low (LiveKit reliable) | High (missing data)  | Hard (silent failure)           |
| Webhook processing fails | Medium (DB issues)     | High (partial state) | Hard (rolled back silently)     |
| Database deadlock        | Low-Medium             | High (partial state) | Medium (logs show error)        |
| Duplicate webhooks       | Low-Medium             | Medium (over-count)  | Medium (transaction duplicates) |

## Current Mitigations (Insufficient)

The current code has NO mitigations for this:

```python
# Route sets status and returns success
session.status = SessionStatus.COMPLETED
session.actual_end_at = now
await db.flush()
await end_room(session.livekit_room_name)
await db.commit()
return session  # ✅ Success to client

# But if webhook never arrives:
# ❌ No transaction
# ❌ No counter updates
# ❌ No notifications
```

## Solution Approaches

### Approach 1: Idempotent Status Field (NOT SUFFICIENT ALONE)

Problem: This only prevents duplicate transactions, doesn't prevent missing ones.

```python
# Add field to track if webhook processing is complete
class Session(Base):
    status: SessionStatus
    webhook_processed = Column(Boolean, default=False)  # NEW

# Route sets this to False
session.webhook_processed = False
await db.commit()

# Webhook sets this to True
if session.status in (COMPLETED, CANCELLED_BY_STUDENT):
    db.add(Transaction(...))
session.webhook_processed = True
await db.commit()
```

**Problem:** If webhook never arrives, `webhook_processed` stays False. We'd need a recovery job to detect and handle this.

### Approach 2: Move ALL Logic to Route (NOT RECOMMENDED)

Create transaction and update counters BEFORE deleting room.

```python
# In route
session.status = SessionStatus.COMPLETED

if session.status in (COMPLETED, CANCELLED_BY_STUDENT):
    db.add(Transaction(...))  # Create now

booking.completed_sessions += 1
if booking.completed_sessions >= booking.total_sessions:
    booking.status = BookingStatus.COMPLETED

await ts_repo.increment_completed_sessions(...)

await db.commit()

# Now safe to delete room
await end_room(session.livekit_room_name)

# Webhook now only handles Socket.IO and tasks
```

**Problem:** Couples room deletion to transaction creation. If room deletion fails, transaction already created but room still exists.

### Approach 3: Distributed Transaction Log (BEST)

Create a completion event record BEFORE any action, idempotent webhook processing.

```python
# NEW model
class SessionCompletionEvent(Base):
    id: UUID
    session_id: UUID
    status: SessionStatus
    created_at: DateTime
    transaction_created: Boolean = False
    counters_updated: Boolean = False
    notifications_sent: Boolean = False
    tasks_scheduled: Boolean = False

    # Unique constraint on session_id to prevent duplicates
    __table_args__ = (UniqueConstraint('session_id'),)

# Route creates the event record
completion_event = SessionCompletionEvent(
    session_id=session.id,
    status=SessionStatus.COMPLETED,
)
db.add(completion_event)
session.status = SessionStatus.COMPLETED
session.actual_end_at = now
await db.commit()

await end_room(session.livekit_room_name)

# Webhook processes idempotently
event = await db.execute(
    select(SessionCompletionEvent)
    .where(SessionCompletionEvent.session_id == session_id)
)
event = event.scalar_one()

# Process each step with idempotent guard
if not event.transaction_created:
    db.add(Transaction(...))
    event.transaction_created = True
    await db.flush()

if not event.counters_updated:
    booking.completed_sessions += 1
    event.counters_updated = True
    await db.flush()

if not event.notifications_sent:
    # Emit Socket.IO
    event.notifications_sent = True
    await db.flush()

if not event.tasks_scheduled and session.status == COMPLETED:
    # Schedule tasks
    event.tasks_scheduled = True
    await db.flush()

await db.commit()
```

**Benefits:**

- ✅ Event log shows what happened
- ✅ Idempotent (multiple webhooks = same result)
- ✅ Recoverable (can detect incomplete processing)
- ✅ Auditable (full history)

### Approach 4: Webhook Receipt Confirmation (RECOMMENDED HYBRID)

Acknowledge webhook received, use timeout job to ensure processing.

```python
# NEW model
class WebhookReceipt(Base):
    id: UUID
    room_name: str
    event_type: str  # "room_finished", etc.
    received_at: DateTime
    processed: Boolean = False

    __table_args__ = (UniqueConstraint('room_name', 'event_type'),)

# Webhook handler
# Step 1: Record receipt immediately (fast transaction)
receipt = WebhookReceipt(
    room_name=event.room.name,
    event_type="room_finished",
)
db.add(receipt)
await db.commit()  # ✅ Fast commit

# Step 2: Process asynchronously
try:
    await _process_room_finished(session, booking)
    receipt.processed = True
    await db.commit()
except Exception as exc:
    # If processing fails, don't mark as processed
    logger.error(f"Failed to process room_finished: {exc}")
    raise  # Let webhook infrastructure retry

# Fallback: Cleanup job to detect unprocessed receipts
@celery_app.task
async def cleanup_unprocessed_webhooks():
    """Process any webhooks that weren't fully handled"""
    results = await db.execute(
        select(WebhookReceipt)
        .where(
            (WebhookReceipt.processed == False) &
            (WebhookReceipt.received_at < now - timedelta(hours=1))
        )
    )
    receipts = results.scalars().all()

    for receipt in receipts:
        try:
            session = await db.execute(
                select(Session)
                .where(Session.livekit_room_name == receipt.room_name)
            )
            session = session.scalar_one()

            if session and session.status in (COMPLETED, CANCELLED_BY_STUDENT):
                # Process it now
                await _process_room_finished(session, session.booking)
                receipt.processed = True
        except Exception as exc:
            logger.warning(f"Failed to cleanup webhook for {receipt.room_name}: {exc}")

# Run cleanup every 5 minutes
cleanup_unprocessed_webhooks.apply_async(countdown=300)
```

**Benefits:**

- ✅ Fast webhook acknowledgment (doesn't block)
- ✅ Separate processing (can be retried)
- ✅ Automatic recovery (cleanup job)
- ✅ Auditable (receipt history)
- ✅ No duplicate processing (unique constraint)

## Recommendation: Hybrid Approach (Approach 4)

### Implementation Strategy

1. **Immediate:** Add webhook receipt tracking
   - Record that webhook was received
   - Process it asynchronously
   - Mark as processed when complete

2. **Short-term:** Add cleanup recovery job
   - Periodically check for unprocessed receipts
   - Retry failed processing after 1 hour
   - Ensures no session falls through cracks

3. **Long-term:** Add completion event log
   - Track each step of completion
   - Enables auditing
   - Enables replay if needed

### Why Not Other Approaches

**Approach 1 (Status field only):** Insufficient - detects problem but doesn't fix it

**Approach 2 (Move to route):** Creates new problems - couples concerns, makes route more complex

**Approach 3 (Full event log):** Too much overhead for immediate fix, but good long-term

**Approach 4 (Receipt + cleanup):** Best balance of safety, simplicity, and overhead

## Implementation Steps

### Step 1: Add WebhookReceipt Model

```python
# app/models/webhook.py
from sqlalchemy import Boolean, DateTime, String, UniqueConstraint
from datetime import datetime, timezone

class WebhookReceipt(Base):
    __tablename__ = "webhook_receipts"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    room_name: Mapped[str] = mapped_column(String, index=True)
    event_type: Mapped[str] = mapped_column(String)  # "room_finished", etc.
    received_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(tz=timezone.utc)
    )
    processed: Mapped[bool] = mapped_column(Boolean, default=False)
    error_message: Mapped[str | None] = mapped_column(String, nullable=True)

    __table_args__ = (
        UniqueConstraint('room_name', 'event_type', name='uq_room_event'),
    )
```

### Step 2: Update Webhook Handler

```python
# In livekit.py room_finished handler

elif event.event == "room_finished" and event.room:
    # Step 1: Record receipt (fast, minimal transaction)
    receipt = WebhookReceipt(
        room_name=event.room.name,
        event_type="room_finished",
    )
    db.add(receipt)
    await db.commit()

    # Step 2: Get session and process
    session, booking = await _get_session_and_booking(db, event.room.name)

    if not session or not booking:
        receipt.processed = True
        await db.commit()
        return {"status": "ok"}

    try:
        # All the completion logic here (transaction, counters, etc.)
        ...

        receipt.processed = True
        await db.commit()

    except Exception as exc:
        receipt.error_message = str(exc)
        await db.commit()  # Save error info
        logger.error(f"Failed to process room_finished: {exc}")
        raise  # Let webhook infrastructure retry
```

### Step 3: Add Cleanup Job

```python
# In app/tasks/webhook_cleanup.py

@celery_app.task
def cleanup_unprocessed_webhooks():
    """Check for webhooks that failed to process and retry them"""

    with get_db_session() as db:
        # Find receipts not processed in last 1 hour
        one_hour_ago = datetime.now(tz=timezone.utc) - timedelta(hours=1)

        results = db.execute(
            select(WebhookReceipt)
            .where(
                (WebhookReceipt.processed == False) &
                (WebhookReceipt.received_at < one_hour_ago)
            )
        )

        unprocessed = results.scalars().all()

        for receipt in unprocessed:
            logger.warning(
                f"Webhook not processed: {receipt.room_name} "
                f"(received {(now - receipt.received_at).total_seconds()}s ago)",
                extra={"room_name": receipt.room_name}
            )

            # Try to process it
            try:
                session = db.execute(
                    select(Session)
                    .where(Session.livekit_room_name == receipt.room_name)
                ).scalar_one_or_none()

                if session and session.status in (COMPLETED, CANCELLED_BY_STUDENT):
                    # Process it now
                    _process_room_finished_sync(session, session.booking)
                    receipt.processed = True

            except Exception as exc:
                logger.error(
                    f"Failed to cleanup webhook {receipt.room_name}: {exc}",
                    extra={"room_name": receipt.room_name}
                )

            db.commit()

# Schedule to run every 5 minutes
cleanup_unprocessed_webhooks.apply_async(countdown=300)
```

## Summary Table

| Approach              | Safety       | Complexity | Performance  | Auditability |
| --------------------- | ------------ | ---------- | ------------ | ------------ |
| Status field only     | ⭐           | ⭐         | ⭐⭐⭐⭐⭐   | ⭐           |
| Move to route         | ⭐⭐         | ⭐⭐⭐⭐   | ⭐⭐⭐⭐     | ⭐⭐         |
| Event log             | ⭐⭐⭐⭐⭐   | ⭐⭐⭐⭐   | ⭐⭐⭐       | ⭐⭐⭐⭐⭐   |
| **Receipt + Cleanup** | **⭐⭐⭐⭐** | **⭐⭐**   | **⭐⭐⭐⭐** | **⭐⭐⭐**   |

## Next Steps

1. **Immediate:** Implement WebhookReceipt model and cleanup job
2. **Testing:** Add tests for webhook retry scenarios
3. **Monitoring:** Alert on unprocessed webhooks
4. **Documentation:** Document recovery procedures
5. **Future:** Consider full event log for complete auditability
