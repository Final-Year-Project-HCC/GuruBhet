import uuid
from sqlalchemy import String, UniqueConstraint, Enum as SAEnum, Index, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UUIDPrimaryKeyMixin, TimestampMixin
from app.core.enums import StudyLevel


class Subject(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """
    Normalised subject catalog.

    A subject belongs to a faculty and has a semester number.
    Semester validity is enforced at the application level by checking against faculty.number_of_semesters.
    Subjects are seeded by admins; teachers reference them via TeacherSubject.

    Design:
      - Foreign keys to University and Faculty (enforcing referential integrity).
      - semester_number is stored directly (1 to faculty.number_of_semesters) and validated at the app level.
      - `is_active` flag so deprecated subjects can be hidden without deletion.
      - Commented fields (level, board) to be considered later.
    """

    __tablename__ = "subjects"

    # ── Foreign Keys ──────────────────────────────────────────────────────────
    university_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("universities.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    faculty_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("faculties.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    semester_number: Mapped[int] = mapped_column(Integer, nullable=False)

    name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    
    # ── Commented fields — to be considered later ─────────────────────────────
    # level: Mapped[StudyLevel] = mapped_column(SAEnum(StudyLevel), nullable=False, index=True)
    # board: Mapped[str | None] = mapped_column(String(100), nullable=True)         # NEB, CBSE …

    class_name: Mapped[str | None] = mapped_column(String(50), nullable=True)     # "Class 10" etc.
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)

    # ── Relationships ─────────────────────────────────────────────────────────
    university: Mapped["University"] = relationship(  # noqa: F821
        lazy="noload",
    )
    faculty: Mapped["Faculty"] = relationship(  # noqa: F821
        lazy="noload",
    )
    teacher_subjects: Mapped[list["TeacherSubject"]] = relationship(  # noqa: F821
        back_populates="subject", lazy="noload"
    )

    __table_args__ = (
        UniqueConstraint(
            "name", "faculty_id", "semester_number",
            name="uq_subject_per_faculty_semester",
        ),
        Index("ix_subject_faculty_semester", "faculty_id", "semester_number"),
    )