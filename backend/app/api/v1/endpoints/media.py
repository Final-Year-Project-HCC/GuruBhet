"""Media endpoints for file uploads using S3/MinIO."""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.dependencies import get_current_user, get_db
from app.schemas.communication import UploadSignatureResponse
from app.models.user import User
from app.utils.s3 import s3_manager

router = APIRouter(prefix="/media", tags=["media"])


@router.post(
    "/upload-signature",
    response_model=UploadSignatureResponse,
    summary="Get S3 upload signature",
    description="Get a pre-signed URL for client-side file uploads to S3",
)
async def get_upload_signature(
    file_name: str = Query(..., min_length=1, max_length=255),
    file_type: str = Query(..., min_length=1, max_length=100),
    bucket: str = Query("documents", pattern="^(documents|recordings)$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UploadSignatureResponse:
    """
    Get a pre-signed S3 upload URL for file uploads.

    This endpoint returns a pre-signed URL that allows the frontend to upload files
    directly to S3/MinIO without exposing AWS credentials.

    Query Parameters:
        - file_name: Name of the file to upload
        - file_type: MIME type of the file (e.g., 'image/jpeg', 'application/pdf')
        - bucket: Target bucket ('documents' or 'recordings')

    Returns:
        UploadSignatureResponse with pre-signed upload URL and file key

    Raises:
        HTTPException: If S3 is not configured or URL generation fails
    """
    if not settings.S3_ENDPOINT_URL or not settings.S3_ACCESS_KEY or not settings.S3_SECRET_KEY:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="S3/MinIO is not configured",
        )

    try:
        result = s3_manager.generate_upload_url(
            user_id=current_user.id,
            file_name=file_name,
            file_type=file_type,
            bucket=bucket,
            expiration_seconds=3600,  # 1 hour
        )

        return UploadSignatureResponse(
            upload_url=result["upload_url"],
            file_key=result["file_key"],
            bucket_name=result["bucket_name"],
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate upload URL: {str(e)}",
        )


@router.get(
    "/download-signature/{file_key:path}",
    response_model=dict,
    summary="Get S3 download signature",
    description="Get a pre-signed URL for downloading a file from S3",
)
async def get_download_signature(
    file_key: str,
    bucket: str = Query("documents", pattern="^(documents|recordings)$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Get a pre-signed S3 download URL for file access.

    This endpoint returns a pre-signed URL that allows accessing files from S3/MinIO
    without exposing AWS credentials.

    Path Parameters:
        - file_key: S3 object key (path to file)

    Query Parameters:
        - bucket: Source bucket ('documents' or 'recordings')

    Returns:
        Dictionary with download_url

    Raises:
        HTTPException: If S3 is not configured or URL generation fails
    """
    if not settings.S3_ENDPOINT_URL or not settings.S3_ACCESS_KEY or not settings.S3_SECRET_KEY:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="S3/MinIO is not configured",
        )

    try:
        download_url = s3_manager.generate_download_url(
            file_key=file_key,
            bucket=bucket,
            expiration_seconds=86400,  # 24 hours
        )

        return {"download_url": download_url}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate download URL: {str(e)}",
        )


@router.delete(
    "/files/{file_key:path}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete file from S3",
    description="Delete a file from S3/MinIO storage",
)
async def delete_file(
    file_key: str,
    bucket: str = Query("documents", pattern="^(documents|recordings)$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """
    Delete a file from S3/MinIO.

    This endpoint deletes a file from S3. The file_key must be in the user's directory
    or the deletion will fail (authorization is based on the user owning the file path).

    Path Parameters:
        - file_key: S3 object key (path to file)

    Query Parameters:
        - bucket: Target bucket ('documents' or 'recordings')

    Raises:
        HTTPException: If S3 is not configured or deletion fails
    """
    if not settings.S3_ENDPOINT_URL or not settings.S3_ACCESS_KEY or not settings.S3_SECRET_KEY:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="S3/MinIO is not configured",
        )

    # Simple authorization check: file_key should contain user_id
    user_prefix = f"user_{current_user.id}/"
    if not file_key.startswith(user_prefix):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to delete this file",
        )

    try:
        success = s3_manager.delete_file(file_key=file_key, bucket=bucket)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to delete file from S3",
            )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete file: {str(e)}",
        )


@router.get(
    "/file-info/{file_key:path}",
    response_model=dict,
    summary="Get file metadata",
    description="Get metadata about a file in S3",
)
async def get_file_info(
    file_key: str,
    bucket: str = Query("documents", pattern="^(documents|recordings)$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Get metadata about a file in S3.

    Returns information like file size, content type, and last modified time.

    Path Parameters:
        - file_key: S3 object key (path to file)

    Query Parameters:
        - bucket: Source bucket ('documents' or 'recordings')

    Returns:
        Dictionary with file metadata

    Raises:
        HTTPException: If file not found or S3 is not configured
    """
    if not settings.S3_ENDPOINT_URL or not settings.S3_ACCESS_KEY or not settings.S3_SECRET_KEY:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="S3/MinIO is not configured",
        )

    try:
        file_info = s3_manager.get_file_info(file_key=file_key, bucket=bucket)
        if not file_info:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="File not found",
            )
        return file_info
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get file info: {str(e)}",
        )
