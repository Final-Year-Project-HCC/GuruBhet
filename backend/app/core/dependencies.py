from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import UserRole
from app.core.security import decode_token
from app.db.session import get_db
from app.models.user import User
from app.repositories.user_repo import UserRepository

bearer_scheme = HTTPBearer()

DbSession = Annotated[AsyncSession, Depends(get_db)]


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(bearer_scheme)],
    db: DbSession,
) -> User:
    payload = decode_token(credentials.credentials)
    if payload.get("type") != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not an access token")

    user_id: str | None = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")

    repo = UserRepository(db)
    user = await repo.get_by_id(UUID(user_id))
    if not user or not user.is_active or user.is_banned:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_role(*roles: UserRole):
    async def _guard(current_user: CurrentUser) -> User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires one of: {[r.value for r in roles]}",
            )
        return current_user
    return _guard


RequireStudent = Depends(require_role(UserRole.STUDENT))
RequireTeacher = Depends(require_role(UserRole.TEACHER))
RequireAdmin = Depends(require_role(UserRole.ADMIN))
RequireStudentOrTeacher = Depends(require_role(UserRole.STUDENT, UserRole.TEACHER))