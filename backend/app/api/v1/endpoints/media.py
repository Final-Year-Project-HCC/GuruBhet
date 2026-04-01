"""Media endpoints for file uploads using Cloudinary."""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.dependencies import get_current_user, get_db
from app.schemas.communication import UploadSignatureResponse
from app.models.user import User
from app.utils.cloudinary import get_cloudinary_manager

router = APIRouter(prefix="/media", tags=["media"])


@router.post(
    "/upload-signature",
    response_model=UploadSignatureResponse,
    summary="Get Cloudinary upload signature",
    description="Get upload credentials for client-side file uploads to Cloudinary",
)
async def get_upload_signature(
    file_name: str = Query(..., min_length=1, max_length=255),
    file_type: str = Query(..., min_length=1, max_length=100),
    bucket: str = Query("documents", pattern="^(documents|recordings)$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UploadSignatureResponse:
    """
    Get Cloudinary upload credentials for file uploads.

    This endpoint returns upload credentials that allow the frontend to upload files
    directly to Cloudinary without exposing API secrets.

    Query Parameters:
        - file_name: Name of the file to upload
        - file_type: MIME type of the file (e.g., 'image/jpeg', 'application/pdf')
        - bucket: Target folder ('documents' or 'recordings')

    Returns:
        UploadSignatureResponse with upload URL, signature, and cloud config

    Raises:
        HTTPException: If Cloudinary is not configured or URL generation fails
    """
    if not settings.CLOUDINARY_CLOUD_NAME or not settings.CLOUDINARY_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Cloudinary is not configured. Please set CLOUDINARY_CLOUD_NAME and CLOUDINARY_API_KEY.",
        )

    try:
        cloudinary_manager = get_cloudinary_manager()
        result = cloudinary_manager.generate_upload_url(
            user_id=current_user.id,
            file_name=file_name,
            file_type=file_type,
            folder=bucket,
            expiration_seconds=3600,  # 1 hour
        )

        return UploadSignatureResponse(
            upload_url=result["upload_url"],
            file_key=result["public_id"],
            bucket_name=result["cloud_name"],
        )
    except RuntimeError as e:
        # Cloudinary SDK not initialized
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate upload URL: {str(e)}",
        )


@router.get(
    "/download-signature/{file_id:path}",
    response_model=dict,
    summary="Get Cloudinary download signature",
    description="Get a signed URL for downloading a file from Cloudinary",
)
async def get_download_signature(
    file_id: str,
    bucket: str = Query("documents", pattern="^(documents|recordings)$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Get a signed Cloudinary download URL for file access.

    This endpoint returns a signed URL that allows accessing files from Cloudinary
    with time-limited access.

    Path Parameters:
        - file_id: Cloudinary public ID (path to file)

    Query Parameters:
        - bucket: Source folder ('documents' or 'recordings')

    Returns:
        Dictionary with download_url

    Raises:
        HTTPException: If Cloudinary is not configured or URL generation fails
    """
    if not settings.CLOUDINARY_CLOUD_NAME or not settings.CLOUDINARY_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Cloudinary is not configured",
        )

    try:
        cloudinary_manager = get_cloudinary_manager()
        download_url = cloudinary_manager.generate_download_url(
            public_id=file_id,
            expiration_seconds=86400,  # 24 hours
        )

        return {"download_url": download_url}
    except RuntimeError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate download URL: {str(e)}",
        )


@router.delete(
    "/files/{file_id:path}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete file from Cloudinary",
    description="Delete a file from Cloudinary storage",
)
async def delete_file(
    file_id: str,
    bucket: str = Query("documents", pattern="^(documents|recordings)$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """
    Delete a file from Cloudinary.

    This endpoint deletes a file from Cloudinary. The file_id must be in the user's directory
    or the deletion will fail (authorization is based on the user owning the file path).

    Path Parameters:
        - file_id: Cloudinary public ID (path to file)

    Query Parameters:
        - bucket: Target folder ('documents' or 'recordings')

    Raises:
        HTTPException: If Cloudinary is not configured or deletion fails
    """
    if not settings.CLOUDINARY_CLOUD_NAME or not settings.CLOUDINARY_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Cloudinary is not configured",
        )

    # Simple authorization check: file_id should contain user_id
    user_prefix = f"users/{current_user.id}/"
    if not file_id.startswith(user_prefix):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to delete this file",
        )

    try:
        cloudinary_manager = get_cloudinary_manager()
        success = cloudinary_manager.delete_file(public_id=file_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to delete file from Cloudinary",
            )
    except RuntimeError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete file: {str(e)}",
        )


@router.get(
    "/file-info/{file_id:path}",
    response_model=dict,
    summary="Get file metadata",
    description="Get metadata about a file in Cloudinary",
)
async def get_file_info(
    file_id: str,
    bucket: str = Query("documents", pattern="^(documents|recordings)$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Get metadata about a file in Cloudinary.

    Returns information like file size, dimensions, format, and upload time.

    Path Parameters:
        - file_id: Cloudinary public ID (path to file)

    Query Parameters:
        - bucket: Source folder ('documents' or 'recordings')

    Returns:
        Dictionary with file metadata

    Raises:
        HTTPException: If file not found or Cloudinary is not configured
    """
    if not settings.CLOUDINARY_CLOUD_NAME or not settings.CLOUDINARY_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Cloudinary is not configured",
        )

    try:
        cloudinary_manager = get_cloudinary_manager()
        file_info = cloudinary_manager.get_resource_info(public_id=file_id)
        if not file_info:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="File not found",
            )
        return file_info
    except RuntimeError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get file info: {str(e)}",
        )
