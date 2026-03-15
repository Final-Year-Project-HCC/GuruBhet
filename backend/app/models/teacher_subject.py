import uuid
from decimal import Decimal
from sqlalchemy import (
    ForeignKey, Integer, Numeric, PrimaryKeyConstraint,
    CheckConstraint, Index,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class TeacherSubject(Base, TimestampMixin):
    """
    What a teacher offers to teach for a given subject.

    Design additions vs original:
      - `rate_per_session` stored as NUMERIC(10,2) in NPR paisa → rupees.
      - `years_of_experience` — teacher self-declared, used in recommendation scoring.
      - `total_sessions_completed` — auto-incremented by the session completion worker.
      - `avg_rating` — denormalised aggregate updated after each new TeacherRating.
        Avoids expensive AVG() on every search query.
      - `rating_count` — number of ratings (needed to correctly recompute avg_rating).
      - `is_active` — teacher can pause a subject without deleting the record.
    """

    __tablename__ = "teacher_subjects"

    teacher_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("teacher_profiles.user_id", ondelete="CASCADE"),
        nullable=False,
    )
    subject_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("subjects.id", ondelete="CASCADE"),
        nullable=False,
    )

    rate_per_session: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), nullable=False
    )
    years_of_experience: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # ── Denormalised recommendation signals ──────────────────────────────────
    total_sessions_completed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    avg_rating: Mapped[Decimal] = mapped_column(Numeric(3, 2), default=Decimal("0.00"), nullable=False)
    rating_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)

    # ── Relationships ─────────────────────────────────────────────────────────
    teacher: Mapped["TeacherProfile"] = relationship(back_populates="teacher_subjects")  # noqa: F821
    subject: Mapped["Subject"] = relationship(back_populates="teacher_subjects")  # noqa: F821
    ratings: Mapped[list["TeacherRating"]] = relationship(  # noqa: F821
        back_populates="teacher_subject", lazy="noload"
    )

    __table_args__ = (
        PrimaryKeyConstraint("teacher_id", "subject_id"),
        CheckConstraint("rate_per_session > 0", name="chk_rate_positive"),
        CheckConstraint("avg_rating >= 0 AND avg_rating <= 5", name="chk_avg_rating_range"),
        Index("ix_teacher_subject_search", "subject_id", "avg_rating", "total_sessions_completed"),
    )