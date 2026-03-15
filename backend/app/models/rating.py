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
    Rating given by a student to a teacher for a specific completed session.

    Design additions:
      - Tied to both Session AND TeacherSubject so that avg_rating on
        TeacherSubject can be updated atomically.
      - `score` is a SmallInteger with a DB CHECK (1-5).
      - `comment` is optional freetext from the student.
      - UniqueConstraint(session_id) — one rating per session.
    """

    __tablename__ = "teacher_ratings"

    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("sessions.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,   # one rating per session
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
    is_anonymous: Mapped[bool] = mapped_column(default=False, nullable=False)

    # ── Relationships ─────────────────────────────────────────────────────────
    session: Mapped["Session"] = relationship(back_populates="rating")  # noqa: F821
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