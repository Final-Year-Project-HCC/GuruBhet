import uuid
from sqlalchemy import ForeignKey, Enum as SAEnum, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UUIDPrimaryKeyMixin, TimestampMixin
from app.core.enums import DocumentType


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

    # ── Relationships ─────────────────────────────────────────────────────────
    teacher: Mapped["TeacherProfile"] = relationship(back_populates="documents")  # noqa: F821