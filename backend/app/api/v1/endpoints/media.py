"""Media endpoints for file uploads."""
import hashlib
import time
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.dependencies import get_current_user, get_db
from app.schemas.communication import UploadSignatureResponse
from app.models.user import User

router = APIRouter(prefix="/media", tags=["media"])


def generate_cloudinary_signature(params: dict, cloud_secret: str) -> str:
    """Generate Cloudinary authentication signature.
    
    Args:
        params: Parameters to sign
        cloud_secret: Cloudinary API secret
    
    Returns:
        Signature string
    """
    # Sort parameters and create auth string
    param_list = []
    for key in sorted(params.keys()):
        param_list.append(f"{key}={params[key]}")
    
    auth_string = "&".join(param_list) + cloud_secret
    
    # Generate SHA-1 hash
    return hashlib.sha1(auth_string.encode()).hexdigest()


@router.get(
    "/upload-signature",
    response_model=UploadSignatureResponse,
    summary="Get Cloudinary upload signature",
    description="Get a signed upload signature for client-side file uploads to Cloudinary",
)
async def get_upload_signature(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UploadSignatureResponse:
    """
    Get a signed upload signature for Cloudinary.
    
    This endpoint returns all parameters needed for the frontend to upload files
    directly to Cloudinary without exposing the API secret.
    
    Returns:
        UploadSignatureResponse with signature and all required parameters
    
    Raises:
        HTTPException: If Cloudinary is not configured
    """
    if not settings.CLOUDINARY_API_KEY or not settings.CLOUDINARY_API_SECRET:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Cloudinary is not configured",
        )
    
    # Current timestamp
    timestamp = int(time.time())
    
    # Parameters to sign
    params = {
        "timestamp": timestamp,
        "cloud_name": settings.CLOUDINARY_CLOUD_NAME,
        "api_key": settings.CLOUDINARY_API_KEY,
        # Optional: restrict to specific folder and file types
        "folder": f"gurubhet/user_{current_user.id}",
        "resource_type": "auto",
        "allowed_formats": "jpg,jpeg,png,gif,pdf,doc,docx",
        "max_file_size": 10485760,  # 10MB
        "eager": "q_auto,f_auto",  # Auto-optimize uploaded files
    }
    
    # Generate signature
    signature = generate_cloudinary_signature(params, settings.CLOUDINARY_API_SECRET)
    
    return UploadSignatureResponse(
        signature=signature,
        timestamp=timestamp,
        cloud_name=settings.CLOUDINARY_CLOUD_NAME,
        api_key=settings.CLOUDINARY_API_KEY,
        upload_preset=getattr(settings, "CLOUDINARY_UPLOAD_PRESET", None),
    )


@router.post(
    "/confirm-upload",
    status_code=status.HTTP_200_OK,
    summary="Confirm file upload completion",
    description="Notify backend that a file has been uploaded to Cloudinary",
)
async def confirm_upload(
    file_url: str,
    public_id: str,
    file_name: str,
    receiver_id: Optional[str] = None,
    message_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Confirm a file upload and potentially attach it to a message.
    
    This endpoint is called by the frontend after a successful Cloudinary upload
    to store file metadata and potentially update an associated message.
    
    Args:
        file_url: URL of the uploaded file from Cloudinary
        public_id: Cloudinary public_id for the file (needed for deletion)
        file_name: Original filename
        receiver_id: Optional UUID of message recipient (if creating new message)
        message_id: Optional UUID of message to attach file to (if updating existing)
        current_user: Current authenticated user
        db: Database session
    
    Returns:
        Confirmation response with file metadata
    """
    # In a full implementation, you might:
    # 1. Create a FileMetadata record
    # 2. Update a Message record if message_id is provided
    # 3. Send Socket.IO event to recipient if receiver_id is provided
    
    return {
        "status": "success",
        "file_url": file_url,
        "public_id": public_id,
        "file_name": file_name,
    }
