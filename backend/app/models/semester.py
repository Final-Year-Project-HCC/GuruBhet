from sqlalchemy import ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UUIDPrimaryKeyMixin, TimestampMixin


class Semester(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """
    Semester model representing a semester within a faculty.
    
    A semester is uniquely identified by (faculty_id, semester_number).
    A semester contains multiple subjects.
    """

    __tablename__ = "semesters"

    faculty_id: Mapped[int] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("faculties.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    semester_number: Mapped[int] = mapped_column(Integer, nullable=False)

    # ── Relationships ─────────────────────────────────────────────────────────
    faculty: Mapped["Faculty"] = relationship(  # noqa: F821
        back_populates="semesters",
        lazy="noload",
    )
    subjects: Mapped[list["Subject"]] = relationship(  # noqa: F821
        back_populates="semester",
        cascade="all, delete-orphan",
        lazy="noload",
    )
