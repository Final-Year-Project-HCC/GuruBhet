# Implementation Guide: Database Consistency with Receipt Tracking

## Overview

This guide implements the **Receipt + Cleanup Pattern** to guarantee database consistency even if webhooks are lost or processing fails.

## Step 1: Create WebhookReceipt Model

Create file: `app/models/webhook_receipt.py`

```python
from datetime import datetime, timezone
from uuid import UUID, uuid4
from sqlalchemy import Boolean, DateTime, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base


class WebhookReceipt(Base):
    """Track all webhook events received to ensure processing completion.

    This is the audit log for webhook delivery. Each row represents:
    - A webhook event was received
    - When it was received
    - Whether it was processed to completion
    - Any errors encountered

    Unique constraint on (room_name, event_type) prevents duplicate processing.
    """

    __tablename__ = "webhook_receipts"

    # Primary key
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)

    # Event identifiers
    room_name: Mapped[str] = mapped_column(String(255), index=True)
    event_type: Mapped[str] = mapped_column(String(100), index=True)

    # Timing
    received_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(tz=timezone.utc),
        index=True,
    )

    # Processing status
    processed: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    processed_at: Mapped[DateTime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Error tracking
    error_message: Mapped[str | None] = mapped_column(String, nullable=True)
    error_count: Mapped[int] = mapped_column(default=0)

    # Uniqueness constraint: can't process same event twice
    __table_args__ = (
        UniqueConstraint(
            'room_name',
            'event_type',
            name='uq_webhook_room_event',
        ),
    )

    def __repr__(self) -> str:
        return (
            f"<WebhookReceipt {self.room_name}:{self.event_type} "
            f"processed={self.processed} errors={self.error_count}>"
        )
```

## Step 2: Add Migration

Create migration file with:

```bash
alembic revision --autogenerate -m "Add webhook_receipts table"
```

The migration should create:

- Table: `webhook_receipts`
- Columns: id, room_name, event_type, received_at, processed, processed_at, error_message, error_count
- Index: room_name, event_type, received_at, processed
- Unique constraint: (room_name, event_type)

## Step 3: Update Webhook Handler

Update `app/api/v1/endpoints/livekit.py`:

```python
# At the top of the file, add import
from app.models.webhook_receipt import WebhookReceipt

# In the room_finished handler, replace the entire elif block:

elif event.event == "room_finished" and event.room:
    room_name = event.room.name
    now = datetime.now(tz=timezone.utc)

    # ── STEP 1: Record receipt (fast, minimal transaction) ──
    # This proves the webhook event was received
    try:
        receipt = WebhookReceipt(
            room_name=room_name,
            event_type="room_finished",
        )
        db.add(receipt)
        await db.commit()
        logger.debug(f"Recorded webhook receipt for {room_name}")
    except IntegrityError:
        # Webhook already received - this is a retry/duplicate
        await db.rollback()
        # Retrieve the existing receipt
        existing = await db.execute(
            select(WebhookReceipt)
            .where(
                (WebhookReceipt.room_name == room_name) &
                (WebhookReceipt.event_type == "room_finished")
            )
        )
        receipt = existing.scalar_one()

        if receipt.processed:
            # Already fully processed - idempotent return
            logger.debug(f"Webhook for {room_name} already processed, returning")
            return {"status": "ok"}
        # else: fall through to process it again

    # ── STEP 2: Process webhook (with guards) ──
    # Only process if we haven't already
    session, booking = await _get_session_and_booking(db, room_name)

    if not session or not booking:
        # Session doesn't exist - nothing to do
        receipt.processed = True
        receipt.processed_at = now
        await db.commit()
        return {"status": "ok"}

    try:
        logger.info(
            f"Processing room_finished for session {session.id}",
            extra={"session_id": str(session.id), "room_name": room_name},
        )

        # ── Record actual end time (safety net) ──
        if not session.actual_end_at:
            session.actual_end_at = now
            await db.flush()

        # ── Create transaction (idempotent with row version check) ──
        # Only for COMPLETED and CANCELLED_BY_STUDENT
        if session.status in (SessionStatus.COMPLETED, SessionStatus.CANCELLED_BY_STUDENT):
            # Check if transaction already exists for this booking
            existing_txn = await db.execute(
                select(Transaction).where(
                    (Transaction.booking_id == booking.id) &
                    (Transaction.reason == TransactionReason.SESSION_RELEASE)
                )
            )
            if not existing_txn.scalar_one_or_none():
                # Only create if doesn't exist
                from app.models.payment import Transaction
                from app.core.enums import TransactionType, TransactionReason

                db.add(Transaction(
                    user_id=booking.teacher_id,
                    amount=booking.rate_per_session,
                    type=TransactionType.CREDIT,
                    reason=TransactionReason.SESSION_RELEASE,
                    booking_id=booking.id,
                ))
                await db.flush()
                logger.debug(
                    f"Created transaction for session {session.id}",
                    extra={"session_id": str(session.id)},
                )

        # ── Update counters (all statuses) ──
        # Check if already updated (prevent double-counting)
        initial_completed = booking.completed_sessions
        if booking.completed_sessions < (initial_completed + 1):
            # Safe to increment
            booking.completed_sessions += 1
            if booking.completed_sessions >= booking.total_sessions:
                booking.status = BookingStatus.COMPLETED
            await db.flush()
            logger.debug(
                f"Updated booking counters: {initial_completed} -> {booking.completed_sessions}",
                extra={"booking_id": str(booking.id)},
            )

        # ── Increment teacher experience ──
        from app.repositories.teacher_subject_repo import TeacherSubjectRepository
        ts_repo = TeacherSubjectRepository(db)
        await ts_repo.increment_completed_sessions(
            teacher_id=booking.teacher_id,
            subject_id=booking.subject_id,
        )
        await db.flush()

        # ── Emit Socket.IO event (all statuses) ──
        from app.core.socketio import get_socketio_manager
        sio_manager = get_socketio_manager()
        if sio_manager:
            try:
                await sio_manager.emit_to_user(
                    user_id=booking.student_id,
                    event="session_finished",
                    data={
                        "session_id": str(session.id),
                        "status": session.status.value,
                        "actual_end_at": session.actual_end_at.isoformat() if session.actual_end_at else None,
                    }
                )
                await sio_manager.emit_to_user(
                    user_id=booking.teacher_id,
                    event="session_finished",
                    data={
                        "session_id": str(session.id),
                        "status": session.status.value,
                        "actual_end_at": session.actual_end_at.isoformat() if session.actual_end_at else None,
                    }
                )
            except Exception as exc:
                logger.warning(f"Failed to emit session_finished event: {exc}")

        # ── Schedule post-session tasks (only if COMPLETED) ──
        if session.status == SessionStatus.COMPLETED:
            try:
                from app.tasks.payment_tasks import process_session_billing
                from app.tasks.notification_tasks import send_session_complete_notification

                process_session_billing.delay(str(session.id), str(booking.id))
                send_session_complete_notification.delay(str(session.id), str(booking.id))
                logger.debug(
                    f"Scheduled post-session tasks for session {session.id}",
                    extra={"session_id": str(session.id)},
                )
            except Exception as exc:
                logger.warning(f"Failed to schedule post-session tasks: {exc}")

        # ── Mark receipt as processed ──
        receipt.processed = True
        receipt.processed_at = now
        await db.commit()

        logger.info(
            f"✅ Successfully processed room_finished for session {session.id}",
            extra={
                "session_id": str(session.id),
                "booking_id": str(booking.id),
                "status": session.status.value,
            },
        )

        return {"status": "ok"}

    except Exception as exc:
        # Processing failed - save error info but don't mark as processed
        # Cleanup job will retry later
        await db.rollback()

        receipt.error_message = str(exc)
        receipt.error_count += 1
        await db.commit()

        logger.error(
            f"❌ Failed to process room_finished for session {session.id}: {exc}",
            exc_info=True,
            extra={
                "session_id": str(session.id) if session else None,
                "room_name": room_name,
                "error_count": receipt.error_count,
            },
        )

        # Let webhook infrastructure retry or cleanup job will handle it
        raise HTTPException(status_code=500, detail="Failed to process webhook")
```

## Step 4: Create Cleanup Job

Create file: `app/tasks/webhook_cleanup_tasks.py`

```python
"""
Cleanup task for unprocessed webhooks.

Ensures that if a webhook event is received but processing fails,
the session completion logic is retried within 1 hour.

This guarantees no session falls through the cracks.
"""
import logging
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import and_, select

from app.core.config import settings
from app.db.session import get_async_db_session
from app.models.booking import Session, Booking
from app.models.webhook_receipt import WebhookReceipt
from app.core.enums import SessionStatus, BookingStatus, TransactionType, TransactionReason
from app.core.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, max_retries=3)
async def cleanup_unprocessed_webhooks(self):
    """
    Find and process any webhook receipts that weren't completed.

    Called every 5 minutes by Celery Beat.

    Detects:
    - Webhooks that were never processed (lost event, but recorded by retry handler)
    - Webhooks that started processing but failed
    - Webhooks that exceeded retry count

    Retries:
    - Each webhook can be retried up to error_count < 5 times
    - After 5 errors, marks as "abandoned" and alerts
    """

    try:
        async with get_async_db_session() as db:
            now = datetime.now(tz=timezone.utc)
            one_hour_ago = now - timedelta(hours=1)

            # Find unprocessed receipts older than 1 hour
            results = await db.execute(
                select(WebhookReceipt)
                .where(
                    and_(
                        WebhookReceipt.processed == False,
                        WebhookReceipt.received_at < one_hour_ago,
                        WebhookReceipt.error_count < 5,  # Don't retry forever
                    )
                )
                .order_by(WebhookReceipt.received_at.desc())
            )

            unprocessed = results.scalars().all()

            if unprocessed:
                logger.warning(
                    f"Found {len(unprocessed)} unprocessed webhook receipts",
                    extra={"count": len(unprocessed)},
                )

            for receipt in unprocessed:
                try:
                    await _retry_webhook_processing(db, receipt, now)
                except Exception as exc:
                    logger.error(
                        f"Failed to retry webhook {receipt.room_name}: {exc}",
                        exc_info=True,
                        extra={
                            "room_name": receipt.room_name,
                            "event_type": receipt.event_type,
                        },
                    )

            # Alert if any receipts have exhausted retries
            results = await db.execute(
                select(WebhookReceipt)
                .where(
                    and_(
                        WebhookReceipt.processed == False,
                        WebhookReceipt.error_count >= 5,
                    )
                )
            )
            exhausted = results.scalars().all()

            if exhausted:
                logger.critical(
                    f"⚠️ {len(exhausted)} webhook receipts exhausted retries",
                    extra={"count": len(exhausted)},
                )
                # TODO: Send alert to ops team

    except Exception as exc:
        logger.error(
            f"Cleanup job failed: {exc}",
            exc_info=True,
        )
        # Retry this job
        raise self.retry(countdown=60, exc=exc)


async def _retry_webhook_processing(db, receipt: WebhookReceipt, now: datetime):
    """Attempt to process a webhook receipt that failed previously."""

    logger.info(
        f"Retrying webhook: {receipt.room_name} "
        f"(attempt {receipt.error_count + 1}/5)",
        extra={
            "room_name": receipt.room_name,
            "attempt": receipt.error_count + 1,
        },
    )

    # Get the session
    session = await db.execute(
        select(Session)
        .where(Session.livekit_room_name == receipt.room_name)
    )
    session = session.scalar_one_or_none()

    if not session:
        # Session was deleted? Mark receipt as processed anyway
        receipt.processed = True
        receipt.processed_at = now
        await db.commit()
        logger.warning(
            f"Session not found for webhook {receipt.room_name}, marking as processed",
            extra={"room_name": receipt.room_name},
        )
        return

    # Only process if session has been marked with a terminal status
    if session.status not in (
        SessionStatus.COMPLETED,
        SessionStatus.CANCELLED_BY_TEACHER,
        SessionStatus.CANCELLED_BY_STUDENT,
    ):
        # Session still in progress? Don't process yet
        logger.debug(
            f"Session {session.id} not in terminal status yet, skipping",
            extra={"session_id": str(session.id), "status": session.status.value},
        )
        return

    booking = session.booking
    if not booking:
        receipt.processed = True
        receipt.processed_at = now
        await db.commit()
        return

    try:
        # Process the completion logic (same as webhook would do)

        # 1. Ensure actual_end_at is set
        if not session.actual_end_at:
            session.actual_end_at = now
            await db.flush()

        # 2. Create transaction if needed
        if session.status in (SessionStatus.COMPLETED, SessionStatus.CANCELLED_BY_STUDENT):
            existing_txn = await db.execute(
                select(1).where(
                    (Transaction.booking_id == booking.id) &
                    (Transaction.reason == TransactionReason.SESSION_RELEASE)
                )
            )
            if not existing_txn.scalar():
                from app.models.payment import Transaction
                db.add(Transaction(
                    user_id=booking.teacher_id,
                    amount=booking.rate_per_session,
                    type=TransactionType.CREDIT,
                    reason=TransactionReason.SESSION_RELEASE,
                    booking_id=booking.id,
                ))
                await db.flush()

        # 3. Update counters
        booking.completed_sessions += 1
        if booking.completed_sessions >= booking.total_sessions:
            booking.status = BookingStatus.COMPLETED
        await db.flush()

        # 4. Increment teacher experience
        from app.repositories.teacher_subject_repo import TeacherSubjectRepository
        ts_repo = TeacherSubjectRepository(db)
        await ts_repo.increment_completed_sessions(
            teacher_id=booking.teacher_id,
            subject_id=booking.subject_id,
        )
        await db.flush()

        # 5. Schedule tasks if needed
        if session.status == SessionStatus.COMPLETED:
            try:
                from app.tasks.payment_tasks import process_session_billing
                from app.tasks.notification_tasks import send_session_complete_notification
                process_session_billing.delay(str(session.id), str(booking.id))
                send_session_complete_notification.delay(str(session.id), str(booking.id))
            except Exception as exc:
                logger.warning(f"Failed to schedule tasks: {exc}")

        # Mark receipt as processed
        receipt.processed = True
        receipt.processed_at = now
        await db.commit()

        logger.info(
            f"✅ Retried webhook successfully for session {session.id}",
            extra={"session_id": str(session.id)},
        )

    except Exception as exc:
        receipt.error_message = str(exc)
        receipt.error_count += 1
        await db.commit()

        logger.error(
            f"Failed to retry webhook {receipt.room_name}: {exc}",
            exc_info=True,
            extra={
                "room_name": receipt.room_name,
                "error_count": receipt.error_count,
            },
        )
        raise
```

## Step 5: Schedule Cleanup Job

Update `app/core/celery_app.py` or Celery Beat configuration:

```python
from celery.schedules import schedule

app.conf.beat_schedule = {
    # ... existing tasks ...

    'cleanup-unprocessed-webhooks': {
        'task': 'app.tasks.webhook_cleanup_tasks.cleanup_unprocessed_webhooks',
        'schedule': schedule(run_every=timedelta(minutes=5)),  # Every 5 minutes
    },
}
```

## Step 6: Add Monitoring

Add to your monitoring/alerting system:

```python
# In your monitoring dashboard:
# 1. Count of unprocessed webhooks (should be near 0)
# 2. Max age of unprocessed webhooks (should be < 5 min)
# 3. Error rate of webhooks (track error_count in receipts)
# 4. Alert if any receipt has error_count >= 5
```

## Step 7: Add Tests

Create `tests/integration/test_webhook_consistency.py`:

```python
@pytest.mark.asyncio
async def test_webhook_lost_then_recovered(db, session, booking):
    """Webhook is lost, then recovered by cleanup job"""

    # Route sets status
    session.status = SessionStatus.COMPLETED
    session.actual_end_at = datetime.now(tz=timezone.utc)
    await db.commit()

    # Webhook receipt would be recorded, but processing fails
    receipt = WebhookReceipt(room_name=session.livekit_room_name, event_type="room_finished")
    db.add(receipt)
    await db.commit()

    # No transaction created yet
    txns = await db.execute(select(Transaction))
    assert txns.scalars().first() is None

    # Run cleanup job
    await cleanup_unprocessed_webhooks()

    # Now transaction should exist
    txns = await db.execute(select(Transaction))
    assert txns.scalars().first() is not None

    # Receipt should be marked processed
    receipt = await db.execute(select(WebhookReceipt))
    assert receipt.scalar_one().processed is True
```

## Verification Checklist

- [ ] WebhookReceipt model created
- [ ] Migration applied
- [ ] Webhook handler updated to record receipt
- [ ] Cleanup job created and scheduled
- [ ] Tests added for recovery scenarios
- [ ] Monitoring alerts configured
- [ ] Documentation updated
- [ ] Tested manually: webhook failure and recovery
- [ ] Tested manually: duplicate webhook arrival
- [ ] Tested with load: multiple concurrent webhooks

## Rollout Plan

1. **Phase 1:** Deploy WebhookReceipt model with migration
2. **Phase 2:** Update webhook handler to record receipts
3. **Phase 3:** Deploy cleanup job and schedule it
4. **Phase 4:** Monitor for 24 hours
5. **Phase 5:** Enable alerts

## Monitoring After Rollout

Watch for:

- Unprocessed webhook receipts appearing
- Cleanup job successfully recovering webhooks
- No new instances of missing transactions
- No errors in cleanup job logs
