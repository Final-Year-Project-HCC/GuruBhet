# RBAC System - Detailed Explanation

## Table of Contents

1. [The Concept](#the-concept)
2. [Superuser (Owner Account)](#superuser-owner-account)
3. [Admin Roles & Hierarchy](#admin-roles--hierarchy)
4. [Admin Creation Process](#admin-creation-process)
5. [Permissions System](#permissions-system)
6. [Practical Examples](#practical-examples)
7. [Security Mechanisms](#security-mechanisms)

---

## The Concept

The RBAC system is built on the principle of **"The Power Pyramid"** - a hierarchical structure where:

- **Top**: One superuser (you, the owner)
- **Middle**: Multiple admins with specific roles
- **Bottom**: Regular users (students and teachers)

This design ensures:

- ✅ Clear accountability (one person at top)
- ✅ Distributed responsibility (admins handle specific tasks)
- ✅ Security through separation (roles can't cross over)
- ✅ Audit trail (every action tracked)

---

## Superuser (Owner Account)

### What is a Superuser?

A **superuser** is the root/owner account with absolute control over the platform. There should be **exactly ONE superuser** - you (the platform owner).

### Database Representation

```python
# In the users table
User(
    email='you@gurubhet.com',
    role=UserRole.STUDENT,        # Not TEACHER (staff don't use main roles)
    is_superuser=True,             # 🔑 SUPERUSER FLAG
    is_staff=True,                 # Also marked as staff
    admin_role=AdminRole.SUPER_ADMIN  # Highest admin role
)
```

### Key Characteristics

| Aspect              | Details                         |
| ------------------- | ------------------------------- |
| **Count**           | Exactly 1 (you)                 |
| **Creation**        | Direct database or CLI tool     |
| **Purpose**         | Bootstrap, create/manage admins |
| **Daily Use**       | NEVER - except emergencies      |
| **Password**        | Extremely secure, vault-stored  |
| **Login Frequency** | As infrequent as possible       |
| **Deletable**       | NO - cannot deactivate self     |

### How Superuser is Created

#### Option 1: Using CLI Tool (Easiest)

```bash
python admin_cli.py create-superuser
```

Interactive prompts:

```
=== GuruBhet Superuser Creation ===

First name: Your
Last name: Name
Email address: you@gurubhet.com
Password (min 8 chars, 1 uppercase, 1 digit): SecurePass123
Confirm password: SecurePass123

✅ Superuser created successfully!
   Email: you@gurubhet.com
   ID: 550e8400-e29b-41d4-a716-446655440000
```

#### Option 2: Direct SQL (For Production/Docker)

```sql
-- First, generate password hash in Python:
-- python -c "from app.core.security import hash_password; print(hash_password('YourPass123'))"

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
    '$argon2id$v=19$m=65540,t=3,p=4$...',  -- Hashed password
    'STUDENT',
    true,
    true,
    false,
    true,      -- ← is_superuser = TRUE
    true,      -- ← is_staff = TRUE
    'SUPER_ADMIN',
    NOW(),
    NOW()
);
```

### Superuser Permissions

Superuser can:

- ✅ Create new admin staff members
- ✅ Update admin roles
- ✅ Deactivate admin accounts
- ✅ View all audit logs
- ✅ Access everything (fallback)
- ❌ Create other superusers (only you)
- ❌ Delete anything permanently (soft delete only)

### What Superuser CANNOT Do

Superuser intentionally CANNOT:

- ❌ Deactivate their own account (prevent lockout)
- ❌ Hard delete users (preserves audit trail)
- ❌ Bypass password requirements
- ❌ Skip audit logging

### Why NOT Use Superuser Daily?

If you use superuser daily:

- 🚨 High-value target for attacks
- 🚨 Single point of failure
- 🚨 Can't trace responsibility (why did THIS happen?)
- 🚨 Password exposure = full system compromise

**Instead**: Create role-specific admins and use those.

---

## Admin Roles & Hierarchy

### Four Admin Roles

The system has exactly **4 admin roles**, each with specific responsibilities:

#### 1. SUPER_ADMIN (Rarely Used)

```python
admin_role = AdminRole.SUPER_ADMIN
permissions = {
    'create_admins': True,
    'verify_teachers': True,
    'manage_payments': True,
    'handle_reports': True,
    'view_audit_logs': True,
    'deactivate_admins': True,
}
```

**Who**: Designated senior admin (if needed)
**When**: When superuser unavailable
**Count**: 0-1 (usually just superuser)

#### 2. VERIFIER

```python
admin_role = AdminRole.VERIFIER
permissions = {
    'verify_teachers': True,
    'manage_subjects': True,
    'view_audit_logs': True,
    'view_pending_teachers': True,
}
```

**Who**: Teacher verification team lead
**Task**: Approve/reject teacher documents and manage subject catalog
**Examples**: John (verifier@gurubhet.com), Sarah (sarah@gurubhet.com)

#### 3. FINANCE

```python
admin_role = AdminRole.FINANCE
permissions = {
    'manage_payments': True,
    'process_payouts': True,
    'view_payment_transactions': True,
    'view_audit_logs': True,
}
```

**Who**: Finance/accounting team
**Task**: Handle escrow payments, process teacher payouts
**Examples**: Raj (finance@gurubhet.com), Priya (accounting@gurubhet.com)

#### 4. SUPPORT

```python
admin_role = AdminRole.SUPPORT
permissions = {
    'view_reports': True,
    'ban_users': True,
    'handle_user_disputes': True,
    'view_audit_logs': True,
}
```

**Who**: Customer support team lead
**Task**: Handle user reports, ban abusive users, manage disputes
**Examples**: Mike (support@gurubhet.com), Lisa (moderation@gurubhet.com)

### Why This Separation?

```
Why not give everyone admin access?

❌ WRONG: One admin sees everything (payments, docs, reports)
         If hacked: entire system compromised
         If dishonest: can steal money, approve fake teachers, ban rivals

✅ RIGHT: VERIFIER can't see payments
         FINANCE can't approve teachers
         SUPPORT can't access financial data
         Even if one account hacked: limited damage
```

### Role Comparison Table

```
┌──────────────────┬─────────────┬──────────┬─────────┬─────────┐
│ Action           │ SUPER_ADMIN │ VERIFIER │ FINANCE │ SUPPORT │
├──────────────────┼─────────────┼──────────┼─────────┼─────────┤
│ Verify teachers  │     ✅      │    ✅    │   ❌    │   ❌    │
│ Manage subjects  │     ✅      │    ✅    │   ❌    │   ❌    │
│ Manage payments  │     ✅      │    ❌    │   ✅    │   ❌    │
│ Process payouts  │     ✅      │    ❌    │   ✅    │   ❌    │
│ View reports     │     ✅      │    ❌    │   ❌    │   ✅    │
│ Ban users        │     ✅      │    ❌    │   ❌    │   ✅    │
│ Create admins    │     ✅      │    ❌    │   ❌    │   ❌    │
│ View audit logs  │     ✅      │    ✅    │   ✅    │   ✅    │
└──────────────────┴─────────────┴──────────┴─────────┴─────────┘
```

---

## Admin Creation Process

### Step 1: Superuser Creates Admin

Only the superuser can create new admin accounts.

#### Via CLI

```bash
python admin_cli.py create-admin \
  --email john@gurubhet.com \
  --role VERIFIER \
  --password VerifierPass123
```

#### Via API

```bash
# First, login as superuser
curl -X POST http://localhost:8000/api/v1/auth/login \
  -d '{"email":"you@gurubhet.com","password":"YourPass123"}'
# Get token from response → TOKEN="..."

# Create admin
curl -X POST http://localhost:8000/api/v1/admin/admins \
  -H "Content-Type: application/json" \
  -H "x-access-token: $TOKEN" \
  -d '{
    "first_name": "John",
    "last_name": "Verifier",
    "email": "john@gurubhet.com",
    "admin_role": "VERIFIER",
    "password": "VerifierPass123"
  }'
```

### Step 2: Admin Account Created

```python
# New user record created:
User(
    id='550e8400-...',
    first_name='John',
    last_name='Verifier',
    email='john@gurubhet.com',
    password_hash='$argon2id$...',  # Hashed
    role=UserRole.STUDENT,           # Not part of main role system
    is_staff=True,                   # ← STAFF FLAG
    admin_role=AdminRole.VERIFIER,   # ← SPECIFIC ROLE
    is_superuser=False,              # ← NOT SUPERUSER
    is_active=True
)
```

### Step 3: Audit Log Created

```python
# Automatically logged:
AuditLog(
    action_type=AuditActionType.ADMIN_CREATED,
    description='Created VERIFIER admin: john@gurubhet.com',
    actor_id='550e8400-...',  # Superuser's ID
    target_user_id='550e8400-...',  # New admin's ID
    target_resource_type='Admin',
    ip_address='192.168.1.100',
    user_agent='curl/7.68.0',
    metadata={
        'admin_role': 'VERIFIER',
        'email': 'john@gurubhet.com'
    },
    created_at=datetime.now()
)
```

### Step 4: New Admin Can Login

John can now login:

```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -d '{"email":"john@gurubhet.com","password":"VerifierPass123"}'
```

And access his endpoints (subject verification only).

### Step 5: Admin Updates

Superuser can later update admin role:

```bash
curl -X PATCH http://localhost:8000/api/v1/admin/admins/{admin_id} \
  -H "x-access-token: $SUPERUSER_TOKEN" \
  -d '{"admin_role":"FINANCE"}'
```

Audit log created:

```python
AuditLog(
    action_type=AuditActionType.ADMIN_UPDATED,
    description='Updated admin: john@gurubhet.com',
    metadata={
        'admin_role': {
            'from': 'VERIFIER',
            'to': 'FINANCE'
        }
    },
    ...
)
```

### Step 6: Admin Deactivation

Superuser can deactivate (not delete):

```bash
curl -X DELETE http://localhost:8000/api/v1/admin/admins/{admin_id} \
  -H "x-access-token: $SUPERUSER_TOKEN"
```

Result:

```python
user.is_active = False  # Soft delete
# Still in database, audit logs preserved
```

---

## Permissions System

### How It Works

Each endpoint is protected by decorators:

```python
# Endpoints and their protections
@router.post("/subjects")
async def create_subject(
    body: SubjectCreate,
    current_user: CurrentUser,
    db: DbSession,
    _=RequireVerifier  # ← Only VERIFIER or SUPER_ADMIN
):
    # Create subject
    await log_audit(...)

@router.post("/payments/release")
async def release_payment(
    _=RequireFinance  # ← Only FINANCE or SUPER_ADMIN
):
    # Release payment

@router.post("/users/{user_id}/ban")
async def ban_user(
    _=RequireSupport  # ← Only SUPPORT or SUPER_ADMIN
):
    # Ban user
```

### What Happens When You Try Unauthorized Access?

```python
# VERIFIER tries to access FINANCE endpoint
curl -X POST http://localhost:8000/api/v1/payments/release \
  -H "x-access-token: $VERIFIER_TOKEN" \
  -d '{"amount": 1000, "teacher_id": "..."}'

# Response:
{
    "detail": "Requires one of admin roles: FINANCE, SUPER_ADMIN"
}
# Status: 403 Forbidden
```

### Code-Level Permission Checking

```python
# In dependencies.py
def require_admin_role(*roles: AdminRole):
    async def _guard(current_user: CurrentUser) -> User:
        # Check 1: Is staff member?
        if not current_user.is_staff:
            raise HTTPException(403, "Staff access required")

        # Check 2: Has required role?
        if current_user.admin_role not in roles:
            raise HTTPException(
                403,
                f"Requires: {[r.value for r in roles]}"
            )

        return current_user
    return _guard

# Usage:
RequireVerifier = Depends(require_admin_role(
    AdminRole.VERIFIER,
    AdminRole.SUPER_ADMIN  # Always include superuser fallback
))
```

---

## Practical Examples

### Scenario 1: Launch Day Setup

**You (Superuser)** are launching GuruBhet. You need to set up admins.

```bash
# 1. Create yourself as superuser
python admin_cli.py create-superuser
# Email: you@gurubhet.com
# Password: VerySecurePass123

# 2. Create teacher verification lead
python admin_cli.py create-admin \
  --email sarah@gurubhet.com \
  --role VERIFIER

# 3. Create finance manager
python admin_cli.py create-admin \
  --email raj@gurubhet.com \
  --role FINANCE

# 4. Create support lead
python admin_cli.py create-admin \
  --email priya@gurubhet.com \
  --role SUPPORT
```

Database now has:

```
┌─────────────────────────────────────────┐
│ users table                              │
├─────────────┬────────────────┬──────────┤
│ Email       │ admin_role     │ is_staff │
├─────────────┼────────────────┼──────────┤
│ you@...     │ SUPER_ADMIN    │ true     │
│ sarah@...   │ VERIFIER       │ true     │
│ raj@...     │ FINANCE        │ true     │
│ priya@...   │ SUPPORT        │ true     │
└─────────────┴────────────────┴──────────┘
```

### Scenario 2: Sarah (VERIFIER) Verifies Teacher

Sarah logs in and verifies teachers:

```bash
# Sarah logs in
curl -X POST http://localhost:8000/api/v1/auth/login \
  -d '{"email":"sarah@gurubhet.com","password":"..."}'
# Gets token

# Verifies teacher
curl -X POST http://localhost:8000/api/v1/admin/teachers/abc-123/verify \
  -H "x-access-token: $SARAH_TOKEN" \
  -d '{"status":"APPROVED"}'

# ✅ Works! Audit log created:
# action_type: TEACHER_VERIFIED
# actor_id: sarah's ID
# description: Verified teacher ABC-123
```

Sarah tries to see payment details:

```bash
curl http://localhost:8000/api/v1/admin/payments \
  -H "x-access-token: $SARAH_TOKEN"

# ❌ Error: 403 Forbidden
# "Requires one of admin roles: FINANCE, SUPER_ADMIN"
```

**Result**: Sarah can only verify teachers, nothing else.

### Scenario 3: Raj (FINANCE) Processes Payouts

Raj logs in and processes payouts:

```bash
# Raj logs in
curl -X POST http://localhost:8000/api/v1/auth/login \
  -d '{"email":"raj@gurubhet.com","password":"..."}'
# Gets token

# Processes payout
curl -X POST http://localhost:8000/api/v1/admin/payouts/process \
  -H "x-access-token: $RAJ_TOKEN" \
  -d '{"teacher_id":"...", "amount":5000}'

# ✅ Works! Audit log created:
# action_type: ESCROW_RELEASED
# actor_id: raj's ID
# description: Released $5000 to teacher XYZ
```

Raj tries to verify teacher:

```bash
curl -X POST http://localhost:8000/api/v1/admin/teachers/abc/verify \
  -H "x-access-token: $RAJ_TOKEN" \
  -d '{"status":"APPROVED"}'

# ❌ Error: 403 Forbidden
# "Requires one of admin roles: VERIFIER, SUPER_ADMIN"
```

**Result**: Raj can only manage payments, nothing else.

### Scenario 4: Audit Trail

Superuser reviews audit logs:

```bash
# You (superuser) login
curl -X POST http://localhost:8000/api/v1/auth/login \
  -d '{"email":"you@gurubhet.com","password":"VerySecurePass123"}'
# Gets token

# View all audit logs
curl "http://localhost:8000/api/v1/admin/audit-logs?limit=50" \
  -H "x-access-token: $YOUR_TOKEN"

# Response (formatted):
[
  {
    "id": "...",
    "action_type": "TEACHER_VERIFIED",
    "actor_id": "sarah's ID",  # ← Sarah did this
    "description": "Verified teacher XYZ",
    "created_at": "2026-03-30T14:30:00Z",
    "ip_address": "192.168.1.50"  # ← From this IP
  },
  {
    "id": "...",
    "action_type": "ESCROW_RELEASED",
    "actor_id": "raj's ID",  # ← Raj did this
    "description": "Released $5000 to teacher ABC",
    "created_at": "2026-03-30T14:25:00Z",
    "ip_address": "192.168.1.51"  # ← From this IP
  },
  {
    "id": "...",
    "action_type": "ADMIN_CREATED",
    "actor_id": "your ID",  # ← You did this
    "description": "Created SUPPORT admin: priya@...",
    "created_at": "2026-03-30T13:00:00Z",
    "ip_address": "192.168.1.100"
  }
]
```

**Result**: Complete transparency. You see exactly who did what, when, and where.

---

## Security Mechanisms

### 1. Password Hashing

All passwords hashed with **Argon2**:

```python
# When superuser created with password "SecurePass123":
password_hash = "$argon2id$v=19$m=65540,t=3,p=4$xxxxxx$yyyyyyy"
# Stored in database, not the actual password

# When logging in:
verify_password("SecurePass123", password_hash) → True/False
# Password is never stored plain text
```

### 2. Token-Based Authentication

```python
# Step 1: Login returns tokens
{
  "message": "Logged in successfully"
  # Access token in cookie (httponly)
  # Refresh token in cookie (httponly)
}

# Step 2: Make requests with token
curl http://localhost:8000/api/v1/admin/admins \
  -H "x-access-token: $TOKEN"
# Token is validated on every request

# Step 3: Token expires (30 minutes for access)
# Use refresh token to get new access token
curl -X POST http://localhost:8000/api/v1/auth/refresh \
  -H "x-refresh-token: $REFRESH_TOKEN"
```

### 3. Least Privilege

```python
# VERIFIER can only verify teachers
# If VERIFIER account compromised:
# ❌ Can't access payments
# ❌ Can't ban users
# ❌ Can't create admins
# ✅ Can only approve/reject teachers

# Compare to old system where all admins had full access
```

### 4. Immutable Audit Trail

```python
# Audit logs CANNOT be modified or deleted
# Only view them

# What you CAN'T do:
DELETE FROM audit_logs WHERE id = '...';  # ❌ Won't work
UPDATE audit_logs SET action_type = 'OTHER';  # ❌ Won't work

# This ensures:
# - No cover-ups possible
# - Complete responsibility trail
# - Forensic investigation possible
```

### 5. No Hard Deletes

```python
# Admin deactivation (soft delete):
UPDATE users SET is_active = false WHERE id = '...';

# Result:
# ✅ Admin can't login anymore
# ✅ All audit logs preserved
# ✅ Can be reactivated if needed
# ✅ Complete history remains

# What DOESN'T happen:
# ❌ Data deleted from database
# ❌ Audit logs disappear
# ❌ Can't trace what they did
```

---

## Summary

### Superuser

- 🔑 **Count**: Exactly 1 (you)
- 🔑 **Created**: Via CLI or direct SQL (not API)
- 🔑 **Use**: Bootstrap only, then almost never
- 🔑 **Power**: Full system access
- 🔑 **Password**: Vault-stored, extremely secure

### Admins

- 📋 **Count**: Many (1-100+)
- 📋 **Created**: By superuser via API or CLI
- 📋 **Use**: Daily work (verify, payment, support)
- 📋 **Power**: Role-specific (least privilege)
- 📋 **Password**: Secure, rotated monthly

### Permissions

- ✅ **VERIFIER**: Verify teachers, manage subjects
- ✅ **FINANCE**: Manage payments, process payouts
- ✅ **SUPPORT**: Handle reports, ban users
- ✅ **SUPER_ADMIN**: Everything (rarely used)

### Security

- 🔒 **Password**: Argon2 hashed
- 🔒 **Tokens**: JWT-based, expiring
- 🔒 **Least Privilege**: Role-specific permissions
- 🔒 **Audit Trail**: Every action logged, immutable
- 🔒 **Soft Delete**: Preserve history

This system ensures that even if one admin account is compromised, the damage is limited to their specific role.
