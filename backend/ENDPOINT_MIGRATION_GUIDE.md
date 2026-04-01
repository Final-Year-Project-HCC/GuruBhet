# Endpoint Migration Quick Reference

This guide shows how to update endpoints to use Cloudinary via the StorageAdapter.

## Quick Pattern

```python
from app.utils import get_storage_adapter

# Get the storage adapter (always uses Cloudinary)
storage = get_storage_adapter()

# All standard operations
upload_info = storage.generate_upload_url(...)
download_url = storage.generate_download_url(...)
success = storage.delete_file(...)
public_url = storage.get_file_url(...)
```

All endpoints should use this unified interface instead of directly accessing S3 or Cloudinary SDKs.

## Method Reference

### Upload URL Generation

```python
from app.utils import get_storage_adapter

storage = get_storage_adapter()
upload_info = storage.generate_upload_url(
    user_id=user.id,
    file_name="doc.pdf",
    file_type="application/pdf",
    bucket="documents",  # or "recordings"
    expiration_seconds=3600,
)

# Returns: {
#     "upload_url": "https://api.cloudinary.com/v1_1/.../upload",
#     "cloud_name": "...",
#     "api_key": "...",
#     "public_id": "users/.../documents/doc",
#     "signature": "...",
#     ...
# }
```

### Download URL Generation

```python
# file_id is the Cloudinary public ID
storage = get_storage_adapter()
download_url = storage.generate_download_url(
    file_id="users/123/documents/report",
    bucket="documents",
    expiration_seconds=86400,
)

# Returns: https://res.cloudinary.com/.../users/123/documents/report
```

### File Deletion

```python
storage = get_storage_adapter()
success = storage.delete_file(
    file_id="users/123/documents/report",
    bucket="documents"
)
```

### Get Public URL

```python
storage = get_storage_adapter()
url = storage.get_file_url(
    file_id="users/123/documents/report",
    bucket="documents"
)

# Can add Cloudinary transformations
url = storage.get_file_url(
    file_id="users/123/documents/report",
    transformation={"width": 300, "height": 300, "crop": "fill"}
)
```

## Real-World Examples

All endpoints should import and use the storage adapter:

```python
from app.utils import get_storage_adapter
from app.services.communication import CommunicationService
```

### Example 1: Send File Message

```python
@router.post("/messages/with-file")
async def send_file_message(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    file_public_id: str = Query(...),  # Cloudinary public ID
):
    storage = get_storage_adapter()
    file_url = storage.get_file_url(file_public_id, bucket="documents")

    message = await CommunicationService.save_and_send_message(
        db=db,
        sender_id=user.id,
        receiver_id=receiver_id,
        content="Check this file",
        message_type="FILE",
        file_url=file_url,
        file_key=file_public_id,  # Store Cloudinary public ID for future deletion
    )
    await db.commit()
    return {"message_id": message.id, "file_url": file_url}
```

### Example 2: Generate Upload Endpoint

```python
@router.post("/upload-credentials")
async def get_upload_credentials(
    user: User = Depends(get_current_user),
    file_name: str = Query(...),
    file_type: str = Query(...),
):
    storage = get_storage_adapter()
    upload_info = storage.generate_upload_url(
        user_id=user.id,
        file_name=file_name,
        file_type=file_type,
        bucket="documents",
    )
    return upload_info
```

**Client-side:** Takes the `upload_info` and POSTs the file to the Cloudinary upload endpoint with signature.

### Example 3: Delete File Endpoint

```python
@router.delete("/messages/{message_id}/file")
async def delete_file(
    message_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    message = await db.get(Message, message_id)

    if message and message.file_key:
        storage = get_storage_adapter()
        success = storage.delete_file(message.file_key, bucket="documents")

        if success:
            message.file_url = None
            message.file_key = None
            await db.commit()
            return {"success": True}

    return {"success": False}
```

## Files That Might Need Updates

Search your codebase for direct S3Manager usage:

```bash
grep -r "from app.utils.s3 import" backend/app/
grep -r "S3Manager" backend/app/
```

If found, replace with:

```python
from app.utils import get_storage_adapter
storage = get_storage_adapter()
```

Common locations that may need updates:

- `backend/app/api/v1/endpoints/*.py` - API endpoints
- `backend/app/services/*.py` - Business logic services
- `backend/app/tasks/*.py` - Background tasks
- Any model methods handling file operations

## Configuration

The StorageAdapter always uses Cloudinary. No provider selection needed.

Required environment variables:

```
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

## Testing the Migration

### Step 1: Verify Cloudinary Manager Works

```python
# Test imports
from app.utils import get_storage_adapter

storage = get_storage_adapter()
assert storage.provider == "cloudinary"
```

### Step 2: Test Endpoint Response Format

Ensure frontend can handle Cloudinary response:

- POST upload endpoint receives: `upload_url`, `signature`, `timestamp`, `cloud_name`, `api_key`, `public_id`, `folder`, `resource_type`

### Step 3: Test File Operations

- Upload: POST to `upload_url` with signature
- Download: GET from generated URL
- Delete: Backend calls `storage.delete_file()`
- Public URL: Use `storage.get_file_url()`
