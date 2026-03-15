import uuid
from datetime import datetime
from sqlalchemy import ForeignKey, Text, DateTime, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UUIDPrimaryKeyMixin, TimestampMixin
from app.core.enums import DocumentType, VerificationStatus


class TeacherDocument(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "teacher_documents"

    teacher_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("teacher_profiles.user_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    type: Mapped[DocumentType] = mapped_column(SAEnum(DocumentType), nullable=False)
    file_url: Mapped[str] = mapped_column(Text, nullable=False)
    file_key: Mapped[str] = mapped_column(Text, nullable=False)  # S3 object key

    status: Mapped[VerificationStatus] = mapped_column(
        SAEnum(VerificationStatus), default=VerificationStatus.PENDING, nullable=False
    )
    verified_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    remarks: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ── Relationships ─────────────────────────────────────────────────────────
    teacher: Mapped["TeacherProfile"] = relationship(back_populates="documents")  # noqa: F821
    verified_by: Mapped["User | None"] = relationship(  # noqa: F821
        foreign_keys=[verified_by_id]
    )