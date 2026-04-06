from datetime import datetime
from uuid import UUID

from sqlalchemy import Boolean, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

class StaffInvitation(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "staff_invitations"

    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    token_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    
    # Assigned permissions and roles for when the staff registers
    permissions: Mapped[list[str]] = mapped_column(ARRAY(String), default=list, server_default="{}", nullable=False)
    is_superuser: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)
    
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    is_used: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)
    
    # Track who sent the invite
    invited_by_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Relationships
    invited_by = relationship("User", foreign_keys=[invited_by_id])