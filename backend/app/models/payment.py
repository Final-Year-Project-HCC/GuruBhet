import uuid
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.enums import TransactionType, TransactionReason, PayoutStatus, EsewaCallbackStatus
from app.db.base import Base, UUIDPrimaryKeyMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models.booking import Booking, Session # Added Session for type checking
    from app.models.teacher import TeacherProfile
    from app.models.user import User


class Transaction(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """
    Immutable ledger entry. Every money movement creates a row here.

    Hardened Design:
      - booking_id: Links to the overall escrow/booking.
      - session_id: RE-INTRODUCED for granular release tracking. Prevents double-paying 
        teachers for the same session in a multi-session booking.
      - UniqueConstraint(session_id, reason): The primary shield against race conditions.
    """

    __tablename__ = "transactions"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="NPR", nullable=False)

    type: Mapped[TransactionType] = mapped_column(SAEnum(TransactionType), nullable=False)
    reason: Mapped[TransactionReason] = mapped_column(SAEnum(TransactionReason), nullable=False)

    booking_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), 
        ForeignKey("bookings.id", ondelete="SET NULL"), 
        nullable=True, 
        index=True
    )
    
    # NEW: Re-introduced for session-level release validation
    session_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), 
        ForeignKey("sessions.id", ondelete="SET NULL"), 
        nullable=True, 
        index=True
    )

    payout_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("payouts.id", ondelete="SET NULL"), nullable=True
    )

    # eSewa references
    esewa_ref_id: Mapped[str | None] = mapped_column(Text, nullable=True, index=True)
    esewa_transaction_uuid: Mapped[str | None] = mapped_column(Text, nullable=True)
    esewa_status: Mapped[EsewaCallbackStatus | None] = mapped_column(
        SAEnum(EsewaCallbackStatus), nullable=True
    )

    metadata_: Mapped[str | None] = mapped_column("metadata", Text, nullable=True)  # JSON blob

    # ── Relationships ─────────────────────────────────────────────────────────
    user: Mapped["User"] = relationship()
    booking: Mapped["Booking | None"] = relationship(back_populates="transactions")
    session: Mapped["Session | None"] = relationship() # New relationship for easy access
    payout: Mapped["Payout | None"] = relationship(back_populates="transactions")

    __table_args__ = (
        CheckConstraint("amount > 0", name="chk_transaction_amount_positive"),
        Index("ix_transaction_user_reason", "user_id", "reason"),
        
        # ── THE SAFETY SHIELD ──────────────────────────────────────────────────
        # This constraint ensures that for a single session, a teacher can only 
        # receive ONE 'SESSION_RELEASE' credit. If a race condition occurs, 
        # the DB will throw an IntegrityError on the second attempt.
        UniqueConstraint(
            "session_id", 
            "reason", 
            name="uq_one_credit_per_session"
        ),
    )


class Payout(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """
    Weekly batch payout to a teacher.
    """

    __tablename__ = "payouts"

    teacher_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("teacher_profiles.user_id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    period_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    period_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    gross_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    platform_fee_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    net_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)

    status: Mapped[PayoutStatus] = mapped_column(
        SAEnum(PayoutStatus), default=PayoutStatus.PENDING, nullable=False, index=True
    )
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    esewa_ref_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    failure_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ── Relationships ─────────────────────────────────────────────────────────
    teacher: Mapped["TeacherProfile"] = relationship(back_populates="payouts")
    transactions: Mapped[list["Transaction"]] = relationship(back_populates="payout")

    __table_args__ = (
        CheckConstraint("net_amount > 0", name="chk_payout_net_positive"),
        CheckConstraint("period_end > period_start", name="chk_payout_period"),
        UniqueConstraint(
            "teacher_id", "period_start", "period_end", name="uq_payout_teacher_period"
        ),
    )