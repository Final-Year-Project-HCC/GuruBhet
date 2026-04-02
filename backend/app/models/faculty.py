from sqlalchemy import String, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
import uuid

from app.db.base import Base, UUIDPrimaryKeyMixin, TimestampMixin


class Faculty(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """
    Faculty model representing a faculty within a university.
    
    A faculty is uniquely identified by (university_id, name).
    A faculty defines the number of semesters it has; individual semesters are not stored as separate entities.
    """

    __tablename__ = "faculties"

    university_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("universities.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    number_of_semesters: Mapped[int] = mapped_column(Integer, nullable=False)

    # ── Relationships ─────────────────────────────────────────────────────────
    university: Mapped["University"] = relationship(  # noqa: F821
        back_populates="faculties",
        lazy="noload",
    )
