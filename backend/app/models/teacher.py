import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum as SAEnum, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.enums import VerificationStatus
from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.booking import Booking
    from app.models.moderation import Report, UserBan
    from app.models.payment import Payout
    from app.models.teacher_document import TeacherDocument
    from app.models.teacher_subject import TeacherSubject
    from app.models.user import User


class TeacherProfile(Base, TimestampMixin):
    __tablename__ = "teacher_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    headline: Mapped[str | None] = mapped_column(Text, nullable=True)

    # eSewa verified separately from document verification
    document_status: Mapped[VerificationStatus] = mapped_column(
        SAEnum(VerificationStatus), default=VerificationStatus.PENDING, nullable=False
    )
    esewa_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_payment_verified: Mapped[bool] = mapped_column(default=False, nullable=False)
    # Admin who reviewed and approved/rejected
    reviewed_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # ── Relationships ─────────────────────────────────────────────────────────
    user: Mapped["User"] = relationship(  # noqa: F821
        back_populates="teacher_profile", foreign_keys=[user_id]
    )
    reviewer: Mapped["User | None"] = relationship(  # noqa: F821
        foreign_keys=[reviewed_by_id]
    )
    documents: Mapped[list["TeacherDocument"]] = relationship(  # noqa: F821
        back_populates="teacher", lazy="noload"
    )
    teacher_subjects: Mapped[list["TeacherSubject"]] = relationship(  # noqa: F821
        back_populates="teacher", lazy="noload"
    )
    bookings: Mapped[list["Booking"]] = relationship(  # noqa: F821
        back_populates="teacher", lazy="noload"
    )
    payouts: Mapped[list["Payout"]] = relationship(  # noqa: F821
        back_populates="teacher", lazy="noload"
    )
    reports_made: Mapped[list["Report"]] = relationship(  # noqa: F821
        foreign_keys="Report.reporter_id",
        primaryjoin="TeacherProfile.user_id == Report.reporter_id",
        back_populates="reporter_teacher",
        overlaps="reporter_student,reports_made",
        lazy="noload",
    )
    bans: Mapped[list["UserBan"]] = relationship(  # noqa: F821
        foreign_keys="UserBan.teacher_id", back_populates="teacher", lazy="noload"
    )