"""S3/MinIO utility functions for file uploads and management."""
import logging
from datetime import timedelta
from uuid import UUID
from urllib.parse import urlparse

import boto3
from botocore.client import Config
from botocore.exceptions import ClientError

from app.core.config import settings

logger = logging.getLogger(__name__)


class S3Manager:
    """Manager for S3/MinIO file operations."""

    def __init__(self):
        """Initialize S3 client with LocalStack/MinIO configuration."""
        self.client = boto3.client(
            "s3",
            endpoint_url=settings.S3_ENDPOINT_URL,
            aws_access_key_id=settings.S3_ACCESS_KEY,
            aws_secret_access_key=settings.S3_SECRET_KEY,
            region_name=settings.AWS_REGION,
            config=Config(signature_version="s3v4"),
        )
        self.bucket_documents = settings.S3_BUCKET_DOCUMENTS
        self.bucket_recordings = settings.S3_BUCKET_RECORDINGS

    def generate_upload_url(
        self,
        user_id: UUID,
        file_name: str,
        file_type: str,
        bucket: str = "documents",
        expiration_seconds: int = 3600,
    ) -> dict:
        """
        Generate a pre-signed URL for client-side file uploads.

        Args:
            user_id: UUID of the user uploading the file
            file_name: Original filename
            file_type: MIME type (e.g., 'image/jpeg')
            bucket: Bucket type ('documents' or 'recordings')
            expiration_seconds: URL expiration time in seconds (default: 1 hour)

        Returns:
            Dictionary with upload_url, file_key, and bucket_name

        Raises:
            ValueError: If bucket type is invalid
        """
        if bucket == "documents":
            bucket_name = self.bucket_documents
        elif bucket == "recordings":
            bucket_name = self.bucket_recordings
        else:
            raise ValueError(f"Invalid bucket type: {bucket}")

        # Generate S3 object key
        file_key = f"user_{user_id}/{bucket}/{file_name}"

        try:
            # Generate pre-signed PUT URL for upload
            upload_url = self.client.generate_presigned_url(
                "put_object",
                Params={
                    "Bucket": bucket_name,
                    "Key": file_key,
                    "ContentType": file_type,
                },
                ExpiresIn=expiration_seconds,
            )

            logger.info(
                f"Generated upload URL for user {user_id}: {file_key} "
                f"(expires in {expiration_seconds}s)"
            )

            return {
                "upload_url": upload_url,
                "file_key": file_key,
                "bucket_name": bucket_name,
            }
        except ClientError as e:
            logger.error(f"Failed to generate upload URL: {e}")
            raise

    def generate_download_url(
        self,
        file_key: str,
        bucket: str = "documents",
        expiration_seconds: int = 86400,  # 24 hours
    ) -> str:
        """
        Generate a pre-signed URL for downloading a file.

        Args:
            file_key: S3 object key
            bucket: Bucket type ('documents' or 'recordings')
            expiration_seconds: URL expiration time in seconds

        Returns:
            Pre-signed download URL

        Raises:
            ValueError: If bucket type is invalid
        """
        if bucket == "documents":
            bucket_name = self.bucket_documents
        elif bucket == "recordings":
            bucket_name = self.bucket_recordings
        else:
            raise ValueError(f"Invalid bucket type: {bucket}")

        try:
            download_url = self.client.generate_presigned_url(
                "get_object",
                Params={"Bucket": bucket_name, "Key": file_key},
                ExpiresIn=expiration_seconds,
            )

            logger.info(f"Generated download URL for {file_key} (expires in {expiration_seconds}s)")
            return download_url
        except ClientError as e:
            logger.error(f"Failed to generate download URL: {e}")
            raise

    def delete_file(self, file_key: str, bucket: str = "documents") -> bool:
        """
        Delete a file from S3.

        Args:
            file_key: S3 object key
            bucket: Bucket type ('documents' or 'recordings')

        Returns:
            True if deletion was successful, False otherwise

        Raises:
            ValueError: If bucket type is invalid
        """
        if bucket == "documents":
            bucket_name = self.bucket_documents
        elif bucket == "recordings":
            bucket_name = self.bucket_recordings
        else:
            raise ValueError(f"Invalid bucket type: {bucket}")

        try:
            self.client.delete_object(Bucket=bucket_name, Key=file_key)
            logger.info(f"Deleted file from S3: {file_key}")
            return True
        except ClientError as e:
            logger.error(f"Failed to delete file {file_key}: {e}")
            return False

    def get_file_url(self, file_key: str, bucket: str = "documents") -> str:
        """
        Get a public URL for a file (if bucket is public).

        Note: This returns the URL format but assumes the file is publicly accessible.
        For secure access, use generate_download_url() instead.

        Args:
            file_key: S3 object key
            bucket: Bucket type ('documents' or 'recordings')

        Returns:
            Public file URL

        Raises:
            ValueError: If bucket type is invalid
        """
        if bucket == "documents":
            bucket_name = self.bucket_documents
        elif bucket == "recordings":
            bucket_name = self.bucket_recordings
        else:
            raise ValueError(f"Invalid bucket type: {bucket}")

        # Construct the URL based on endpoint
        endpoint_url = settings.S3_ENDPOINT_URL
        parsed_url = urlparse(endpoint_url)

        # Handle LocalStack/MinIO endpoint
        if endpoint_url.startswith("http://") or endpoint_url.startswith("https://"):
            # Remove protocol and construct S3 URL
            file_url = f"{endpoint_url}/{bucket_name}/{file_key}"
        else:
            file_url = f"s3://{bucket_name}/{file_key}"

        return file_url

    def create_buckets(self) -> None:
        """
        Create S3 buckets if they don't exist.

        Useful for LocalStack/MinIO setup where buckets need to be created manually.
        """
        for bucket_name in [self.bucket_documents, self.bucket_recordings]:
            try:
                self.client.head_bucket(Bucket=bucket_name)
                logger.info(f"Bucket '{bucket_name}' already exists")
            except ClientError as e:
                error_code = e.response["Error"]["Code"]
                if error_code == "404":
                    # Bucket doesn't exist, create it
                    try:
                        self.client.create_bucket(Bucket=bucket_name)
                        logger.info(f"Created bucket: {bucket_name}")
                    except ClientError as create_error:
                        logger.error(f"Failed to create bucket {bucket_name}: {create_error}")
                else:
                    logger.error(f"Error checking bucket {bucket_name}: {e}")

    def get_file_info(self, file_key: str, bucket: str = "documents") -> dict | None:
        """
        Get metadata about a file in S3.

        Args:
            file_key: S3 object key
            bucket: Bucket type ('documents' or 'recordings')

        Returns:
            Dictionary with file metadata (size, modified_at, etc.) or None if not found

        Raises:
            ValueError: If bucket type is invalid
        """
        if bucket == "documents":
            bucket_name = self.bucket_documents
        elif bucket == "recordings":
            bucket_name = self.bucket_recordings
        else:
            raise ValueError(f"Invalid bucket type: {bucket}")

        try:
            response = self.client.head_object(Bucket=bucket_name, Key=file_key)
            return {
                "file_key": file_key,
                "file_size": response.get("ContentLength"),
                "content_type": response.get("ContentType"),
                "last_modified": response.get("LastModified"),
                "etag": response.get("ETag"),
            }
        except ClientError as e:
            if e.response["Error"]["Code"] == "404":
                logger.warning(f"File not found: {file_key}")
                return None
            else:
                logger.error(f"Error retrieving file info: {e}")
                return None


# Global instance
s3_manager = S3Manager()
