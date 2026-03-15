import uuid
from sqlalchemy import ForeignKey, Text, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.core.enums import VerificationStatus


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
    verification_status: Mapped[VerificationStatus] = mapped_column(
        SAEnum(VerificationStatus), default=VerificationStatus.PENDING, nullable=False
    )
    # Admin who reviewed and approved/rejected
    reviewed_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    reviewed_at: Mapped[str | None] = mapped_column(nullable=True)  # DateTime stored as str placeholder

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
        back_populates="reporter_teacher",
        lazy="noload",
    )
    bans: Mapped[list["UserBan"]] = relationship(  # noqa: F821
        foreign_keys="UserBan.teacher_id", back_populates="teacher", lazy="noload"
    )