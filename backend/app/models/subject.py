import uuid
from sqlalchemy import String, UniqueConstraint, Enum as SAEnum, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UUIDPrimaryKeyMixin, TimestampMixin
from app.core.enums import StudyLevel


class Subject(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """
    Normalised subject catalog.

    A subject is uniquely identified by (name, level, board/university, faculty, semester).
    Subjects are seeded by admins; teachers reference them via TeacherSubject.

    Design change from original:
      - `level` is now a proper StudyLevel enum (not a raw string).
      - Added a composite unique constraint to prevent duplicate catalog entries.
      - `is_active` flag so deprecated subjects can be hidden without deletion.
    """

    __tablename__ = "subjects"

    name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    level: Mapped[StudyLevel] = mapped_column(SAEnum(StudyLevel), nullable=False, index=True)

    # ── Institutional context (nullable — only relevant for higher ed) ────────
    board: Mapped[str | None] = mapped_column(String(100), nullable=True)         # NEB, CBSE …
    university: Mapped[str | None] = mapped_column(String(200), nullable=True)    # TU, KU …
    faculty: Mapped[str | None] = mapped_column(String(200), nullable=True)       # Science, Management …
    semester: Mapped[str | None] = mapped_column(String(20), nullable=True)       # 1–8
    class_name: Mapped[str | None] = mapped_column(String(50), nullable=True)     # "Class 10" etc.

    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)

    # ── Relationships ─────────────────────────────────────────────────────────
    teacher_subjects: Mapped[list["TeacherSubject"]] = relationship(  # noqa: F821
        back_populates="subject", lazy="noload"
    )

    __table_args__ = (
        UniqueConstraint(
            "name", "level", "board", "university", "faculty", "semester",
            name="uq_subject_catalog",
        ),
        Index("ix_subject_level_name", "level", "name"),
    )