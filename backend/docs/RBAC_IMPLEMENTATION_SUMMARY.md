# RBAC System Implementation - Summary

## What Has Been Implemented

### 1. **Enhanced User Model** (`/app/models/user.py`)

- Added `is_staff` flag to identify staff/admin users
- Added `admin_role` field to specify their administrative role
- Kept existing `is_superuser` for owner/bootstrap

### 2. **New Enums** (`/app/core/enums.py`)

- `AdminRole`: SUPER_ADMIN, VERIFIER, FINANCE, SUPPORT
- `AuditActionType`: Comprehensive list of loggable admin actions
- Kept `UserRole`: STUDENT, TEACHER (removed ADMIN, use `is_staff` + `admin_role` instead)

### 3. **Audit Logging**

- **Model**: `AuditLog` table tracks all administrative actions
- **Utility**: `log_audit()` function in `/app/utils/audit.py`
- Records: who, what, when, where, why for every admin action

### 4. **Role-Based Access Control** (`/app/core/dependencies.py`)

- New dependency: `require_staff()` - requires user to be staff
- New dependency: `require_admin_role(*roles)` - requires specific admin role
- New dependency: `require_superuser()` - requires superuser
- Common combinations: `RequireVerifier`, `RequireFinance`, `RequireSupport`

### 5. **Admin Management Endpoints** (`/app/api/v1/endpoints/admin.py`)

**Superuser Only:**

- `POST /admin/admins` - Create new admin
- `PATCH /admin/admins/{id}` - Update admin role/status
- `DELETE /admin/admins/{id}` - Deactivate admin

**Staff Only:**

- `GET /admin/admins` - List active admins
- `GET /admin/admins/{id}` - Get admin details
- `GET /admin/audit-logs` - View audit logs with filtering
- `GET /admin/audit-logs/{id}` - View specific audit log

### 6. **Admin Schemas** (`/app/schemas/admin.py`)

- `AdminCreateRequest` - Create new admin
- `AdminUpdateRequest` - Update admin
- `AdminRead` - Admin details response
- `AuditLogRead` - Audit log details response

### 7. **CLI Management Tool** (`/admin_cli.py`)

Command-line interface for admin operations:

```bash
python admin_cli.py create-superuser        # Bootstrap superuser
python admin_cli.py create-admin            # Create new admin
python admin_cli.py deactivate-admin        # Deactivate admin
python admin_cli.py list-admins             # List all admins
```

### 8. **Updated Endpoints**

- **Subjects**: Now uses `RequireVerifier` instead of `RequireAdmin`
- All admin actions logged via `log_audit()`
- Auth schema updated to prevent admin self-registration

## Admin Roles Explained

| Role        | Can Verify Teachers | Can Manage Payments | Can Handle Reports | Can Create Admins |
| ----------- | :-----------------: | :-----------------: | :----------------: | :---------------: |
| SUPER_ADMIN |         ✅          |         ✅          |         ✅         |        ✅         |
| VERIFIER    |         ✅          |         ❌          |         ❌         |        ❌         |
| FINANCE     |         ❌          |         ✅          |         ❌         |        ❌         |
| SUPPORT     |         ❌          |         ❌          |         ✅         |        ❌         |

## Security Layers

### 1. **Least Privilege**

- Each role has minimal required permissions
- VERIFIER can't see payments
- FINANCE can't verify teachers
- SUPPORT can't access sensitive data

### 2. **Immutable Audit Trail**

- Every admin action recorded
- IP address and user agent tracked
- Metadata captured (before/after values)
- Cannot be deleted (only view)

### 3. **Superuser Isolation**

- Only used for initial setup
- Never used for daily tasks
- Can't login normally (requires special handling)
- Creates/manages other admins

### 4. **Deactivation Not Deletion**

- Admins are deactivated, not deleted
- Preserves audit history
- Can be reactivated if needed
- Superuser can't deactivate themselves

## Bootstrap Process

### Option 1: CLI Tool (Recommended for Development)

```bash
python admin_cli.py create-superuser
# Interactive prompts
# Creates superuser with SUPER_ADMIN role
```

### Option 2: Direct SQL (For Production)

```sql
INSERT INTO users (
    id, first_name, last_name, email, password_hash,
    role, is_email_verified, is_active, is_banned,
    is_superuser, is_staff, admin_role,
    created_at, updated_at
) VALUES (
    gen_random_uuid(),
    'Your',
    'Name',
    'you@gurubhet.com',
    '$argon2id$...',  -- Use hash_password() to generate
    'STUDENT',
    true,
    true,
    false,
    true,   -- is_superuser
    true,   -- is_staff
    'SUPER_ADMIN',
    NOW(),
    NOW()
);
```

### Option 3: API After Bootstrap

Once superuser exists and can login:

1. Login as superuser → Get access token
2. Use `POST /admin/admins` to create other admins
3. Never need to use superuser again

## Files Changed/Created

### Modified

- `/app/core/enums.py` - Enhanced with AdminRole and AuditActionType
- `/app/models/user.py` - Added is_staff and admin_role fields
- `/app/core/dependencies.py` - Added staff/admin role checking
- `/app/api/v1/endpoints/admin.py` - Complete rewrite with admin management
- `/app/api/v1/endpoints/subjects.py` - Updated to use new dependencies and logging
- `/app/schemas/auth.py` - Prevent admin self-registration

### Created

- `/app/models/audit_log.py` - AuditLog model for tracking
- `/app/utils/audit.py` - Audit logging utility
- `/app/schemas/admin.py` - Admin-related schemas
- `/admin_cli.py` - CLI tool for admin management
- `/docs/RBAC_IMPLEMENTATION.md` - Complete implementation guide

## Next Steps

1. **Run Database Migration**

   ```bash
   alembic revision --autogenerate -m "add rbac and audit log"
   alembic upgrade head
   ```

2. **Create Superuser**

   ```bash
   python admin_cli.py create-superuser
   ```

3. **Test Admin Creation**
   - Login as superuser
   - Create a VERIFIER admin via API
   - Test with VERIFIER credentials

4. **Monitor Audit Logs**
   - Review logs regularly
   - Check for suspicious activity
   - Rotate admin passwords periodically

5. **Deploy & Secure**
   - Enable HTTPS in production
   - Add IP whitelisting for admin endpoints
   - Consider adding rate limiting
   - Monitor failed login attempts

## API Examples

### Create VERIFIER Admin

```bash
curl -X POST http://localhost:8000/api/v1/admin/admins \
  -H "Content-Type: application/json" \
  -H "x-access-token: YOUR_SUPERUSER_TOKEN" \
  -d '{
    "first_name": "John",
    "last_name": "Verifier",
    "email": "verifier@gurubhet.com",
    "admin_role": "VERIFIER",
    "password": "SecurePass123"
  }'
```

### List Active Admins

```bash
curl http://localhost:8000/api/v1/admin/admins \
  -H "x-access-token: YOUR_ADMIN_TOKEN"
```

### View Audit Logs

```bash
curl "http://localhost:8000/api/v1/admin/audit-logs?limit=20" \
  -H "x-access-token: YOUR_ADMIN_TOKEN"
```

## Documentation

Complete implementation guide: `/docs/RBAC_IMPLEMENTATION.md`

Contains:

- Detailed architecture overview
- Admin role permissions matrix
- Complete API endpoint reference
- Bootstrap procedures
- Security best practices
- Testing guidelines
- Migration steps

## Questions?

Refer to the inline code comments in:

- `/app/core/enums.py` - Role definitions
- `/app/models/audit_log.py` - Audit structure
- `/app/api/v1/endpoints/admin.py` - Endpoint implementation
- `/docs/RBAC_IMPLEMENTATION.md` - Comprehensive guide
