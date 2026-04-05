"""
Schemas for staff management endpoints.
"""
from uuid import UUID
from datetime import datetime
from pydantic import EmailStr

from .base import SharedConfig


class StaffCreateRequest(SharedConfig):

    first_name: str
    last_name: str
    email: EmailStr
    phone: str | None = None
    password: str
    staff_role: str  # Staff role value


class StaffUpdateRequest(SharedConfig):

    staff_role: str | None = None  # Staff role value
    is_active: bool | None = None


class StaffRead(SharedConfig):

    id: UUID


class AuditLogRead(SharedConfig):

    id: UUID
