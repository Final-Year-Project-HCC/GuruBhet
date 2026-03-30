# RBAC Quick Reference Card

## The Hierarchy

```
┌─────────────────────────────────────────┐
│  YOU (Superuser)                        │
│  - is_superuser=True                    │
│  - Only for bootstrap & admin mgmt      │
│  - Use ONLY when necessary              │
└─────────────────────────────────────────┘
              │
              └──> Create/Manage ──> ┌─────────────────────────┐
                                     │  Admin Staff Members    │
                                     │  (is_staff=True)        │
                                     └─────────────────────────┘
                                              │
                            ┌─────────────────┼─────────────────┐
                            │                 │                 │
                    ┌───────▼────────┐ ┌────▼────────┐ ┌───────▼────────┐
                    │  VERIFIER      │ │  FINANCE    │ │   SUPPORT      │
                    │ (admin_role)   │ │(admin_role) │ │ (admin_role)   │
                    └────────────────┘ └─────────────┘ └────────────────┘
                            │                 │                 │
                    ┌───────▼────────────────▼─────────────────▼───────────┐
                    │           Audit Everything They Do                    │
                    │         (audit_logs table)                            │
                    └────────────────────────────────────────────────────────┘
```

## Role Permissions Matrix

| Feature           | SUPER_ADMIN | VERIFIER | FINANCE | SUPPORT |
| ----------------- | :---------: | :------: | :-----: | :-----: |
| Verify Teachers   |     ✅      |    ✅    |   ❌    |   ❌    |
| Manage Subjects   |     ✅      |    ✅    |   ❌    |   ❌    |
| Manage Payments   |     ✅      |    ❌    |   ✅    |   ❌    |
| Process Payouts   |     ✅      |    ❌    |   ✅    |   ❌    |
| View Reports      |     ✅      |    ❌    |   ❌    |   ✅    |
| Ban Users         |     ✅      |    ❌    |   ❌    |   ✅    |
| Create Admins     |     ✅      |    ❌    |   ❌    |   ❌    |
| View Audit Logs   |     ✅      |    ✅    |   ✅    |   ✅    |
| Deactivate Admins |     ✅      |    ❌    |   ❌    |   ❌    |

## Database Fields

### User Table

```python
# Existing
role: UserRole  # STUDENT or TEACHER

# New
is_staff: bool                    # True if admin staff member
admin_role: AdminRole | None      # VERIFIER, FINANCE, SUPPORT, SUPER_ADMIN

# Existing (unchanged)
is_superuser: bool  # True for owner only
```

### Audit Logs Table

```python
action_type: AuditActionType    # What happened
actor_id: UUID                  # Who did it
target_user_id: UUID            # Who affected
target_resource_type: str       # What type (Teacher, Booking, etc)
target_resource_id: UUID        # ID of what
ip_address: str                 # Where from
user_agent: str                 # What device
metadata: dict                  # Extra context
created_at: datetime            # When
```

## Common Commands

### Create Superuser

```bash
python admin_cli.py create-superuser
```

### Create Admin

```bash
python admin_cli.py create-admin --email v@test.com --role VERIFIER
```

### List Admins

```bash
python admin_cli.py list-admins
```

### Deactivate Admin

```bash
python admin_cli.py deactivate-admin --email old@test.com
```

### Login

```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -d '{"email":"admin@test.com","password":"Pass123"}'
```

### Create Admin via API

```bash
curl -X POST http://localhost:8000/api/v1/admin/admins \
  -H "x-access-token: $TOKEN" \
  -d '{
    "first_name":"John",
    "last_name":"Smith",
    "email":"john@test.com",
    "admin_role":"VERIFIER",
    "password":"Pass123"
  }'
```

### View Audit Logs

```bash
curl "http://localhost:8000/api/v1/admin/audit-logs?limit=20" \
  -H "x-access-token: $TOKEN"
```

## Code Decorators/Dependencies

```python
# Check if staff member
from app.core.dependencies import RequireStaff
@router.get("/endpoint", dependencies=[RequireStaff])

# Check specific role
from app.core.dependencies import RequireVerifier
@router.get("/verify", dependencies=[RequireVerifier])

# Check superuser
from app.core.dependencies import RequireSuperuser
@router.post("/admins", dependencies=[RequireSuperuser])

# In function
async def endpoint(current_user: CurrentUser, db: DbSession):
    # current_user.is_staff → bool
    # current_user.admin_role → AdminRole | None
    # current_user.is_superuser → bool
```

## Logging Actions

```python
from app.utils.audit import log_audit
from app.core.enums import AuditActionType

await log_audit(
    db,
    AuditActionType.TEACHER_VERIFIED,
    current_user,  # Who did it
    "Approved teacher John",  # Description
    target_user_id=teacher_id,
    target_resource_type="Teacher",
    target_resource_id=teacher_id,
    ip_address="192.168.1.1",
    metadata={"status": "APPROVED"}
)
```

## Security Do's & Don'ts

### ✅ DO

- Keep superuser password in vault
- Create role-specific admins
- Review audit logs weekly
- Use strong passwords
- Deactivate unused admins
- Monitor failed logins

### ❌ DON'T

- Share superuser password
- Use superuser daily
- Hard delete admins
- Create multiple superusers
- Ignore audit logs
- Use weak passwords
- Grant SUPER_ADMIN casually

## Files Quick Reference

| What           | Where                            |
| -------------- | -------------------------------- |
| Roles          | `/app/core/enums.py`             |
| User Model     | `/app/models/user.py`            |
| Audit Model    | `/app/models/audit_log.py`       |
| Dependencies   | `/app/core/dependencies.py`      |
| Audit Utils    | `/app/utils/audit.py`            |
| Endpoints      | `/app/api/v1/endpoints/admin.py` |
| Schemas        | `/app/schemas/admin.py`          |
| CLI Tool       | `/admin_cli.py`                  |
| Detailed Guide | `/docs/RBAC_SETUP_GUIDE.md`      |

## Error Responses

```python
# Not staff
403: "Staff access required"

# Wrong role
403: "Requires one of admin roles: VERIFIER, SUPER_ADMIN"

# Not superuser
403: "Superuser access required"

# Admin not found
404: "Admin not found"

# Email taken
400: "Email already registered"
```

## Status Codes

```
200 - OK (GET, PATCH)
201 - Created (POST)
204 - No Content (DELETE)
400 - Bad Request
403 - Forbidden (permission denied)
404 - Not Found
409 - Conflict (duplicate)
```

## Remember

1. **Superuser** = Owner bootstrap account
2. **Admin Staff** = Users with is_staff=True
3. **Admin Roles** = Specific permissions (VERIFIER, etc)
4. **Audit** = Every action is logged
5. **Least Privilege** = Minimum permissions per role
6. **No Deletion** = Only deactivation
7. **No Self-Promotion** = Can't create higher roles

---

**Version 1.0 - March 30, 2026**
