"""
PayoutService orchestrates the weekly payout calculation.

Algorithm:
  1. Find all sessions completed in [period_start, period_end].
  2. Group by (teacher_id, booking.subject_id).
  3. For each teacher:
       gross = Σ(booking.rate_per_session) for each completed session this period
       platform_fee = gross * PLATFORM_FEE_PERCENT / 100
       net = gross - platform_fee
  4. Check no existing PENDING/COMPLETED Payout for same (teacher, period) — prevent double payout.
  5. Create Payout record (PENDING).
  6. Call eSewa transfer API.
  7. Update Payout to COMPLETED + create WEEKLY_PAYOUT Transaction.
"""
from datetime import datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.enums import PayoutStatus, TransactionType, TransactionReason, SessionStatus
from app.models.payment import Payout, Transaction
from app.models.booking import Session, Booking
from app.utils.esewa import initiate_transfer


class PayoutService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def process_period(self, period_start: datetime, period_end: datetime) -> None:
        # Fetch all completed sessions in the period, joined to booking for rate + teacher
        stmt = (
            select(
                Session.booking_id,
                Booking.teacher_id,
                Booking.rate_per_session,
                func.count(Session.id).label("session_count"),
            )
            .join(Booking, Session.booking_id == Booking.id)
            .where(
                Session.status == SessionStatus.COMPLETED,
                Session.actual_end_at >= period_start,
                Session.actual_end_at < period_end,
            )
            .group_by(Booking.teacher_id, Session.booking_id, Booking.rate_per_session)
        )
        rows = (await self.db.execute(stmt)).all()

        # Aggregate per teacher
        teacher_totals: dict[UUID, Decimal] = {}
        for row in rows:
            teacher_id = row.teacher_id
            earned = row.rate_per_session * row.session_count
            teacher_totals[teacher_id] = teacher_totals.get(teacher_id, Decimal("0.00")) + earned

        for teacher_id, gross in teacher_totals.items():
            await self._pay_teacher(teacher_id, gross, period_start, period_end)

    async def _pay_teacher(
        self,
        teacher_id: UUID,
        gross: Decimal,
        period_start: datetime,
        period_end: datetime,
    ) -> None:
        from app.models.payment_account import PaymentAccount
        from app.models.user import User

        # Guard: no double-payout
        existing = await self.db.execute(
            select(Payout).where(
                Payout.teacher_id == teacher_id,
                Payout.period_start == period_start,
                Payout.period_end == period_end,
                Payout.status.in_([PayoutStatus.PENDING, PayoutStatus.COMPLETED]),
            )
        )
        if existing.scalar_one_or_none():
            return

        fee = (gross * Decimal(str(settings.PLATFORM_FEE_PERCENT)) / Decimal("100")).quantize(Decimal("0.01"))
        net = gross - fee

        payout = Payout(
            teacher_id=teacher_id,
            period_start=period_start,
            period_end=period_end,
            gross_amount=gross,
            platform_fee_amount=fee,
            net_amount=net,
            status=PayoutStatus.PROCESSING,
        )
        self.db.add(payout)
        await self.db.flush()

        # Get teacher's eSewa phone
        pa_result = await self.db.execute(
            select(PaymentAccount).where(PaymentAccount.user_id == teacher_id)
        )
        pa = pa_result.scalar_one_or_none()
        if not pa or not pa.is_verified:
            payout.status = PayoutStatus.FAILED
            payout.failure_reason = "No verified eSewa account"
            return

        try:
            esewa_resp = await initiate_transfer(
                to_phone=pa.esewa_phone,
                amount=net,
                remarks=f"GuruBhet payout {period_start.date()} – {period_end.date()}",
            )
            payout.status = PayoutStatus.COMPLETED
            payout.esewa_ref_id = esewa_resp.get("refId")
            payout.processed_at = datetime.utcnow()

            self.db.add(Transaction(
                user_id=teacher_id,
                amount=net,
                type=TransactionType.CREDIT,
                reason=TransactionReason.WEEKLY_PAYOUT,
                payout_id=payout.id,
            ))
        except Exception as exc:
            payout.status = PayoutStatus.FAILED
            payout.failure_reason = str(exc)

        await self.db.flush()