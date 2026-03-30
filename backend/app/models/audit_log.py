"""
Audit logging for all administrative actions.

Tracks who did what, when, and where to maintain accountability and enable
security audits.
"""
import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import DateTime, Enum as SAEnum, ForeignKey, String, Text, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.enums import AuditActionType
from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User


class AuditLog(Base):
    """
    Immutable audit trail of administrative actions.

    Every action by a staff member should create an AuditLog entry.
    This enables accountability and forensic investigation of issues.
    """

    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # ── Action details ──────────────────────────────────────────────────
    action_type: Mapped[AuditActionType] = mapped_column(
        SAEnum(AuditActionType), nullable=False, index=True
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ── Actor (who did it) ───────────────────────────────────────────────
    actor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )

    # ── Target (what was affected) ───────────────────────────────────────
    target_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )  # User affected by the action
    target_resource_type: Mapped[str | None] = mapped_column(
        String(100), nullable=True
    )  # e.g., "Teacher", "Booking", "Subject"
    target_resource_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )

    # ── Context ─────────────────────────────────────────────────────────
    ip_address: Mapped[str | None] = mapped_column(String(50), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(500), nullable=True)
    metadata: Mapped[dict[str, Any] | None] = mapped_column(
        JSON, nullable=True
    )  # Additional context (e.g., old values vs new values for updates)

    # ── Timestamp ───────────────────────────────────────────────────────
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True, default=datetime.utcnow
    )

    # ── Relationships ───────────────────────────────────────────────────
    actor: Mapped["User"] = relationship(
        foreign_keys=[actor_id], lazy="noload"
    )  # noqa: F821

    def __repr__(self) -> str:
        return f"<AuditLog {self.action_type} by {self.actor_id} at {self.created_at}>"
