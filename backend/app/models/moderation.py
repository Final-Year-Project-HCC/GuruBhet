import uuid
from datetime import datetime
from sqlalchemy import (
    ForeignKey, Text, DateTime, Boolean,
    Enum as SAEnum, Index,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UUIDPrimaryKeyMixin, TimestampMixin
from app.core.enums import ReportReason, ReportStatus, BanStatus


class Report(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """
    Report filed by either a student or teacher.

    Design change from original `Dispute`:
      - Renamed to `Report` — a Dispute implies both parties contesting, but here
        one party simply files a complaint.  Disputes (payment contesting) live
        within the Booking cancellation flow.
      - `reporter_id` + `reporter_role` identify who filed.
      - `reported_user_id` is the accused party.
      - `booking_id` is the FK (not session_id) — report is at contract level.
        Individual session evidence is linked via `evidence_session_id`.
      - `evidence_recording_url` allows attaching the LiveKit recording directly.
      - Proper enums for `reason` and `status` instead of raw strings.
    """

    __tablename__ = "reports"

    reporter_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    reported_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    booking_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("bookings.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    evidence_session_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("sessions.id", ondelete="SET NULL"),
        nullable=True,
    )

    reason: Mapped[ReportReason] = mapped_column(SAEnum(ReportReason), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    evidence_recording_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    evidence_urls: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON array of S3 keys

    status: Mapped[ReportStatus] = mapped_column(
        SAEnum(ReportStatus), default=ReportStatus.OPEN, nullable=False, index=True
    )
    reviewed_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    resolution_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ── Relationships ─────────────────────────────────────────────────────────
    reporter_student: Mapped["StudentProfile | None"] = relationship(  # noqa: F821
        foreign_keys=[reporter_id],
        primaryjoin="Report.reporter_id == StudentProfile.user_id",
        back_populates="reports_made",
        overlaps="reporter_teacher",
    )
    reporter_teacher: Mapped["TeacherProfile | None"] = relationship(  # noqa: F821
        foreign_keys=[reporter_id],
        primaryjoin="Report.reporter_id == TeacherProfile.user_id",
        back_populates="reports_made",
        overlaps="reporter_student",
    )
    booking: Mapped["Booking | None"] = relationship(back_populates="report")  # noqa: F821
    reviewed_by: Mapped["User | None"] = relationship(  # noqa: F821
        foreign_keys=[reviewed_by_id]
    )

    __table_args__ = (
        Index("ix_report_status_created", "status", "created_at"),
    )


class UserBan(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """
    Ban record for a teacher (or future: student).

    Design: Separate from User.is_banned flag.  The flag is the quick lookup;
    this table is the full audit trail with reason, evidence, duration, etc.
    Multiple bans (lifted and re-banned) are supported.
    """

    __tablename__ = "user_bans"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    teacher_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("teacher_profiles.user_id", ondelete="CASCADE"),
        nullable=True,
    )
    report_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("reports.id", ondelete="SET NULL"),
        nullable=True,
    )
    banned_by_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )

    reason: Mapped[str] = mapped_column(Text, nullable=False)
    evidence_recording_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    status: Mapped[BanStatus] = mapped_column(
        SAEnum(BanStatus), default=BanStatus.ACTIVE, nullable=False, index=True
    )
    is_permanent: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    lifted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    lifted_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    lift_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ── Relationships ─────────────────────────────────────────────────────────
    user: Mapped["User"] = relationship(  # noqa: F821
        foreign_keys=[user_id], back_populates="bans"
    )
    teacher: Mapped["TeacherProfile | None"] = relationship(  # noqa: F821
        foreign_keys=[teacher_id], back_populates="bans"
    )
    banned_by: Mapped["User"] = relationship(foreign_keys=[banned_by_id])  # noqa: F821