from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UUIDPrimaryKeyMixin, TimestampMixin


class University(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """
    University model representing a higher education institution.
    
    A university can have multiple faculties (e.g., Science, Management, Engineering).
    """

    __tablename__ = "universities"

    name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # ── Relationships ─────────────────────────────────────────────────────────
    faculties: Mapped[list["Faculty"]] = relationship(  # noqa: F821
        back_populates="university",
        cascade="all, delete-orphan",
        lazy="noload",
    )
