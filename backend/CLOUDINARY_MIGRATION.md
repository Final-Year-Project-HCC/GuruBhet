# Cloudinary Migration Guide

## Overview

The GuruBhet backend is migrating from S3/MinIO to Cloudinary for all media storage and management. This document outlines the migration plan and implementation details.

## Current Status

✅ **Completed**

- Created `app/utils/cloudinary.py` with `CloudinaryManager` class
- Created `app/utils/storage_adapter.py` for unified interface
- Added Cloudinary configuration to `app/core/config.py`
- All new code uses placeholder implementations (no actual API calls yet)

⏳ **TODO**

- Implement actual Cloudinary SDK integration (after credentials are available)
- Migrate endpoints to use new storage adapter
- Test end-to-end file upload/download flows
- Update documentation
- Deploy to production

## Configuration

### Environment Variables

Add to your `.env` file:

```bash
# Cloudinary (Required for production, optional for development)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

**Note:** S3 has been completely removed. Cloudinary is the only storage provider.

## File Structure

```
app/utils/
├── cloudinary.py          # Cloudinary manager
└── storage_adapter.py     # Unified storage interface (Cloudinary only)
```

**Legacy files** (kept for reference but no longer used):

- `app/utils/s3.py`
- `app/utils/storage.py`

## Usage

All media operations use the unified storage adapter, which routes to Cloudinary:

```python
from app.utils.storage_adapter import get_storage_adapter

# Get the storage adapter
storage = get_storage_adapter()

# Generate upload credentials for client-side upload
upload_info = storage.generate_upload_url(
    user_id=user.id,
    file_name="document.pdf",
    file_type="application/pdf",
    bucket="documents"
)

# Generate a download URL
download_url = storage.generate_download_url(
    file_id=file_public_id,  # Cloudinary public ID
    bucket="documents"
)

# Delete a file
success = storage.delete_file(
    file_id=file_public_id,
    bucket="documents"
)

# Get a public URL
public_url = storage.get_file_url(
    file_id=file_public_id,
    bucket="documents"
)
```

## Implementation Timeline

### Phase 1: Setup (Current)

- ✅ Create Cloudinary utility module with placeholder methods
- ✅ Create storage adapter
- ✅ Update configuration (remove S3)
- ✅ Update documentation
- [ ] Create comprehensive test suite

### Phase 2: Implementation (Next)

When Cloudinary credentials become available:

- [ ] Install `cloudinary` Python package: `poetry add cloudinary`
- [ ] Implement actual SDK initialization in `CloudinaryManager._init_cloudinary()`
- [ ] Implement all TODO methods in CloudinaryManager
- [ ] Add error handling and retry logic
- [ ] Test with real Cloudinary account

### Phase 3: Migration (After Phase 2)

- [ ] Update all endpoints to use storage adapter
- [ ] Replace any direct S3Manager usage with storage adapter
- [ ] Update communication service to use Cloudinary public IDs
- [ ] Perform end-to-end testing
- [ ] Update API documentation

### Phase 4: Cleanup (Final)

- [ ] Remove S3Manager class (optional, can keep for backward compatibility)
- [ ] Remove S3 utility files (optional)
- [ ] Archive S3-related code as history

## Handling Legacy S3 Files

The following files are no longer used and can be removed or archived:

```
app/utils/s3.py          # S3Manager class (safe to delete)
app/utils/storage.py     # S3 utility functions (safe to delete)
```

To safely remove:

```bash
# 1. Verify no imports exist
grep -r "from app.utils.s3\|from app.utils.storage" backend/app/

# 2. Delete files
git rm backend/app/utils/s3.py
git rm backend/app/utils/storage.py

# 3. Commit
git commit -m "Remove deprecated S3 utilities (Cloudinary only)"
```

## Database Schema Updates

The `Message` model currently uses `file_key` to store file identifiers. With Cloudinary:

**Current:**

```python
class Message(Base):
    file_url: str | None = None  # Full URL
    file_key: str | None = None  # File identifier for deletion
```

**After Full Migration (Optional):**

```python
class Message(Base):
    file_url: str | None = None  # Full Cloudinary URL (https://res.cloudinary.com/...)
    file_public_id: str | None = None  # Cloudinary public ID for deletion/retrieval
```

**Note:** The `file_key` field can continue to store Cloudinary public IDs without schema changes. The `file_public_id` field exists in migration `9df3be4b8376_fix_bookingstatus_enum.py` if you want to be explicit.

## Cloudinary Concepts

### Public ID (File Identifier)

Instead of S3's object key, Cloudinary uses a **public ID** to identify files:

```
users/123e4567/documents/report
```

- No file extension needed (Cloudinary infers from format parameter)
- Built-in folder hierarchy
- Used for all operations: retrieval, transformation, deletion

### Upload Flow

```
1. Server generates signed upload token
   ↓
2. Client POST to https://api.cloudinary.com/v1_1/{cloud}/upload
   ↓
3. Cloudinary processes and stores file
   ↓
4. Returns public_id and secure_url
   ↓
5. Client can immediately use the URL
```

### URL Features

Cloudinary URLs automatically include optimizations:

- Format auto-selection (webp, jpg, png based on browser)
- Quality auto-adjustment (dpr, device pixel ratio)
- CDN delivery from edge locations
- Automatic responsive image sizing

## Error Handling

### Credentials Not Configured

If Cloudinary credentials are missing and a file operation is attempted:

```python
try:
    storage.generate_upload_url(...)
except RuntimeError as e:
    # "Cloudinary is not initialized. Please configure CLOUDINARY_CLOUD_NAME..."
```

The application can start without credentials, but file operations will fail gracefully with clear error messages.

### Provider Auto-Detection

The adapter automatically selects the provider in this order:

1. Cloudinary (if credentials configured)
2. S3 (if fallback credentials configured)
3. Raises error if neither configured

## Testing

### Unit Tests

Test Cloudinary implementation:

```python
import pytest
from app.utils.storage_adapter import StorageAdapter

@pytest.fixture
def storage():
    return StorageAdapter()  # Always Cloudinary now

def test_generate_upload_url(storage):
    result = storage.generate_upload_url(...)
    assert "upload_url" in result
    # ... CloudinaryManager-specific assertions
```

### Integration Tests

After credentials are available, test with real Cloudinary:

```python
@pytest.mark.integration
async def test_full_upload_flow():
    # Generate upload credentials
    upload_info = storage.generate_upload_url(...)

    # Simulate client upload
    file_data = b"test content"
    # ... actual upload to Cloudinary ...

    # Verify file is available
    url = storage.generate_download_url(public_id)
    # ... verify URL works ...
```

## Migration Checklist

- [ ] Cloudinary credentials obtained and added to `.env`
- [ ] Implement SDK initialization in `CloudinaryManager._init_cloudinary()`
- [ ] Implement all TODO methods in CloudinaryManager
- [ ] Run unit tests for Cloudinary implementation
- [ ] Update endpoints to use StorageAdapter (if not already done)
- [ ] Integration test with real Cloudinary account
- [ ] Test file uploads/downloads in staging
- [ ] Deploy to production
- [ ] Monitor for issues in production
- [ ] (Optional) Remove S3 utility files

## References

- [Cloudinary Python SDK](https://github.com/cloudinary/cloudinary_python)
- [Cloudinary Upload API](https://cloudinary.com/documentation/upload_widget)
- [Cloudinary Transformations](https://cloudinary.com/documentation/image_transformation_reference)
- [Cloudinary Signed URLs](https://cloudinary.com/documentation/control_access_to_media#authenticated_access)
