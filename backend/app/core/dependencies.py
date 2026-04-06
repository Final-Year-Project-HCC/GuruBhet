from typing import Annotated
from uuid import UUID

from fastapi import Depends, status, Header
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import UserRole
from app.core.exceptions import MissingTokenError, InvalidTokenError, UserNotFoundError, PermissionDeniedError
from app.core.security import decode_token
from app.db.session import get_db
from app.models.user import User
from app.repositories.user_repo import UserRepository

DbSession = Annotated[AsyncSession, Depends(get_db)]


async def get_current_user(
    db: DbSession,
    x_access_token: str | None = Header(None, alias="x-access-token"),
) -> User:
    """Extract user from x-access-token header (converted from HttpOnly cookies by middleware)."""
    if not x_access_token:
        raise MissingTokenError(detail="Access token missing")
    
    try:
        payload = decode_token(x_access_token)
    except (ValueError, Exception):
        raise InvalidTokenError(detail="Invalid access token")
    
    if payload.get("type") != "access":
        raise InvalidTokenError(detail="Not an access token")

    user_id: str | None = payload.get("sub")
    if not user_id:
        raise InvalidTokenError(detail="Invalid token payload")

    repo = UserRepository(db)
    user = await repo.get_by_id(UUID(user_id))
    if not user or not user.is_active or user.is_banned:
        raise UserNotFoundError(detail="User not found or inactive")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_role(*roles: UserRole):
    async def _guard(current_user: CurrentUser) -> User:
        if current_user.role not in roles:
            raise PermissionDeniedError(
                detail=f"Requires one of: {[r.value for r in roles]}",
            )
        return current_user
    return _guard


RequireStudent = Depends(require_role(UserRole.STUDENT))
RequireTeacher = Depends(require_role(UserRole.TEACHER))
RequireStaff = Depends(require_role(UserRole.STAFF))
RequireStudentOrTeacher = Depends(require_role(UserRole.STUDENT, UserRole.TEACHER))

class HasPermission:
    """
    Granular permission checker dependency.
    Usage: @router.post("/", dependencies=[Depends(HasPermission("staff:manage"))])
    """
    def __init__(self, required_permission: str):
        self.required_permission = required_permission

    def __call__(self, current_user: CurrentUser) -> User:
        if current_user.role != UserRole.STAFF:
            raise PermissionDeniedError(detail="Staff access only.")

        has_access = current_user.is_superuser or (self.required_permission in current_user.permissions)
        if not has_access:
            raise PermissionDeniedError(detail=f"Missing required permission: {self.required_permission}")

        if (current_user.is_superuser or "staff:manage" in current_user.permissions) and not current_user.mfa_enabled:
            raise PermissionDeniedError(detail="Multi-Factor Authentication (MFA) is strictly required to exercise this permission.")

        return current_user

RequireStaffManage = Depends(HasPermission("staff:manage"))
RequireTeacherVerify = Depends(HasPermission("teacher:verify"))
RequireSensitiveView = Depends(HasPermission("teacher:view_sensitive"))
RequireAcademicsManage = Depends(HasPermission("academic_domains:manage"))

