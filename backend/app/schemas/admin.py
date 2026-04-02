"""
Schemas for admin management endpoints.
"""
from uuid import UUID
from datetime import datetime
from pydantic import EmailStr

from .base import SharedConfig


class AdminCreateRequest(SharedConfig):

    first_name: str
    last_name: str
    email: EmailStr
    phone: str | None = None
    password: str
    admin_role: str  # AdminRole value


class AdminUpdateRequest(SharedConfig):

    admin_role: str | None = None  # AdminRole value
    is_active: bool | None = None


class AdminRead(SharedConfig):

    id: UUID


class AuditLogRead(SharedConfig):

    id: UUID
