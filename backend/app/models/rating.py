import uuid
from sqlalchemy import (
    ForeignKey, Text, UniqueConstraint, CheckConstraint,
    Enum as SAEnum, SmallInteger,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UUIDPrimaryKeyMixin, TimestampMixin
from app.core.enums import RatingScore


class TeacherRating(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """
    Rating given by a student to a teacher after a booking is complete.

    Design changes:
      - Tied to Booking (not individual Session) — one rating per booking after all sessions are complete.
      - Tied to both Booking AND TeacherSubject so that avg_rating on
        TeacherSubject can be updated atomically.
      - `score` is a SmallInteger with a DB CHECK (1-5).
      - `comment` is optional freetext from the student.
      - UniqueConstraint(booking_id) — one rating per booking.
    """

    __tablename__ = "teacher_ratings"

    booking_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("bookings.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,   # one rating per booking
    )
    # Denormalised for easy aggregate updates
    teacher_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("teacher_profiles.user_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    subject_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("subjects.id", ondelete="CASCADE"),
        nullable=False,
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("student_profiles.user_id", ondelete="CASCADE"),
        nullable=False,
    )

    score: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ── Relationships ─────────────────────────────────────────────────────────
    booking: Mapped["Booking"] = relationship(back_populates="rating")  # noqa: F821
    student: Mapped["StudentProfile"] = relationship(back_populates="ratings_given")  # noqa: F821
    teacher_subject: Mapped["TeacherSubject"] = relationship(  # noqa: F821
        primaryjoin=(
            "and_(TeacherRating.teacher_id == TeacherSubject.teacher_id,"
            " TeacherRating.subject_id == TeacherSubject.subject_id)"
        ),
        back_populates="ratings",
        foreign_keys="[TeacherRating.teacher_id, TeacherRating.subject_id]",
    )

    __table_args__ = (
        CheckConstraint("score >= 1 AND score <= 5", name="chk_rating_score_range"),
    )