import uuid
from datetime import datetime
from sqlalchemy import ForeignKey, Text, Boolean, DateTime, String, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UUIDPrimaryKeyMixin, TimestampMixin


class PaymentAccount(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """
    eSewa account linked to a User (both students and teachers).

    Design additions vs original:
      - `esewa_phone` replaces the generic `account_identifier`.
      - `verification_screenshot_url` — for teachers, admin checks eSewa ownership.
      - `is_primary` flag in case multi-account support is added later.
    """

    __tablename__ = "payment_accounts"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    provider: Mapped[str] = mapped_column(String(50), nullable=False, default="esewa")
    esewa_phone: Mapped[str] = mapped_column(String(20), nullable=False)

    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    verified_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    # For teachers — screenshot or OTP proof
    verification_screenshot_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ── Relationships ─────────────────────────────────────────────────────────
    user: Mapped["User"] = relationship(  # noqa: F821
        back_populates="payment_account", foreign_keys=[user_id]
    )
    verified_by: Mapped["User | None"] = relationship(  # noqa: F821
        foreign_keys=[verified_by_id]
    )