import time
import uuid
import logging
from typing import Annotated
from fastapi import APIRouter, UploadFile, File, status, HTTPException, Depends
from fastapi.concurrency import run_in_threadpool
import redis.asyncio as aioredis

from app.core.dependencies import CurrentUser, DbSession
from app.core.exceptions import (
    ValidationError, 
    RateLimitError, 
    UploadFailedError
)
from app.core.security import hash_password, verify_password
from app.schemas.user import PasswordChangeRequest, UserRead
from app.db.redis import get_redis
from app.utils.cloudinary import get_cloudinary_manager
from app.core.config import settings
from app.repositories.user_repo import UserRepository

router = APIRouter()

REDIS_RATE_LIMIT_KEY = "avatar_upload:{user_id}"
RATE_LIMIT_MAX = 3
RATE_LIMIT_WINDOW = 60 * 60  # 1 hour
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB

@router.post("/avatar", response_model=UserRead, status_code=200)
async def upload_avatar(
    current_user: CurrentUser,
    db: DbSession,
    redis: Annotated[aioredis.Redis, Depends(get_redis)],
    avatar: UploadFile = File(...),
):
    """
    Upload or update the authenticated user's avatar. Rate limited to 3 uploads/hour.
    """
    # 1. Rate limiting with Sliding Window logic
    key = REDIS_RATE_LIMIT_KEY.format(user_id=current_user.id)
    now = time.time()
    
    async with redis.pipeline(transaction=True) as pipe:
        # We use a UUID suffix to ensure every request is unique in the ZSET
        request_id = f"{now}-{uuid.uuid4()}"
        pipe.zremrangebyscore(key, 0, now - RATE_LIMIT_WINDOW)
        pipe.zadd(key, {request_id: now})
        pipe.zcard(key)
        pipe.expire(key, RATE_LIMIT_WINDOW)
        _, _, count, _ = await pipe.execute()

    if count > RATE_LIMIT_MAX:
        raise RateLimitError(detail="Rate limit exceeded. Try again later.")

    # 2. Validation
    if not avatar.content_type.startswith("image/"):
        raise ValidationError(detail="Only image uploads are allowed.")

    # Basic size check before reading into memory
    if avatar.size and avatar.size > MAX_FILE_SIZE:
        raise ValidationError(detail="Image size exceeds the 5MB limit.")

    # 3. Cloudinary Upload
    # Since your CloudinaryManager uses blocking SDK calls, we run it in a threadpool
    cloudinary_manager = get_cloudinary_manager()
    # Fixed public_id to be deterministic for the user
    public_id = f"user_{current_user.id}_avatar"

    try:
        file_bytes = await avatar.read()
        if len(file_bytes) > MAX_FILE_SIZE:
            raise ValidationError(detail="Image size exceeds the 5MB limit.")

        upload_result = await run_in_threadpool(
            cloudinary_manager.upload_file,
            file_bytes,
            folder="avatars",
            public_id=public_id,
        )
    except Exception as e:
        raise UploadFailedError(detail=f"Upload failed: {str(e)}", cause=e)

    avatar_url = upload_result.get("secure_url")
    if not avatar_url:
        raise UploadFailedError(detail="Failed to get avatar URL from Cloudinary.")

    # 4. Database Persistence
    try:
        current_user.avatar_url = avatar_url
        await db.commit()
        await db.refresh(current_user)
    except Exception as db_exc:
        await db.rollback()
        logger.error(f"Database update failed for user {current_user.id} avatar: {db_exc}")
        # Attempt to delete the uploaded avatar from Cloudinary if DB fails
        try:
            await run_in_threadpool(
                cloudinary_manager.delete_file, 
                public_id, 
                resource_type="image"
            )
        except Exception:
            pass  
        raise UploadFailedError(detail="Failed to update profile. Please try again.", cause=db_exc)

    return current_user


@router.patch("/me/password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    body: PasswordChangeRequest,
    current_user: CurrentUser,
    db: DbSession,
):
    """Change password for any logged-in user."""
    if not verify_password(body.current_password, current_user.password_hash):
        raise ValidationError(
            detail="Current password is incorrect", 
            context={"field": "current_password"}
        )

    current_user.password_hash = hash_password(body.new_password)
    await db.commit()


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def deactivate_account(
    current_user: CurrentUser,
    db: DbSession
):
    """
    Soft-delete: marks the account inactive.
    """
    current_user.is_active = False
    await db.commit()