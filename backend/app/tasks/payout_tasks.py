"""
Weekly payout flow:
  1. Find all ACTIVE bookings with sessions completed in [period_start, period_end].
  2. Group by teacher.
  3. For each teacher: gross = sum(rate_per_session * completed_sessions_this_week)
  4. Deduct platform fee (settings.PLATFORM_FEE_PERCENT).
  5. Create a Payout record, mark PROCESSING.
  6. Call eSewa transfer API to send net_amount to teacher's esewa_phone.
  7. On success: update Payout.status=COMPLETED, create WEEKLY_PAYOUT Transaction.
  8. On failure: update Payout.status=FAILED, log + alert admin.
"""
import asyncio
from datetime import datetime, timedelta, timezone

from app.celery import celery_app
from app.core.config import settings


@celery_app.task(name="app.tasks.payout_tasks.process_weekly_payouts", bind=True, max_retries=3)
def process_weekly_payouts(self):
    """Entry point — bridges sync Celery into async SQLAlchemy."""
    from app.core.task_runner import run_async
    run_async(_run_payouts())


async def _run_payouts():
    from app.db.session import sessionmanager
    await sessionmanager.init()

    now = datetime.now(tz=timezone.utc)
    period_end = now
    period_start = now - timedelta(days=7)

    async for db in sessionmanager.session():
        from app.services.payout_service import PayoutService
        service = PayoutService(db)
        await service.process_period(period_start, period_end)

    await sessionmanager.close()
