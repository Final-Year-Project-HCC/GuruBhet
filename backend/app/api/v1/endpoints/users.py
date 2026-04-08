from fastapi import APIRouter

from app.core.dependencies import CurrentUser, DbSession
from app.core.exceptions import ValidationError
from app.core.security import hash_password, verify_password
from app.schemas.user import PasswordChangeRequest, UserRead

router = APIRouter()


@router.get("/me", response_model=UserRead)
async def get_me(current_user: CurrentUser):
    """
    Return the base account info for any logged-in user.
    Role-specific profile (bio, avatar, etc.) is at:
      GET /students/me  (students)
      GET /teachers/me  (teachers)
    """
    return current_user


@router.patch("/me/password", status_code=204)
async def change_password(
    body: PasswordChangeRequest,
    current_user: CurrentUser,
    db: DbSession,
):
    """Change password for any logged-in user."""
    if not verify_password(body.current_password, current_user.password_hash):
        raise ValidationError(
            detail="Current password is incorrect", context={"field": "current_password"}
        )

    current_user.password_hash = hash_password(body.new_password)
    await db.flush()


@router.delete("/me", status_code=204)
async def deactivate_account(current_user: CurrentUser, db: DbSession):
    """
    Soft-delete: marks the account inactive.
    Does not permanently delete — admin can reactivate.
    """
    current_user.is_active = False
    await db.flush()
