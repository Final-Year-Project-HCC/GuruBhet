with open('../../backend/app/core/dependencies.py', 'w') as f:
    f.write('''from typing import Annotated
from uuid import UUID

from fastapi import Depends, Header, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import UserRole
from app.core.exceptions import (
    InvalidTokenError,
    MissingTokenError,
    PermissionDeniedError,
    UserNotFoundError,
)
from app.core.security import decode_token
from app.db.session import get_db
from app.models.user import User
from app.repositories.user_repo import UserRepository

