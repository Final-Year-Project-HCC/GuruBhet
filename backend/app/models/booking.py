import uuid
from decimal import Decimal
from datetime import datetime
from sqlalchemy import (
    ForeignKey, Integer, Numeric, DateTime, Text,
    Enum as SAEnum, CheckConstraint, Index,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UUIDPrimaryKeyMixin, TimestampMixin
from app.core.enums import BookingStatus, SessionStatus


class Booking(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """
    A Booking is the top-level contract between a student and a teacher
    for N sessions of a particular subject.

    Design change from original:
      The original schema had a single `Session` entity. This was split into
      Booking (the contract/payment unit) and Session (individual occurrences)
      because:
        1. Escrow is captured once per booking, not per session.
        2. Refunds are calculated from (total_sessions - completed_sessions).
        3. A booking cancelled mid-way needs a clear source of truth for
           how many sessions remain unfulfilled.
    """

    __tablename__ = "bookings"

    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("student_profiles.user_id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    teacher_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("teacher_profiles.user_id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    subject_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("subjects.id", ondelete="RESTRICT"),
        nullable=False,
    )

    total_sessions: Mapped[int] = mapped_column(Integer, nullable=False)
    completed_sessions: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    cancelled_sessions: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    rate_per_session: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)  # rate * total_sessions
    escrow_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)  # same initially
    refunded_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)

    status: Mapped[BookingStatus] = mapped_column(
        SAEnum(BookingStatus), default=BookingStatus.PENDING_PAYMENT, nullable=False, index=True
    )

    # eSewa transaction reference for the initial payment
    esewa_transaction_uuid: Mapped[str | None] = mapped_column(Text, nullable=True, unique=True)

    cancellation_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # ── Relationships ─────────────────────────────────────────────────────────
    student: Mapped["StudentProfile"] = relationship(back_populates="bookings")  # noqa: F821
    teacher: Mapped["TeacherProfile"] = relationship(back_populates="bookings")  # noqa: F821
    subject: Mapped["Subject"] = relationship()  # noqa: F821
    sessions: Mapped[list["Session"]] = relationship(  # noqa: F821
        back_populates="booking", lazy="noload", cascade="all, delete-orphan"
    )
    transactions: Mapped[list["Transaction"]] = relationship(  # noqa: F821
        back_populates="booking", lazy="noload"
    )
    report: Mapped["Report | None"] = relationship(  # noqa: F821
        back_populates="booking", uselist=False, lazy="noload"
    )

    __table_args__ = (
        CheckConstraint("total_sessions > 0", name="chk_total_sessions_positive"),
        CheckConstraint(
            "completed_sessions + cancelled_sessions <= total_sessions",
            name="chk_session_counts",
        ),
        Index("ix_booking_teacher_status", "teacher_id", "status"),
        Index("ix_booking_student_status", "student_id", "status"),
    )


class Session(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """
    A single teaching occurrence within a Booking.

    Design addition:
      - `livekit_room_name` links to the LiveKit room for this session.
      - `recording_url` for moderation/ban evidence.
      - `actual_start_at` / `actual_end_at` for actual duration tracking
        (differs from scheduled in case of late joins).
      - `teacher_joined_at` / `student_joined_at` for no-show detection.
    """

    __tablename__ = "sessions"

    booking_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("bookings.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    session_number: Mapped[int] = mapped_column(Integer, nullable=False)  # 1-based within booking

    scheduled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False)

    status: Mapped[SessionStatus] = mapped_column(
        SAEnum(SessionStatus), default=SessionStatus.SCHEDULED, nullable=False, index=True
    )

    # ── LiveKit integration ───────────────────────────────────────────────────
    livekit_room_name: Mapped[str | None] = mapped_column(Text, nullable=True, unique=True)
    recording_url: Mapped[str | None] = mapped_column(Text, nullable=True)  # S3 key
    recording_key: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ── Actual timing ─────────────────────────────────────────────────────────
    actual_start_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    actual_end_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    teacher_joined_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    student_joined_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)  # teacher post-session notes

    # ── Relationships ─────────────────────────────────────────────────────────
    booking: Mapped["Booking"] = relationship(back_populates="sessions")  # noqa: F821
    rating: Mapped["TeacherRating | None"] = relationship(  # noqa: F821
        back_populates="session", uselist=False, lazy="noload"
    )

    __table_args__ = (
        CheckConstraint("duration_minutes > 0", name="chk_duration_positive"),
        Index("ix_session_booking_number", "booking_id", "session_number"),
    )