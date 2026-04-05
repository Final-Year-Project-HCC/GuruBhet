import uuid
from sqlalchemy import String, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UUIDPrimaryKeyMixin, TimestampMixin
from app.core.enums import StudyLevel


class Subject(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """
    Normalised subject catalog.

    Subjects are seeded by admins; teachers reference them via TeacherSubject.

    Design:
      - `is_active` flag so deprecated subjects can be hidden without deletion.
      - Commented fields (level, board) to be considered later.
    """

    __tablename__ = "subjects"

    name: Mapped[str] = mapped_column(String(200), nullable=False, unique=True, index=True)
    
    # Commented fields — to be considered later
    # level: Mapped[StudyLevel] = mapped_column(SAEnum(StudyLevel), nullable=False, index=True)
    # board: Mapped[str | None] = mapped_column(String(100), nullable=True)         # NEB, CBSE …

    # ── Relationships ─────────────────────────────────────────────────────────
    teacher_subjects: Mapped[list["TeacherSubject"]] = relationship(  # noqa: F821
        back_populates="subject", lazy="noload"
    )