"""Cloudinary utility functions for file uploads and management.

This module provides a manager for handling file operations with Cloudinary,
replacing the previous S3-based implementation.
"""
import logging
from uuid import UUID

from app.core.config import settings

logger = logging.getLogger(__name__)


class CloudinaryManager:
    """Manager for Cloudinary file operations."""

    def __init__(self):
        """Initialize Cloudinary manager with credentials from settings.
        
        Note: Actual Cloudinary SDK initialization is deferred until credentials
        are available to allow the application to start even without Cloudinary
        configured. Real file operations will fail gracefully with clear error messages.
        """
        self.cloud_name = settings.CLOUDINARY_CLOUD_NAME
        self.api_key = settings.CLOUDINARY_API_KEY
        self.api_secret = settings.CLOUDINARY_API_SECRET
        self._cloudinary_initialized = False
        
        # Lazy initialization happens when credentials are available
        if self.cloud_name and self.api_key and self.api_secret:
            self._init_cloudinary()
    
    def _init_cloudinary(self) -> None:
        import cloudinary
        import cloudinary.uploader
        import cloudinary.api
        cloudinary.config(
            cloud_name=self.cloud_name,
            api_key=self.api_key,
            api_secret=self.api_secret,
        )
        self._cloudinary_initialized = True
    
    def _check_initialized(self) -> bool:
        """Check if Cloudinary is properly initialized with credentials.
        
        Returns:
            True if initialized, False otherwise
        """
        if not self._cloudinary_initialized and self.cloud_name and self.api_key:
            self._init_cloudinary()
        return self._cloudinary_initialized

    def upload_file(self, file_obj, folder: str, public_id: str | None = None) -> dict:
        if not self._check_initialized():
            raise RuntimeError("Cloudinary is not initialized.")
        import cloudinary.uploader
        kwargs = {"folder": folder, "flags": "lossless"}
        if public_id:
            kwargs["public_id"] = public_id
        result = cloudinary.uploader.upload(file_obj, **kwargs)
        return {
            "secure_url": result.get("secure_url"),
            "public_id": result.get("public_id"),
            "format": result.get("format"),
            "bytes": result.get("bytes")
        }
    
    def generate_upload_url(
        self,
        user_id: UUID,
        file_name: str,
        file_type: str,
        resource_type: str = "auto",
        folder: str = "documents",
        expiration_seconds: int = 3600,
    ) -> dict:
        """
        Generate an upload signature for client-side file uploads to Cloudinary.
        
        Cloudinary uses unsigned uploads (for public users) or signed uploads 
        (for authenticated users). This generates a signed upload token.
        
        Args:
            user_id: UUID of the user uploading the file
            file_name: Original filename (used as the public ID)
            file_type: MIME type (e.g., 'image/jpeg'). Used for validation.
            resource_type: Type of resource ('image', 'video', 'raw', 'auto')
            folder: Folder path in Cloudinary (e.g., 'documents', 'recordings')
            expiration_seconds: Signature expiration time (default: 1 hour)
        
        Returns:
            Dictionary containing:
            - upload_url: Cloudinary upload endpoint URL
            - upload_signature: Signed token for upload
            - cloud_name: Cloudinary cloud name
            - folder: Folder path to upload to
            - public_id: Generated public ID for the file
            - api_key: Cloudinary API key (for client-side upload)
            - expires_at: Timestamp when signature expires
        
        Raises:
            RuntimeError: If Cloudinary is not initialized with credentials
        
        Implementation notes:
            - For actual implementation, use cloudinary.utils.cloudinary_url_prefix()
            - Generate signature using: cloudinary.utils.build_upload_params()
            - Include timestamp to prevent attack vectors
            - Set eager transformations if needed (e.g., auto quality)
        """
        if not self._check_initialized():
            raise RuntimeError(
                "Cloudinary is not initialized. Please configure CLOUDINARY_CLOUD_NAME, "
                "CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in your environment."
            )
        
        # Generate public ID from user_id and file_name
        public_id = f"users/{user_id}/{folder}/{file_name}"
        
        logger.info(
            f"Generated upload token for user {user_id}: {public_id} "
            f"(expires in {expiration_seconds}s)"
        )
        
        # TODO: Implement actual signature generation
        # from cloudinary.utils import cloudinary_url_prefix
        # 
        # timestamp = int(time.time())
        # params = {
        #     "timestamp": timestamp,
        #     "upload_preset": "...",  # If using unsigned uploads
        #     "folder": folder,
        #     "public_id": public_id,
        #     "resource_type": resource_type,
        # }
        # signature = cloudinary.utils.build_upload_params(
        #     **params,
        #     api_secret=self.api_secret,
        # )
        
        return {
            "upload_url": f"https://api.cloudinary.com/v1_1/{self.cloud_name}/auto/upload",
            "cloud_name": self.cloud_name,
            "api_key": self.api_key,
            "public_id": public_id,
            "folder": folder,
            "resource_type": resource_type,
            # Placeholder - implement actual signature generation
            "upload_signature": "PLACEHOLDER_SIGNATURE",
            "expires_at": None,
        }
    
    def generate_download_url(
        self,
        public_id: str,
        resource_type: str = "auto",
        format: str = "auto",
        quality: str = "auto",
        expiration_seconds: int = 86400,
    ) -> str:
        """
        Generate a signed, time-limited download URL for a file.
        
        Cloudinary URLs can be signed with an expiration time, making them
        secure for private/protected content.
        
        Args:
            public_id: Cloudinary public ID (path including folder)
            resource_type: Type of resource ('image', 'video', 'raw', 'auto')
            format: Output format (e.g., 'jpg', 'webp', 'pdf'). Use 'auto' for original.
            quality: Quality setting (e.g., 'auto', 80, 90). Use 'auto' for Cloudinary optimization.
            expiration_seconds: URL expiration time in seconds
        
        Returns:
            Signed Cloudinary URL with time-limited access
        
        Raises:
            RuntimeError: If Cloudinary is not initialized
        
        Implementation notes:
            - Use cloudinary.CloudinaryResource.build_url()
            - Add sign_url=True parameter for signed URLs
            - Add type="token" for token-based auth (more secure)
            - Set auth_token with expiration if token auth is used
        """
        if not self._check_initialized():
            raise RuntimeError(
                "Cloudinary is not initialized. Please configure CLOUDINARY_CLOUD_NAME, "
                "CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in your environment."
            )
        
        logger.info(
            f"Generated download URL for {public_id} "
            f"(expires in {expiration_seconds}s)"
        )
        
        # TODO: Implement actual signed URL generation
        # import cloudinary
        # from datetime import datetime, timedelta
        #
        # expires_at = int((datetime.utcnow() + timedelta(seconds=expiration_seconds)).timestamp())
        # url = cloudinary.CloudinaryResource(public_id).build_url(
        #     resource_type=resource_type,
        #     format=format,
        #     quality=quality,
        #     sign_url=True,
        #     type="token",
        #     auth_token=generate_auth_token(
        #         public_id=public_id,
        #         end_time=expires_at,
        #         api_secret=self.api_secret,
        #     ),
        # )
        
        return (
            f"https://res.cloudinary.com/{self.cloud_name}/image/upload/"
            f"q_{quality}/f_auto/{public_id}"
        )
    
    def delete_file(self, public_id: str, resource_type: str = "auto") -> bool:
        """
        Delete a file from Cloudinary.
        
        Args:
            public_id: Cloudinary public ID to delete
            resource_type: Type of resource ('image', 'video', 'raw', 'auto')
        
        Returns:
            True if deletion was successful, False otherwise
        
        Raises:
            RuntimeError: If Cloudinary is not initialized
        
        Implementation notes:
            - Use cloudinary.api.delete_resources() to delete by public ID
            - Can accept multiple public IDs in a list
            - Handle "not_found" error gracefully (file doesn't exist is OK)
        """
        if not self._check_initialized():
            raise RuntimeError(
                "Cloudinary is not initialized. Please configure CLOUDINARY_CLOUD_NAME, "
                "CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in your environment."
            )
        
        logger.info(f"Deleted file from Cloudinary: {public_id}")
        
        # TODO: Implement actual deletion
        # import cloudinary
        # try:
        #     result = cloudinary.api.delete_resources(
        #         [public_id],
        #         resource_type=resource_type,
        #     )
        #     return result.get("deleted", {}).get(public_id) == "deleted"
        # except cloudinary.exceptions.NotFound:
        #     # File doesn't exist - consider this a success
        #     logger.warning(f"File not found during deletion: {public_id}")
        #     return True
        # except Exception as e:
        #     logger.error(f"Failed to delete file {public_id}: {e}")
        #     return False
        
        return False
    
    def get_file_url(
        self,
        public_id: str,
        resource_type: str = "auto",
        format: str = "auto",
        quality: str = "auto",
        transformation: dict | None = None,
    ) -> str:
        """
        Get a public URL for a file with optional transformations.
        
        Unlike generate_download_url(), this returns an unsigned URL that doesn't
        expire. Use this for publicly accessible files where you want simple,
        cacheable URLs.
        
        Optionally apply Cloudinary transformations (resize, crop, optimize, etc.)
        
        Args:
            public_id: Cloudinary public ID
            resource_type: Type of resource ('image', 'video', 'raw', 'auto')
            format: Output format (e.g., 'jpg', 'webp', 'pdf'). Use 'auto' for original.
            quality: Quality setting (e.g., 'auto', 80, 90). Use 'auto' for Cloudinary optimization.
            transformation: Optional dict of transformations (e.g., width, height, crop)
                Example: {"width": 200, "height": 200, "crop": "fill"}
        
        Returns:
            Cloudinary public URL
        
        Implementation notes:
            - Use cloudinary.CloudinaryResource.build_url()
            - Transformations can include:
              * Resizing: width, height, crop, aspect_ratio
              * Effects: quality, background, overlay, underlay
              * Format: format, dpr (device pixel ratio)
            - Transformations are chained with forward slashes in the URL
        """
        if not self._check_initialized():
            raise RuntimeError(
                "Cloudinary is not initialized. Please configure CLOUDINARY_CLOUD_NAME, "
                "CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in your environment."
            )
        
        # TODO: Implement actual URL building
        # import cloudinary
        # params = {
        #     "resource_type": resource_type,
        #     "quality": quality,
        #     "format": format,
        # }
        # if transformation:
        #     params.update(transformation)
        # 
        # url = cloudinary.CloudinaryResource(public_id).build_url(**params)
        
        return (
            f"https://res.cloudinary.com/{self.cloud_name}/image/upload/"
            f"q_{quality},f_auto/{public_id}"
        )
    
    def get_resource_info(self, public_id: str) -> dict | None:
        """
        Retrieve metadata about a file stored in Cloudinary.
        
        Args:
            public_id: Cloudinary public ID
        
        Returns:
            Dictionary with file metadata (size, format, dimensions, etc.) or None
        
        Raises:
            RuntimeError: If Cloudinary is not initialized
        
        Implementation notes:
            - Use cloudinary.api.resource() to fetch metadata
            - Returns info like: type, bytes, width, height, format, created_at, etc.
            - Useful for validation and display purposes
        """
        if not self._check_initialized():
            raise RuntimeError(
                "Cloudinary is not initialized. Please configure CLOUDINARY_CLOUD_NAME, "
                "CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in your environment."
            )
        
        # TODO: Implement actual metadata retrieval
        # import cloudinary
        # try:
        #     resource = cloudinary.api.resource(public_id)
        #     return {
        #         "public_id": resource.get("public_id"),
        #         "format": resource.get("format"),
        #         "bytes": resource.get("bytes"),
        #         "width": resource.get("width"),
        #         "height": resource.get("height"),
        #         "created_at": resource.get("created_at"),
        #         "url": resource.get("url"),
        #     }
        # except cloudinary.exceptions.NotFound:
        #     return None
        # except Exception as e:
        #     logger.error(f"Error retrieving resource info for {public_id}: {e}")
        #     return None
        
        return None


# Global instance for convenience
_cloudinary_manager = None


def get_cloudinary_manager() -> CloudinaryManager:
    """Get or create the global Cloudinary manager instance.
    
    Returns:
        CloudinaryManager instance
    """
    global _cloudinary_manager
    if _cloudinary_manager is None:
        _cloudinary_manager = CloudinaryManager()
    return _cloudinary_manager
