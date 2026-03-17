import uuid
from sqlalchemy import ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class StudentProfile(Base, TimestampMixin):
    __tablename__ = "student_profiles"

    # Same UUID as User — 1-to-1 share PK
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ── Relationships ─────────────────────────────────────────────────────────
    user: Mapped["User"] = relationship(back_populates="student_profile")  # noqa: F821
    bookings: Mapped[list["Booking"]] = relationship(  # noqa: F821
        back_populates="student", lazy="noload"
    )
    ratings_given: Mapped[list["TeacherRating"]] = relationship(  # noqa: F821
        back_populates="student", lazy="noload"
    )
    reports_made: Mapped[list["Report"]] = relationship(  # noqa: F821
        foreign_keys="Report.reporter_id",
        primaryjoin="StudentProfile.user_id == Report.reporter_id",
        back_populates="reporter_student",
        overlaps="reporter_teacher,reports_made",
        lazy="noload",
    )