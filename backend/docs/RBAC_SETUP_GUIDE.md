# GuruBhet RBAC Implementation - Complete Guide

## Overview

A comprehensive Role-Based Access Control (RBAC) system has been implemented to provide:

- **Superuser**: Owner account with full control
- **Staff Admins**: Users with specific roles (VERIFIER, FINANCE, SUPPORT)
- **Audit Trail**: Complete logging of all administrative actions
- **Least Privilege**: Each role has minimum required permissions
- **Immutable Records**: Admin actions cannot be hidden or deleted

## System Architecture

```
┌─────────────────────────────────────────────────────┐
│                    GuruBhet Platform                 │
└─────────────────────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                 │
    ┌───▼───┐       ┌────▼────┐      ┌───▼───┐
    │ Users │       │  Staff   │      │ Owner │
    │(RBAC) │       │ (RBAC)   │      │Super  │
    └───────┘       └──────────┘      └───────┘
        │                │                 │
    STUDENT         VERIFIER            SUPER_
    TEACHER         FINANCE             ADMIN
                    SUPPORT
```

## Database Schema

### Users Table - New Columns

```sql
-- Identifies if user is a staff member
is_staff BOOLEAN DEFAULT FALSE

-- Only populated if is_staff = TRUE
admin_role ENUM('SUPER_ADMIN', 'VERIFIER', 'FINANCE', 'SUPPORT') NULL

-- Existing field, only for owner
is_superuser BOOLEAN DEFAULT FALSE
```

### Audit Logs Table (New)

```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY,
    action_type ENUM(...),              -- What happened
    description TEXT,                   -- Human readable
    actor_id UUID NOT NULL,             -- Who did it
    target_user_id UUID,                -- Who was affected
    target_resource_type VARCHAR(100),  -- What was affected (Teacher, Booking, etc)
    target_resource_id UUID,            -- ID of affected resource
    ip_address VARCHAR(50),             -- Where from
    user_agent VARCHAR(500),            -- What device
    metadata JSONB,                     -- Additional context
    created_at TIMESTAMP WITH TZ        -- When
);
```

## Implementation Steps

### Step 1: Update Code

All code has been updated in:

- ✅ `/app/core/enums.py` - New AdminRole and AuditActionType
- ✅ `/app/models/user.py` - Added is_staff, admin_role
- ✅ `/app/models/audit_log.py` - New AuditLog model
- ✅ `/app/core/dependencies.py` - New RBAC decorators
- ✅ `/app/utils/audit.py` - Audit logging utility
- ✅ `/app/api/v1/endpoints/admin.py` - Admin management endpoints
- ✅ `/app/schemas/admin.py` - Admin schemas
- ✅ `/admin_cli.py` - CLI tool

### Step 2: Run Database Migration

```bash
# Generate migration from models
alembic revision --autogenerate -m "add rbac and audit logging"

# Review the migration (optional)
cat migrations/versions/XXX_add_rbac_and_audit_logging.py

# Apply migration
alembic upgrade head
```

Or manually run SQL:

```sql
-- Add columns to users
ALTER TABLE users ADD COLUMN is_staff BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN admin_role VARCHAR(50);

-- Create enum types (if using PostgreSQL)
CREATE TYPE adminrole AS ENUM ('SUPER_ADMIN', 'VERIFIER', 'FINANCE', 'SUPPORT');
CREATE TYPE auditactiontype AS ENUM (
    'ADMIN_CREATED', 'ADMIN_UPDATED', 'ADMIN_DEACTIVATED',
    'TEACHER_VERIFIED', 'TEACHER_REJECTED',
    'USER_BANNED', 'USER_UNBANNED',
    'ESCROW_RELEASED', 'ESCROW_REFUNDED',
    'SUBJECT_CREATED', 'SUBJECT_DEACTIVATED',
    'REPORT_RESOLVED', 'OTHER'
);

-- Create audit_logs table
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action_type VARCHAR(50) NOT NULL,
    description TEXT,
    actor_id UUID NOT NULL REFERENCES users(id),
    target_user_id UUID,
    target_resource_type VARCHAR(100),
    target_resource_id UUID,
    ip_address VARCHAR(50),
    user_agent VARCHAR(500),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX ix_audit_logs_action_type ON audit_logs(action_type);
CREATE INDEX ix_audit_logs_actor_id ON audit_logs(actor_id);
CREATE INDEX ix_audit_logs_created_at ON audit_logs(created_at);
```

### Step 3: Create Superuser

**Option A: Using CLI (Recommended for development)**

```bash
cd /Users/ujjalshrestha/Desktop/GuruBhet/backend
python admin_cli.py create-superuser
# Interactive prompts for name, email, password
```

**Option B: Direct SQL (For production/docker)**

```sql
-- First, generate password hash in Python
-- python -c "from app.core.security import hash_password; print(hash_password('YourPassword123'))"

INSERT INTO users (
    id, first_name, last_name, email, phone,
    password_hash, role, is_email_verified, is_active, is_banned,
    is_superuser, is_staff, admin_role,
    created_at, updated_at
) VALUES (
    gen_random_uuid(),
    'Your',
    'Name',
    'you@gurubhet.com',
    NULL,
    '$argon2id$v=19$m=65540,t=3,p=4$...',  -- Your password hash
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

### Step 4: Test Superuser Login

```bash
# Login as superuser
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "you@gurubhet.com",
    "password": "YourPassword123"
  }'

# Should return tokens
# {
#   "message": "Logged in successfully"
# }
```

### Step 5: Create Admin Staff Members

**Via API (using superuser token)**

```bash
TOKEN="your_access_token_here"

# Create VERIFIER
curl -X POST http://localhost:8000/api/v1/admin/admins \
  -H "Content-Type: application/json" \
  -H "x-access-token: $TOKEN" \
  -d '{
    "first_name": "John",
    "last_name": "Verifier",
    "email": "verifier@gurubhet.com",
    "admin_role": "VERIFIER",
    "password": "VerifierPass123"
  }'

# Create FINANCE
curl -X POST http://localhost:8000/api/v1/admin/admins \
  -H "Content-Type: application/json" \
  -H "x-access-token: $TOKEN" \
  -d '{
    "first_name": "Jane",
    "last_name": "Finance",
    "email": "finance@gurubhet.com",
    "admin_role": "FINANCE",
    "password": "FinancePass123"
  }'

# Create SUPPORT
curl -X POST http://localhost:8000/api/v1/admin/admins \
  -H "Content-Type: application/json" \
  -H "x-access-token: $TOKEN" \
  -d '{
    "first_name": "Bob",
    "last_name": "Support",
    "email": "support@gurubhet.com",
    "admin_role": "SUPPORT",
    "password": "SupportPass123"
  }'
```

**Via CLI**

```bash
python admin_cli.py create-admin \
  --email verifier@gurubhet.com \
  --role VERIFIER

python admin_cli.py create-admin \
  --email finance@gurubhet.com \
  --role FINANCE

python admin_cli.py create-admin \
  --email support@gurubhet.com \
  --role SUPPORT
```

## API Endpoints

### Admin Management (Superuser Only)

```
POST   /api/v1/admin/admins
       Create new admin staff member

PATCH  /api/v1/admin/admins/{admin_id}
       Update admin role or deactivate

DELETE /api/v1/admin/admins/{admin_id}
       Deactivate admin (soft delete)

GET    /api/v1/admin/admins
       List all active admins

GET    /api/v1/admin/admins/{admin_id}
       Get admin details
```

### Audit Logs (Staff Only)

```
GET    /api/v1/admin/audit-logs
       List audit logs (with filtering)

GET    /api/v1/admin/audit-logs/{log_id}
       Get specific audit log
```

### Existing Endpoints (Updated)

```
POST   /api/v1/subjects
       Now requires VERIFIER role
       Creates audit log entry

DELETE /api/v1/subjects/{subject_id}
       Now requires VERIFIER role
       Creates audit log entry
```

## Admin Roles

### SUPER_ADMIN

- Full platform access
- Can create/modify/deactivate other admins
- Can view all audit logs
- **Should only be used by owner for setup**
- Cannot create other SUPER_ADMINs (only via superuser flag)

### VERIFIER

- Can verify teacher documents
- Can view pending teachers list
- Can list all subjects
- Can create/deactivate subjects
- Cannot see payment data
- Cannot see user reports

### FINANCE

- Can manage escrow payments
- Can process teacher payouts
- Can view payment transactions
- Cannot verify teachers
- Cannot manage reports
- Cannot modify users

### SUPPORT

- Can view user reports
- Can ban/unban users
- Can deactivate/reactivate accounts
- Cannot verify teachers
- Cannot manage payments
- Cannot access financial data

## Audit Logging

Every significant admin action is logged:

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "action_type": "ADMIN_CREATED",
  "description": "Created VERIFIER admin: john@gurubhet.com",
  "actor_id": "550e8400-e29b-41d4-a716-446655440001",
  "target_user_id": "550e8400-e29b-41d4-a716-446655440002",
  "target_resource_type": "Admin",
  "target_resource_id": "550e8400-e29b-41d4-a716-446655440002",
  "ip_address": "192.168.1.100",
  "user_agent": "curl/7.68.0",
  "metadata": {
    "admin_role": "VERIFIER",
    "email": "john@gurubhet.com"
  },
  "created_at": "2026-03-30T10:30:00Z"
}
```

### Logged Actions

- `ADMIN_CREATED` - New admin account created
- `ADMIN_UPDATED` - Admin role or status changed
- `ADMIN_DEACTIVATED` - Admin account deactivated
- `TEACHER_VERIFIED` - Teacher document approved
- `TEACHER_REJECTED` - Teacher document rejected
- `USER_BANNED` - User banned from platform
- `USER_UNBANNED` - User ban removed
- `ESCROW_RELEASED` - Payment released to teacher
- `ESCROW_REFUNDED` - Payment refunded to student
- `SUBJECT_CREATED` - New subject added
- `SUBJECT_DEACTIVATED` - Subject hidden
- `REPORT_RESOLVED` - User report handled

## Security Best Practices

### ✅ Do's

- Keep superuser password extremely secure
- Store it in a password manager
- Use long, complex passwords
- Review audit logs regularly
- Distribute admin roles across team members
- Create minimum permission accounts
- Deactivate unused admin accounts
- Monitor failed login attempts
- Use HTTPS only in production
- Enable IP whitelisting for admin endpoints

### ❌ Don'ts

- Don't use superuser for daily tasks
- Don't share superuser credentials
- Don't hard delete admin accounts (always deactivate)
- Don't grant SUPER_ADMIN to non-essential people
- Don't use weak passwords
- Don't expose tokens in logs
- Don't commit credentials to git
- Don't login from untrusted networks
- Don't skip security updates

## Troubleshooting

### Problem: "Admin not found" when creating

**Solution**: Check that superuser exists

```bash
SELECT * FROM users WHERE is_superuser = true;
```

### Problem: Token validation fails

**Solution**: Check access token format

```bash
# Token should be in x-access-token header
curl -H "x-access-token: YOUR_TOKEN" http://localhost:8000/api/v1/admin/admins
```

### Problem: "Staff access required"

**Solution**: User is not staff member

```bash
# Check user's is_staff flag
SELECT email, is_staff, admin_role FROM users WHERE email = 'admin@gurubhet.com';
```

### Problem: Audit logs not created

**Solution**: Check audit_logs table exists

```bash
SELECT * FROM audit_logs LIMIT 1;
```

## Files Reference

| File                                   | Purpose                                |
| -------------------------------------- | -------------------------------------- |
| `/app/core/enums.py`                   | AdminRole, AuditActionType definitions |
| `/app/models/user.py`                  | User model with is_staff, admin_role   |
| `/app/models/audit_log.py`             | AuditLog model                         |
| `/app/core/dependencies.py`            | RBAC decorators                        |
| `/app/utils/audit.py`                  | log_audit() function                   |
| `/app/api/v1/endpoints/admin.py`       | Admin endpoints                        |
| `/app/schemas/admin.py`                | Admin schemas                          |
| `/admin_cli.py`                        | CLI tool for admin management          |
| `/docs/RBAC_IMPLEMENTATION.md`         | Detailed guide                         |
| `/docs/RBAC_IMPLEMENTATION_SUMMARY.md` | Implementation summary                 |

## Next Steps

1. ✅ Code is implemented
2. ⏳ Run database migration
3. ⏳ Create superuser via CLI or SQL
4. ⏳ Test superuser login
5. ⏳ Create admin staff members
6. ⏳ Test each role's permissions
7. ⏳ Monitor audit logs
8. ⏳ Set up admin dashboard in frontend

## Support

For questions or issues, refer to:

- Implementation guide: `/docs/RBAC_IMPLEMENTATION.md`
- Code comments in endpoint files
- Audit log structure documentation
- Admin role permissions matrix

## Version

RBAC System v1.0 - March 30, 2026
