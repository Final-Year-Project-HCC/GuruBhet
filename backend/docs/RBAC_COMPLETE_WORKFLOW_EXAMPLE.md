# RBAC Implementation - Complete Workflow Example

This document walks through a complete example of the RBAC system in action.

## Scenario

You're setting up GuruBhet for the first time. You (the owner) want to:

1. Create yourself as superuser
2. Create a teacher verification team lead
3. Create a finance manager
4. Track all admin actions

## Step-by-Step Walkthrough

### Phase 1: Initial Setup (Owner/Superuser)

#### 1. Database Migration

```bash
cd /Users/ujjalshrestha/Desktop/GuruBhet/backend

# Generate migration from models
alembic revision --autogenerate -m "add rbac and audit logging"

# Review it (optional)
cat migrations/versions/XXX_add_rbac_and_audit_logging.py

# Run it
alembic upgrade head

# Verify new tables exist
# SELECT * FROM audit_logs LIMIT 0;  -- Should exist
# SELECT is_staff FROM users LIMIT 0; -- Should exist
```

#### 2. Create Superuser

```bash
# Using CLI (interactive)
python admin_cli.py create-superuser

# Output:
# === GuruBhet Superuser Creation ===
#
# First name: Your
# Last name: Name
# Email address: you@gurubhet.com
# Password (min 8 chars, 1 uppercase, 1 digit): SecurePass123
# Confirm password: SecurePass123
#
# ✅ Superuser created successfully!
#    Email: you@gurubhet.com
#    ID: 550e8400-e29b-41d4-a716-446655440000
```

#### 3. Test Superuser Login

```bash
# Login to get access token
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "you@gurubhet.com",
    "password": "SecurePass123"
  }'

# Response:
# {
#   "message": "Logged in succesfully"
# }

# (Access token is in cookies, or check response headers)
# Save for next steps: TOKEN="your_access_token"
```

#### 4. Verify Superuser Status

```bash
# Check database
psql -d gurubhet -c "
  SELECT id, email, is_superuser, is_staff, admin_role
  FROM users
  WHERE email = 'you@gurubhet.com';
"

# Result:
#                   id                  |     email      | is_superuser | is_staff | admin_role
# ------------------------------------+----------------+--------------+----------+-----------
# 550e8400-e29b-41d4-a716-446655440000 | you@gurubhet.com |     t        |    t     | SUPER_ADMIN
```

### Phase 2: Create Admin Staff

#### 5. Create VERIFIER Admin (Teacher Verification Team)

```bash
TOKEN="your_access_token_from_step_3"

curl -X POST http://localhost:8000/api/v1/admin/admins \
  -H "Content-Type: application/json" \
  -H "x-access-token: $TOKEN" \
  -d '{
    "first_name": "Sarah",
    "last_name": "Verifier",
    "email": "sarah@gurubhet.com",
    "admin_role": "VERIFIER",
    "password": "VerifierPass123"
  }'

# Response:
# {
#   "id": "550e8400-e29b-41d4-a716-446655440001",
#   "first_name": "Sarah",
#   "last_name": "Verifier",
#   "email": "sarah@gurubhet.com",
#   "is_staff": true,
#   "admin_role": "VERIFIER",
#   "is_active": true,
#   "created_at": "2026-03-30T10:30:00Z"
# }
```

#### 6. Create FINANCE Admin (Payment Manager)

```bash
curl -X POST http://localhost:8000/api/v1/admin/admins \
  -H "Content-Type: application/json" \
  -H "x-access-token: $TOKEN" \
  -d '{
    "first_name": "Raj",
    "last_name": "Finance",
    "email": "raj@gurubhet.com",
    "admin_role": "FINANCE",
    "password": "FinancePass123"
  }'

# Response:
# {
#   "id": "550e8400-e29b-41d4-a716-446655440002",
#   "first_name": "Raj",
#   "last_name": "Finance",
#   "email": "raj@gurubhet.com",
#   "is_staff": true,
#   "admin_role": "FINANCE",
#   "is_active": true,
#   "created_at": "2026-03-30T10:30:05Z"
# }
```

#### 7. Create SUPPORT Admin (User Support)

```bash
curl -X POST http://localhost:8000/api/v1/admin/admins \
  -H "Content-Type: application/json" \
  -H "x-access-token: $TOKEN" \
  -d '{
    "first_name": "Priya",
    "last_name": "Support",
    "email": "priya@gurubhet.com",
    "admin_role": "SUPPORT",
    "password": "SupportPass123"
  }'

# Response:
# {
#   "id": "550e8400-e29b-41d4-a716-446655440003",
#   "first_name": "Priya",
#   "last_name": "Support",
#   "email": "priya@gurubhet.com",
#   "is_staff": true,
#   "admin_role": "SUPPORT",
#   "is_active": true,
#   "created_at": "2026-03-30T10:30:10Z"
# }
```

### Phase 3: Verify Admin Capabilities

#### 8. List All Admins

```bash
curl -X GET http://localhost:8000/api/v1/admin/admins \
  -H "x-access-token: $TOKEN"

# Response:
# [
#   {
#     "id": "550e8400-e29b-41d4-a716-446655440000",
#     "first_name": "Your",
#     "last_name": "Name",
#     "email": "you@gurubhet.com",
#     "is_staff": true,
#     "admin_role": "SUPER_ADMIN",
#     "is_active": true,
#     "created_at": "2026-03-30T10:00:00Z"
#   },
#   {
#     "id": "550e8400-e29b-41d4-a716-446655440001",
#     "first_name": "Sarah",
#     "last_name": "Verifier",
#     "email": "sarah@gurubhet.com",
#     "is_staff": true,
#     "admin_role": "VERIFIER",
#     "is_active": true,
#     "created_at": "2026-03-30T10:30:00Z"
#   },
#   ...
# ]
```

#### 9. View Audit Log (All Actions Tracked)

```bash
curl -X GET "http://localhost:8000/api/v1/admin/audit-logs?limit=10" \
  -H "x-access-token: $TOKEN"

# Response:
# [
#   {
#     "id": "650e8400-e29b-41d4-a716-446655440003",
#     "action_type": "ADMIN_CREATED",
#     "description": "Created SUPPORT admin: priya@gurubhet.com",
#     "actor_id": "550e8400-e29b-41d4-a716-446655440000",  # You (superuser)
#     "target_user_id": "550e8400-e29b-41d4-a716-446655440003",  # Priya
#     "target_resource_type": "Admin",
#     "target_resource_id": "550e8400-e29b-41d4-a716-446655440003",
#     "ip_address": "192.168.1.100",
#     "user_agent": "curl/7.68.0",
#     "metadata": {
#       "admin_role": "SUPPORT",
#       "email": "priya@gurubhet.com"
#     },
#     "created_at": "2026-03-30T10:30:10Z"
#   },
#   {
#     "id": "650e8400-e29b-41d4-a716-446655440002",
#     "action_type": "ADMIN_CREATED",
#     "description": "Created FINANCE admin: raj@gurubhet.com",
#     "actor_id": "550e8400-e29b-41d4-a716-446655440000",
#     "target_user_id": "550e8400-e29b-41d4-a716-446655440002",
#     "target_resource_type": "Admin",
#     "target_resource_id": "550e8400-e29b-41d4-a716-446655440002",
#     "ip_address": "192.168.1.100",
#     "user_agent": "curl/7.68.0",
#     "metadata": {
#       "admin_role": "FINANCE",
#       "email": "raj@gurubhet.com"
#     },
#     "created_at": "2026-03-30T10:30:05Z"
#   },
#   {
#     "id": "650e8400-e29b-41d4-a716-446655440001",
#     "action_type": "ADMIN_CREATED",
#     "description": "Created VERIFIER admin: sarah@gurubhet.com",
#     "actor_id": "550e8400-e29b-41d4-a716-446655440000",
#     "target_user_id": "550e8400-e29b-41d4-a716-446655440001",
#     "target_resource_type": "Admin",
#     "target_resource_id": "550e8400-e29b-41d4-a716-446655440001",
#     "ip_address": "192.168.1.100",
#     "user_agent": "curl/7.68.0",
#     "metadata": {
#       "admin_role": "VERIFIER",
#       "email": "sarah@gurubhet.com"
#     },
#     "created_at": "2026-03-30T10:30:00Z"
#   }
# ]
```

### Phase 4: Test Role Restrictions

#### 10. Sarah (VERIFIER) Creates Subject

```bash
SARAH_TOKEN="sarah_access_token"

curl -X POST http://localhost:8000/api/v1/subjects \
  -H "Content-Type: application/json" \
  -H "x-access-token: $SARAH_TOKEN" \
  -d '{
    "name": "Mathematics",
    "level": "CLASS_10",
    "board": "NEB"
  }'

# ✅ Works! Sarah is VERIFIER
# Response:
# {
#   "id": "750e8400-e29b-41d4-a716-446655440001",
#   "name": "Mathematics",
#   "level": "CLASS_10",
#   "board": "NEB",
#   "is_active": true,
#   "created_at": "2026-03-30T10:35:00Z"
# }

# Audit log created:
# action_type: SUBJECT_CREATED
# actor_id: 550e8400-e29b-41d4-a716-446655440001 (Sarah)
# target_resource_type: Subject
# target_resource_id: 750e8400-e29b-41d4-a716-446655440001
```

#### 11. Raj (FINANCE) Tries to Create Subject

```bash
RAJ_TOKEN="raj_access_token"

curl -X POST http://localhost:8000/api/v1/subjects \
  -H "Content-Type: application/json" \
  -H "x-access-token: $RAJ_TOKEN" \
  -d '{
    "name": "Science",
    "level": "CLASS_10",
    "board": "NEB"
  }'

# ❌ Error! Raj is FINANCE, not VERIFIER
# Response:
# {
#   "detail": "Requires one of admin roles: VERIFIER, SUPER_ADMIN"
# }
```

### Phase 5: Admin Management

#### 12. Update Sarah's Role (Superuser Only)

```bash
SUPERUSER_TOKEN="your_token"

curl -X PATCH "http://localhost:8000/api/v1/admin/admins/550e8400-e29b-41d4-a716-446655440001" \
  -H "Content-Type: application/json" \
  -H "x-access-token: $SUPERUSER_TOKEN" \
  -d '{
    "admin_role": "SUPER_ADMIN"
  }'

# Response:
# {
#   "id": "550e8400-e29b-41d4-a716-446655440001",
#   "first_name": "Sarah",
#   "last_name": "Verifier",
#   "email": "sarah@gurubhet.com",
#   "is_staff": true,
#   "admin_role": "SUPER_ADMIN",  # Changed!
#   "is_active": true,
#   "created_at": "2026-03-30T10:30:00Z"
# }

# Audit log created:
# action_type: ADMIN_UPDATED
# description: "Updated admin: sarah@gurubhet.com"
# metadata: {
#   "admin_role": {
#     "from": "VERIFIER",
#     "to": "SUPER_ADMIN"
#   }
# }
```

#### 13. Deactivate Raj (Superuser Only)

```bash
curl -X DELETE "http://localhost:8000/api/v1/admin/admins/550e8400-e29b-41d4-a716-446655440002" \
  -H "x-access-token: $SUPERUSER_TOKEN"

# ✅ Deleted (soft delete - deactivated)
# Status: 204 No Content

# Audit log created:
# action_type: ADMIN_DEACTIVATED
# description: "Deactivated FINANCE admin: raj@gurubhet.com"
```

#### 14. Verify Raj is Deactivated

```bash
curl -X GET "http://localhost:8000/api/v1/admin/admins/550e8400-e29b-41d4-a716-446655440002" \
  -H "x-access-token: $SUPERUSER_TOKEN"

# Response:
# {
#   "id": "550e8400-e29b-41d4-a716-446655440002",
#   "first_name": "Raj",
#   "last_name": "Finance",
#   "email": "raj@gurubhet.com",
#   "is_staff": true,
#   "admin_role": "FINANCE",
#   "is_active": false,  # No longer active!
#   "created_at": "2026-03-30T10:30:05Z"
# }
```

### Phase 6: Security Verification

#### 15. Verify Audit Trail Completeness

```bash
# All actions are logged
curl -X GET "http://localhost:8000/api/v1/admin/audit-logs" \
  -H "x-access-token: $SUPERUSER_TOKEN"

# Shows:
# - Admin creation (Sarah, Raj, Priya)
# - Admin update (Sarah's role change)
# - Admin deactivation (Raj)
# - Subject creation (Mathematics by Sarah)
# - Attempted unauthorized action (Raj creating subject)

# Each with:
# - Who did it (actor_id)
# - What they did (action_type)
# - Who was affected (target_user_id)
# - When (created_at)
# - Where from (ip_address)
# - Extra context (metadata)
```

#### 16. Try Unauthorized Access

```bash
# Priya (SUPPORT) tries to access subject verification
PRIYA_TOKEN="priya_access_token"

curl -X POST http://localhost:8000/api/v1/subjects \
  -H "x-access-token: $PRIYA_TOKEN" \
  -d '{"name":"Test","level":"CLASS_10"}'

# ❌ Error:
# {
#   "detail": "Requires one of admin roles: VERIFIER, SUPER_ADMIN"
# }

# Note: Even failed attempts may be logged depending on endpoint
```

## Summary

This complete workflow demonstrates:

✅ **Bootstrap**: Created superuser from scratch
✅ **Hierarchy**: Created admins with different roles
✅ **Access Control**: Tested role restrictions
✅ **Audit Trail**: All actions recorded with context
✅ **Management**: Updated and deactivated admins
✅ **Security**: Verified least privilege in action

## Key Takeaways

1. **Superuser** - Created once, used only for setup
2. **Role-Based** - Each admin has specific permissions
3. **Audit Trail** - Complete history of all actions
4. **Least Privilege** - VERIFIER can't see payments, FINANCE can't verify
5. **Soft Delete** - Admins are deactivated, not deleted
6. **Immutable** - Audit logs cannot be modified

## Production Readiness Checklist

- [x] Code implemented
- [x] Models created
- [x] Endpoints created
- [x] Audit logging added
- [x] CLI tool created
- [x] Documentation complete
- [ ] Database migrated (you do this)
- [ ] Superuser created (you do this)
- [ ] Admins created (you do this)
- [ ] Testing completed (you do this)
- [ ] Deployed (you do this)

---

**This workflow is ready to execute now!**
