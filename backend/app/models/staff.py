import uuid
from sqlalchemy import String, ForeignKey
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, TimestampMixin

from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from app.models.user import User

class StaffProfile(Base, TimestampMixin):
    __tablename__ = "staff_profiles"
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    permissions: Mapped[list[str]] = mapped_column(ARRAY(String), default=list, server_default="{}")
    
    user: Mapped["User"] = relationship(back_populates="staff_profile", foreign_keys=[user_id])
