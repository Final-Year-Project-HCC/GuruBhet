"""
Audit logging utilities for tracking administrative actions.
"""
from typing import Any
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import AuditActionType
from app.models.audit_log import AuditLog
from app.models.user import User


async def log_audit(
    db: AsyncSession,
    action_type: AuditActionType,
    actor: User,
    description: str | None = None,
    target_user_id: UUID | None = None,
    target_resource_type: str | None = None,
    target_resource_id: UUID | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> AuditLog:
    """
    Create an audit log entry for an administrative action.

    Args:
        db: Database session
        action_type: Type of action being logged
        actor: User performing the action
        description: Human-readable description
        target_user_id: ID of user affected by action (if applicable)
        target_resource_type: Type of resource affected (e.g., "Teacher", "Booking")
        target_resource_id: ID of resource affected
        ip_address: IP address of the request
        user_agent: User agent string from request
        metadata: Additional context (e.g., before/after values)

    Returns:
        The created AuditLog entry
    """
    log = AuditLog(
        action_type=action_type,
        actor_id=actor.id,
        description=description,
        target_user_id=target_user_id,
        target_resource_type=target_resource_type,
        target_resource_id=target_resource_id,
        ip_address=ip_address,
        user_agent=user_agent,
        metadata=metadata,
    )
    db.add(log)
    await db.flush()
    return log
