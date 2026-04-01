# Cloudinary Integration Implementation Guide

This file outlines exactly what needs to be implemented once Cloudinary credentials are available.

## Installation

First, add the Cloudinary Python package:

```bash
poetry add cloudinary
```

## File: `app/utils/cloudinary.py`

### 1. Implement `_init_cloudinary()` method

```python
def _init_cloudinary(self) -> None:
    """Initialize the Cloudinary SDK with credentials."""
    import cloudinary

    cloudinary.config(
        cloud_name=self.cloud_name,
        api_key=self.api_key,
        api_secret=self.api_secret,
    )
    self._cloudinary_initialized = True
    logger.info(f"Cloudinary initialized with cloud: {self.cloud_name}")
```

### 2. Implement `generate_upload_url()` method

Replace the TODO section with:

```python
import time
import hashlib
import hmac
import base64

def generate_upload_url(self, ...) -> dict:
    # ... docstring and validation ...

    timestamp = int(time.time())

    # Build upload parameters
    params = {
        "timestamp": timestamp,
        "folder": folder,
        "public_id": public_id,
        "resource_type": resource_type,
    }

    # Generate signature
    def generate_signature(params: dict, api_secret: str) -> str:
        """Generate Cloudinary upload signature."""
        sorted_params = sorted(params.items())
        query_string = "&".join([f"{k}={v}" for k, v in sorted_params])
        hash_object = hmac.new(
            api_secret.encode(),
            query_string.encode(),
            hashlib.sha256
        )
        return base64.b64encode(hash_object.digest()).decode()

    signature = generate_signature(params, self.api_secret)

    logger.info(
        f"Generated upload token for user {user_id}: {public_id} "
        f"(expires in {expiration_seconds}s)"
    )

    return {
        "upload_url": f"https://api.cloudinary.com/v1_1/{self.cloud_name}/auto/upload",
        "cloud_name": self.cloud_name,
        "api_key": self.api_key,
        "public_id": public_id,
        "folder": folder,
        "resource_type": resource_type,
        "timestamp": timestamp,
        "signature": signature,
        "expires_at": timestamp + expiration_seconds,
    }
```

### 3. Implement `generate_download_url()` method

Replace the TODO section with:

```python
import cloudinary
from datetime import datetime, timedelta
import base64
import hashlib
import hmac

def generate_download_url(self, ...) -> str:
    # ... docstring and validation ...

    # Calculate expiration timestamp
    expires_at = int((datetime.utcnow() + timedelta(seconds=expiration_seconds)).timestamp())

    # Generate auth token
    auth_string = f"public_id={public_id}&token={expiration_seconds}"
    auth_hash = hmac.new(
        self.api_secret.encode(),
        auth_string.encode(),
        hashlib.sha256
    ).digest()
    auth_token = base64.b64encode(auth_hash).decode()

    # Build URL with transformations
    url = cloudinary.CloudinaryResource(public_id).build_url(
        resource_type=resource_type,
        format=format,
        quality=quality,
        sign_url=True,
        type="token",
        expires_at=expires_at,
    )

    logger.info(
        f"Generated download URL for {public_id} "
        f"(expires at {datetime.utcfromtimestamp(expires_at).isoformat()})"
    )

    return url
```

### 4. Implement `delete_file()` method

Replace the TODO section with:

```python
import cloudinary
import cloudinary.api

def delete_file(self, public_id: str, resource_type: str = "auto") -> bool:
    # ... docstring and validation ...

    try:
        result = cloudinary.api.delete_resources(
            [public_id],
            resource_type=resource_type,
        )

        if result.get("deleted", {}).get(public_id) == "deleted":
            logger.info(f"Successfully deleted: {public_id}")
            return True
        else:
            logger.warning(f"Failed to delete {public_id}: {result}")
            return False

    except cloudinary.exceptions.NotFound:
        # File doesn't exist - consider this a success
        logger.warning(f"File not found during deletion (already deleted?): {public_id}")
        return True
    except cloudinary.exceptions.Error as e:
        logger.error(f"Cloudinary error deleting {public_id}: {e}")
        return False
    except Exception as e:
        logger.error(f"Unexpected error deleting {public_id}: {e}")
        return False
```

### 5. Implement `get_file_url()` method

Replace the TODO section with:

```python
import cloudinary

def get_file_url(self, public_id: str, ..., transformation: dict | None = None) -> str:
    # ... docstring and validation ...

    # Build URL parameters
    params = {
        "resource_type": resource_type,
        "quality": quality,
        "format": format,
        "fetch_format": "auto",  # Auto-format for optimal delivery
    }

    # Add custom transformations if provided
    if transformation:
        params.update(transformation)

    # Build the URL
    url = cloudinary.CloudinaryResource(public_id).build_url(**params)

    return url
```

### 6. Implement `get_resource_info()` method

Replace the TODO section with:

```python
import cloudinary
import cloudinary.api

def get_resource_info(self, public_id: str) -> dict | None:
    # ... docstring and validation ...

    try:
        resource = cloudinary.api.resource(public_id)
        return {
            "public_id": resource.get("public_id"),
            "format": resource.get("format"),
            "bytes": resource.get("bytes"),
            "width": resource.get("width"),
            "height": resource.get("height"),
            "created_at": resource.get("created_at"),
            "url": resource.get("url"),
            "secure_url": resource.get("secure_url"),
            "type": resource.get("type"),
        }
    except cloudinary.exceptions.NotFound:
        logger.warning(f"Resource not found: {public_id}")
        return None
    except cloudinary.exceptions.Error as e:
        logger.error(f"Cloudinary error retrieving resource {public_id}: {e}")
        return None
    except Exception as e:
        logger.error(f"Unexpected error retrieving resource {public_id}: {e}")
        return None
```

## Database Migration

Update the `Message` model if needed (optional - `file_key` can still store public ID):

```python
# In app/models/communication.py
from sqlalchemy import Text

class Message(Base):
    # ... existing fields ...
    file_url: str | None = Column(Text, nullable=True)
    # NEW: Store Cloudinary public ID instead of S3 key
    file_public_id: str | None = Column(Text, nullable=True)
```

Create Alembic migration:

```bash
alembic revision --autogenerate -m "Add file_public_id to Message for Cloudinary"
```

## Endpoint Updates

Once implementation is complete, update endpoints using storage:

### Example: File Upload Endpoint

```python
# Before (S3)
from app.utils.s3 import S3Manager

@router.post("/upload-document")
async def upload_document(user: User = Depends(get_current_user)):
    s3 = S3Manager()
    upload_info = s3.generate_upload_url(
        user_id=user.id,
        file_name="document.pdf",
        file_type="application/pdf",
        bucket="documents"
    )
    return upload_info

# After (Unified)
from app.utils import get_storage_adapter

@router.post("/upload-document")
async def upload_document(user: User = Depends(get_current_user)):
    storage = get_storage_adapter()
    upload_info = storage.generate_upload_url(
        user_id=user.id,
        file_name="document.pdf",
        file_type="application/pdf",
        bucket="documents"
    )
    return upload_info
```

## Testing

Create comprehensive tests in `tests/unit/test_cloudinary.py`:

```python
import pytest
from uuid import uuid4
from app.utils.cloudinary import CloudinaryManager

class TestCloudinaryManager:
    """Test Cloudinary manager with mocked SDK."""

    @pytest.fixture
    def manager(self):
        return CloudinaryManager()

    def test_generate_upload_url(self, manager):
        """Test upload URL generation."""
        result = manager.generate_upload_url(
            user_id=uuid4(),
            file_name="test.pdf",
            file_type="application/pdf"
        )

        assert "upload_url" in result
        assert "signature" in result
        assert "timestamp" in result
        assert result["cloud_name"] == settings.CLOUDINARY_CLOUD_NAME

    def test_generate_download_url(self, manager):
        """Test download URL generation."""
        public_id = "users/test/documents/file"
        url = manager.generate_download_url(public_id)

        assert settings.CLOUDINARY_CLOUD_NAME in url
        assert public_id.split("/")[-1] in url

    # ... more tests ...
```

## Integration Testing

After implementation, test with real Cloudinary:

```python
@pytest.mark.integration
@pytest.mark.cloudinary
async def test_real_cloudinary_upload():
    """Test actual Cloudinary upload."""
    storage = get_storage_adapter()

    # Generate upload credentials
    upload_info = storage.generate_upload_url(
        user_id=uuid4(),
        file_name="test_doc.pdf",
        file_type="application/pdf"
    )

    # Verify response structure
    assert "upload_url" in upload_info
    assert "signature" in upload_info

    # Note: Actual file upload would be done client-side in UI tests
```

## Environment Setup

Update `.env` for testing:

```bash
# .env or .env.test
CLOUDINARY_CLOUD_NAME=your_test_cloud_name
CLOUDINARY_API_KEY=your_test_api_key
CLOUDINARY_API_SECRET=your_test_api_secret
```

## Verification Checklist

After implementation:

- [ ] Cloudinary SDK installed and imported correctly
- [ ] All TODO methods implemented
- [ ] Unit tests pass (mocked Cloudinary)
- [ ] Integration tests pass (real Cloudinary)
- [ ] Upload generation works
- [ ] Download URL generation works
- [ ] File deletion works
- [ ] Metadata retrieval works
- [ ] Error handling for missing credentials works
- [ ] Provider auto-detection works
- [ ] Endpoints updated to use StorageAdapter
- [ ] Database migrations run successfully
- [ ] Staging deployment successful
- [ ] Monitor error logs in production

## Common Issues & Solutions

### Issue: `RuntimeError: Cloudinary is not initialized`

**Cause:** Credentials not configured or \_init_cloudinary() not called

**Solution:**

1. Check `.env` for CLOUDINARY_CLOUD_NAME, API_KEY, API_SECRET
2. Ensure values are not empty strings
3. Restart the application after updating .env

### Issue: Upload signature doesn't match

**Cause:** Signature generation algorithm mismatch

**Solution:**

1. Verify timestamp is current (not stale)
2. Check parameter ordering (must be alphabetical)
3. Verify api_secret is correct

### Issue: Files not found after upload

**Cause:** Public ID mismatch between upload and retrieval

**Solution:**

1. Store the public ID returned by upload
2. Use exact same public ID for retrieval/deletion
3. Cloudinary may modify public ID (check response)

## Performance Considerations

- **URL Generation:** Cloudinary URLs are cached by CDN; regeneration is safe
- **Signature Expiration:** Set appropriately for your use case
- **Resource Metadata:** Cache results for 1-5 minutes to reduce API calls
- **Batch Operations:** Use `cloudinary.api.delete_resources([...])` for multiple files

## Security Considerations

- **Signed URLs:** Always use signed URLs for sensitive content
- **Token Expiration:** Set reasonable expiration times (avoid very long timeouts)
- **API Keys:** Never expose API_SECRET in browser; only use in backend
- **Upload Restrictions:** Use allowed_formats, max_bytes params in upload attrs
