# RBAC Implementation Guide for GuruBhet

## Overview

This document describes the new Role-Based Access Control (RBAC) system implemented to secure admin access and create a proper hierarchy for administrative tasks.

## Architecture

### User Hierarchy

```
┌─ Superuser (is_superuser=True)
│  └─ Only you (the owner)
│  └─ Can create/modify all staff accounts
│  └─ Never used for daily tasks
│
├─ Staff Members (is_staff=True, admin_role != null)
│  ├─ SUPER_ADMIN: Full platform control
│  ├─ VERIFIER: Can verify teacher documents
│  ├─ FINANCE: Can manage payments and payouts
│  └─ SUPPORT: Can handle user reports and bans
│
├─ Teachers (role=TEACHER)
│  └─ Can teach and earn
│
└─ Students (role=STUDENT)
   └─ Can book sessions
```

### Database Schema Changes

#### User Model Updates

```sql
ALTER TABLE users ADD COLUMN is_staff BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN admin_role VARCHAR(50);
-- Existing is_superuser remains unchanged
```

#### New AuditLog Table

```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY,
    action_type VARCHAR(50) NOT NULL,
    description TEXT,
    actor_id UUID NOT NULL REFERENCES users(id),
    target_user_id UUID,
    target_resource_type VARCHAR(100),
    target_resource_id UUID,
    ip_address VARCHAR(50),
    user_agent VARCHAR(500),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    INDEX idx_action_type,
    INDEX idx_actor_id,
    INDEX idx_created_at
);
```

## Admin Roles & Permissions

### SUPER_ADMIN

- Can create/modify/deactivate other admins
- Full access to all admin features
- Can view all audit logs
- Should be used sparingly

### VERIFIER

- Can list pending teachers
- Can approve/reject teacher documents
- Cannot access payment/finance features
- Can view their own audit logs

### FINANCE

- Can manage escrow payments
- Can process payouts
- Can view payment transactions
- Cannot access teacher verification
- Can view finance-related audit logs

### SUPPORT

- Can view user reports
- Can ban/unban users
- Can view user details
- Cannot access verification or payments
- Can view user-related audit logs

## API Endpoints

### Admin Management (Superuser only)

```bash
# Create a new admin
POST /api/v1/admin/admins
{
  "first_name": "John",
  "last_name": "Verifier",
  "email": "john@gurubhet.com",
  "admin_role": "VERIFIER",
  "password": "SecurePassword123"
}

# Update admin role/status
PATCH /api/v1/admin/admins/{admin_id}
{
  "admin_role": "FINANCE",
  "is_active": true
}

# Deactivate admin (soft delete)
DELETE /api/v1/admin/admins/{admin_id}

# List all active admins
GET /api/v1/admin/admins

# Get specific admin details
GET /api/v1/admin/admins/{admin_id}
```

### Audit Logs (Staff only)

```bash
# List audit logs with filtering
GET /api/v1/admin/audit-logs?action_type=TEACHER_VERIFIED&limit=50

# Get specific audit log
GET /api/v1/admin/audit-logs/{log_id}
```

## Bootstrap Process

Since you can't create admins via API (chicken-and-egg problem), use direct database access:

### Step 1: Create Initial Superuser

```sql
INSERT INTO users (
    id, first_name, last_name, email, phone, password_hash,
    role, is_email_verified, is_active, is_banned, is_superuser, is_staff,
    admin_role, created_at, updated_at
) VALUES (
    gen_random_uuid(),
    'Your',
    'Name',
    'you@gurubhet.com',
    NULL,
    '$argon2id$...',  -- Hash your password using argon2
    'STUDENT',
    true,
    true,
    false,
    true,  -- is_superuser
    true,  -- is_staff
    'SUPER_ADMIN',
    NOW(),
    NOW()
);
```

### Step 2: Hash Your Password (Python)

```python
from app.core.security import hash_password
password = hash_password("YourSecurePassword123")
print(password)
```

### Step 3: Create Other Admins via API

Once you have superuser access with a token, use the API:

1. Login as superuser
2. POST /api/v1/admin/admins to create new admins
3. New admins can then use the system

## Audit Trail

Every administrative action is logged:

- Who did it (actor_id)
- What they did (action_type)
- Who it affected (target_user_id)
- When it happened (created_at)
- Where from (ip_address)
- Additional context (metadata)

### Logged Actions

- `ADMIN_CREATED`: New admin account created
- `ADMIN_UPDATED`: Admin role or status changed
- `ADMIN_DEACTIVATED`: Admin account deactivated
- `TEACHER_VERIFIED`: Teacher document approved
- `TEACHER_REJECTED`: Teacher document rejected
- `USER_BANNED`: User banned from platform
- `USER_UNBANNED`: User ban removed
- `SUBJECT_CREATED`: New subject added to catalog
- `SUBJECT_DEACTIVATED`: Subject hidden from catalog
- `ESCROW_RELEASED`: Payment released to teacher
- `ESCROW_REFUNDED`: Payment refunded to student
- `REPORT_RESOLVED`: User report handled

## Security Best Practices

### Do's ✅

- Keep superuser password extremely secure
- Regularly review audit logs for suspicious activity
- Create admins with minimum necessary permissions
- Deactivate unused admin accounts (never hard delete)
- Distribute roles among different people
- Change passwords for important accounts regularly

### Don'ts ❌

- Don't use superuser for daily tasks
- Don't hard delete admin accounts (always deactivate)
- Don't grant SUPER_ADMIN role to multiple people unless necessary
- Don't log in as superuser from untrusted networks
- Don't share superuser credentials
- Don't skip password strength validation

## Future Enhancements

The system is designed to support future additions:

- Multi-factor authentication (MFA) for staff
- Scoped JWTs with role information
- Time-based access restrictions
- Approval workflows for sensitive actions
- Detailed permission matrices per role

## Migration Steps

1. Create Alembic migration:

   ```bash
   alembic revision --autogenerate -m "add_rbac_and_audit_log"
   ```

2. Review and run migration:

   ```bash
   alembic upgrade head
   ```

3. Create superuser via SQL (see Bootstrap Process above)

4. Update all admin endpoint callers to use new dependencies:
   - Replace `RequireAdmin` with `RequireStaff` or specific role dependencies
   - Update endpoint logic to log actions via `log_audit()`

5. Test all admin endpoints with new roles

6. Monitor audit logs for any issues

## Testing

### Test as Superuser

```bash
# Get superuser token
curl -X POST http://localhost:8000/api/v1/auth/login \
  -d '{"email": "you@gurubhet.com", "password": "YourPassword"}'

# Create a VERIFIER admin
curl -X POST http://localhost:8000/api/v1/admin/admins \
  -H "Authorization: Bearer $TOKEN" \
  -d '{...}'
```

### Test Role Restrictions

- Login as VERIFIER → Should access verification endpoints only
- Login as FINANCE → Should access payment endpoints only
- Try cross-role access → Should get 403 Forbidden

## Questions?

Refer to:

- `/app/core/enums.py` - AdminRole and AuditActionType definitions
- `/app/core/dependencies.py` - Role-based access control decorators
- `/app/utils/audit.py` - Audit logging utility
- `/app/api/v1/endpoints/admin.py` - Admin management endpoints
