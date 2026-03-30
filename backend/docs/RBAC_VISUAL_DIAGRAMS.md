# RBAC System - Visual Diagrams & Flow Charts

## 1. The Power Pyramid (Complete View)

```
                        ┌──────────────────────────────────┐
                        │  YOU (Superuser)                 │
                        │  is_superuser = True             │
                        │  is_staff = True                 │
                        │  admin_role = SUPER_ADMIN        │
                        │                                  │
                        │  • Bootstrap system              │
                        │  • Create/manage admins          │
                        │  • View all audit logs           │
                        │  • NEVER use for daily tasks     │
                        └──────────────────────────────────┘
                                      │
                                      │ Creates
                                      │
                ┌─────────────────────┼─────────────────────┐
                │                     │                     │
                ▼                     ▼                     ▼
    ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
    │   VERIFIER       │  │    FINANCE       │  │    SUPPORT       │
    │ admin_role       │  │  admin_role      │  │  admin_role      │
    │ is_staff=True    │  │ is_staff=True    │  │ is_staff=True    │
    │                  │  │                  │  │                  │
    │ • Verify         │  │ • Manage         │  │ • View reports   │
    │   teachers       │  │   payments       │  │ • Ban users      │
    │ • Manage         │  │ • Process        │  │ • Handle         │
    │   subjects       │  │   payouts        │  │   disputes       │
    │ • View logs      │  │ • View logs      │  │ • View logs      │
    └──────────────────┘  └──────────────────┘  └──────────────────┘
                │                     │                     │
                └─────────────────────┼─────────────────────┘
                                      │
                                      │ Audit Everything
                                      ▼
                        ┌──────────────────────────────────┐
                        │      AUDIT_LOGS TABLE            │
                        │                                  │
                        │  • Who did it (actor_id)         │
                        │  • What they did (action_type)   │
                        │  • When (created_at)             │
                        │  • Where from (ip_address)       │
                        │  • What device (user_agent)      │
                        │  • Extra context (metadata)      │
                        │  • Who affected (target_user_id) │
                        │                                  │
                        │  🔒 Immutable (can't delete)    │
                        │  🔒 Complete accountability      │
                        │  🔒 Forensic investigation       │
                        └──────────────────────────────────┘
```

---

## 2. Admin Creation Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         ADMIN CREATION PROCESS                          │
└─────────────────────────────────────────────────────────────────────────┘

                              YOU (Superuser)
                                    │
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
            Via CLI Tool                     Via API
                    │                               │
                    ▼                               ▼
    ┌──────────────────────────────┐   ┌──────────────────────────────┐
    │ python admin_cli.py          │   │ POST /api/v1/admin/admins    │
    │ create-admin                 │   │ Header: x-access-token: ...  │
    │ --email john@test.com        │   │ Body: {                      │
    │ --role VERIFIER              │   │   first_name: "John",        │
    │ --password Pass123           │   │   last_name: "Verifier",     │
    │                              │   │   email: "john@test.com",    │
    │ (interactive prompts)        │   │   admin_role: "VERIFIER",    │
    └──────────────────────────────┘   │   password: "Pass123"        │
                    │                   │ }                            │
                    └───────────────┬───┘
                                    │
                                    ▼
                    ┌──────────────────────────────┐
                    │  Create User Record          │
                    │  ├─ id: UUID generated       │
                    │  ├─ email: john@test.com     │
                    │  ├─ password_hash: (Argon2)  │
                    │  ├─ is_staff: true           │
                    │  ├─ admin_role: VERIFIER     │
                    │  ├─ is_active: true          │
                    │  └─ created_at: now()        │
                    └──────────────────────────────┘
                                    │
                                    ▼
                    ┌──────────────────────────────┐
                    │  Create Audit Log Entry      │
                    │  ├─ action_type: ADMIN_...   │
                    │  ├─ actor_id: your ID        │
                    │  ├─ target_user_id: john_ID  │
                    │  ├─ description: "Created    │
                    │  │   VERIFIER admin..."      │
                    │  ├─ ip_address: 192.168...   │
                    │  ├─ metadata: {...}          │
                    │  └─ created_at: now()        │
                    └──────────────────────────────┘
                                    │
                                    ▼
                    ┌──────────────────────────────┐
                    │   ✅ Admin Created!          │
                    │                              │
                    │  John can now:               │
                    │  • Login with email/password │
                    │  • Verify teachers           │
                    │  • Manage subjects           │
                    │  • View audit logs           │
                    │                              │
                    │  John cannot:                │
                    │  • Access payments           │
                    │  • Create other admins       │
                    │  • Ban users                 │
                    │  • etc (per role)            │
                    └──────────────────────────────┘
```

---

## 3. Permission Checking Flow (Request Time)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    PERMISSION CHECK ON EVERY REQUEST                    │
└─────────────────────────────────────────────────────────────────────────┘

Request to Endpoint:
POST /api/v1/subjects (requires VERIFIER)
Header: x-access-token: $TOKEN

                                    │
                                    ▼
                    ┌──────────────────────────────┐
                    │  Extract token from header   │
                    │  x-access-token: $TOKEN      │
                    └──────────────────────────────┘
                                    │
                                    ▼
                    ┌──────────────────────────────┐
                    │  Decode & validate token     │
                    │  (JWT signature check)       │
                    │  Is it expired?              │
                    │  Is it valid?                │
                    └──────────────────────────────┘
                                    │
                                    ├─ Token Invalid? ──→ 401 Unauthorized
                                    │
                                    ▼
                    ┌──────────────────────────────┐
                    │  Get user from token         │
                    │  user_id from token payload  │
                    │  Look up user in database    │
                    └──────────────────────────────┘
                                    │
                                    ├─ User not found? ──→ 401 Unauthorized
                                    │
                                    ▼
                    ┌──────────────────────────────┐
                    │  Check is_active             │
                    │  Is account active?          │
                    └──────────────────────────────┘
                                    │
                                    ├─ Inactive? ──────→ 401 Unauthorized
                                    │
                                    ▼
                    ┌──────────────────────────────┐
                    │  CHECK: @RequireVerifier     │
                    │                              │
                    │  1. Is user is_staff?        │
                    │  2. Is admin_role in         │
                    │     [VERIFIER, SUPER_ADMIN]? │
                    └──────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
             ✅ YES (All checks pass)        ❌ NO (Failed checks)
                    │                               │
                    ▼                               ▼
        ┌──────────────────────────┐   ┌──────────────────────────┐
        │  Execute endpoint logic  │   │  403 Forbidden           │
        │  Create subject          │   │                          │
        │  Log audit entry         │   │  "Requires admin role:   │
        │  Return 201 Created      │   │   VERIFIER"              │
        └──────────────────────────┘   └──────────────────────────┘
```

---

## 4. Login & Token Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      LOGIN & TOKEN GENERATION                           │
└─────────────────────────────────────────────────────────────────────────┘

User (Admin): POST /api/v1/auth/login
Body: {email: "john@test.com", password: "Pass123"}

                                    │
                                    ▼
                    ┌──────────────────────────────┐
                    │  Find user by email          │
                    │  Look in users table         │
                    └──────────────────────────────┘
                                    │
                                    ├─ Not found? ──→ 401 "Invalid credentials"
                                    │
                                    ▼
                    ┌──────────────────────────────┐
                    │  Verify password             │
                    │  Plain password "Pass123"    │
                    │  Compare to hash in DB       │
                    │  Using Argon2                │
                    └──────────────────────────────┘
                                    │
                                    ├─ Wrong? ──────→ 401 "Invalid credentials"
                                    │
                                    ▼
                    ┌──────────────────────────────┐
                    │  Check is_active             │
                    │  Check is_banned             │
                    └──────────────────────────────┘
                                    │
                                    ├─ Inactive/Banned? ──→ 403 "Account inactive"
                                    │
                                    ▼
                    ┌──────────────────────────────┐
                    │  Generate Access Token       │
                    │  • Expires in: 30 minutes    │
                    │  • Contains: user_id, role   │
                    │  • Contains: type: "access"  │
                    │  • Signed with: SECRET_KEY   │
                    │  Example payload:            │
                    │  {                           │
                    │    "sub": "john_user_id",    │
                    │    "role": "VERIFIER",       │
                    │    "type": "access",         │
                    │    "exp": 1711800000,        │
                    │    "iat": 1711796400         │
                    │  }                           │
                    └──────────────────────────────┘
                                    │
                                    ▼
                    ┌──────────────────────────────┐
                    │  Generate Refresh Token      │
                    │  • Expires in: 7 days        │
                    │  • Contains: user_id only    │
                    │  • Contains: type: "refresh" │
                    │  • Signed with: SECRET_KEY   │
                    │  Example payload:            │
                    │  {                           │
                    │    "sub": "john_user_id",    │
                    │    "type": "refresh",        │
                    │    "exp": 1712400000,        │
                    │    "iat": 1711796400         │
                    │  }                           │
                    └──────────────────────────────┘
                                    │
                                    ▼
                    ┌──────────────────────────────┐
                    │  Set Cookies (HttpOnly)      │
                    │                              │
                    │  access_token:               │
                    │  • Value: eyJhbGc... (JWT)   │
                    │  • HttpOnly: true (JS can't) │
                    │  • Path: /                   │
                    │  • Max-Age: 30 min           │
                    │                              │
                    │  refresh_token:              │
                    │  • Value: eyJhbGc... (JWT)   │
                    │  • HttpOnly: true (JS can't) │
                    │  • Path: /api/v1/auth        │
                    │  • Max-Age: 7 days           │
                    └──────────────────────────────┘
                                    │
                                    ▼
                    ┌──────────────────────────────┐
                    │  ✅ Login Successful!        │
                    │                              │
                    │  Response:                   │
                    │  {                           │
                    │    "message": "Logged in..." │
                    │  }                           │
                    │                              │
                    │  Cookies set in browser:     │
                    │  • access_token = JWT        │
                    │  • refresh_token = JWT       │
                    │                              │
                    │  From now on, browser sends: │
                    │  Cookie: access_token=JWT    │
                    │  with every request          │
                    └──────────────────────────────┘
```

---

## 5. Audit Logging Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         AUDIT LOGGING ON ACTION                         │
└─────────────────────────────────────────────────────────────────────────┘

Admin Action: Verify Teacher
POST /api/v1/admin/teachers/abc-123/verify
Header: x-access-token: $SARAH_TOKEN (VERIFIER)
Body: {status: "APPROVED"}

                                    │
                                    ▼
                    ┌──────────────────────────────┐
                    │  Check permissions           │
                    │  (pass RequireVerifier)      │
                    └──────────────────────────────┘
                                    │
                                    ▼
                    ┌──────────────────────────────┐
                    │  Verify teacher (business    │
                    │  logic)                      │
                    │  Update teacher status       │
                    │  Update teacher verification │
                    └──────────────────────────────┘
                                    │
                                    ▼
                    ┌──────────────────────────────┐
                    │  Call log_audit():           │
                    │                              │
                    │  await log_audit(            │
                    │    db,                       │
                    │    AuditActionType.          │
                    │      TEACHER_VERIFIED,       │
                    │    current_user,  ← Sarah    │
                    │    "Verified teacher ABC",   │
                    │    target_user_id=teacher_id │
                    │  )                           │
                    └──────────────────────────────┘
                                    │
                                    ▼
                    ┌──────────────────────────────┐
                    │  Create AuditLog record:     │
                    │                              │
                    │  action_type:                │
                    │  TEACHER_VERIFIED            │
                    │                              │
                    │  actor_id:                   │
                    │  sarah's user ID             │
                    │                              │
                    │  description:                │
                    │  "Verified teacher ABC"      │
                    │                              │
                    │  target_user_id:             │
                    │  teacher's user ID           │
                    │                              │
                    │  target_resource_type:       │
                    │  "Teacher"                   │
                    │                              │
                    │  ip_address:                 │
                    │  192.168.1.50 (extracted)    │
                    │                              │
                    │  user_agent:                 │
                    │  "Mozilla/5.0..." (extracted)│
                    │                              │
                    │  metadata:                   │
                    │  {                           │
                    │    "old_status": "PENDING",  │
                    │    "new_status": "APPROVED"  │
                    │  }                           │
                    │                              │
                    │  created_at:                 │
                    │  datetime.now()              │
                    └──────────────────────────────┘
                                    │
                                    ▼
                    ┌──────────────────────────────┐
                    │  Save to audit_logs table    │
                    │                              │
                    │  INSERT INTO audit_logs      │
                    │  (id, action_type, actor_id, │
                    │   description, ...)          │
                    │  VALUES (...)                │
                    └──────────────────────────────┘
                                    │
                                    ▼
                    ┌──────────────────────────────┐
                    │  Commit transaction          │
                    │  await db.commit()           │
                    └──────────────────────────────┘
                                    │
                                    ▼
                    ┌──────────────────────────────┐
                    │  Return 200 OK               │
                    │  Teacher verified!           │
                    │                              │
                    │  Audit log created           │
                    │  (immutable record)          │
                    └──────────────────────────────┘
```

---

## 6. Database Schema Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          USERS TABLE                                    │
├──────────────────┬──────────────┬─────────────────────────────────────┤
│ Column           │ Type         │ Notes                               │
├──────────────────┼──────────────┼─────────────────────────────────────┤
│ id               │ UUID         │ Primary key                         │
│ email            │ String(255)  │ Unique, indexed                     │
│ password_hash    │ String(255)  │ Argon2 hashed                       │
│ role             │ Enum         │ STUDENT | TEACHER                   │
│ is_active        │ Boolean      │ For soft deletes                    │
│ is_banned        │ Boolean      │ For banning users                   │
│ is_superuser     │ Boolean      │ 🔑 True for owner only              │
│ is_staff         │ Boolean      │ 🔑 True if admin                    │
│ admin_role       │ Enum         │ 🔑 VERIFIER | FINANCE | SUPPORT     │
│ first_name       │ String(100)  │                                     │
│ last_name        │ String(100)  │                                     │
│ created_at       │ DateTime(TZ) │ Indexed                             │
│ updated_at       │ DateTime(TZ) │                                     │
└──────────────────┴──────────────┴─────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                      AUDIT_LOGS TABLE (NEW)                             │
├──────────────────────┬──────────────┬──────────────────────────────────┤
│ Column               │ Type         │ Notes                            │
├──────────────────────┼──────────────┼──────────────────────────────────┤
│ id                   │ UUID         │ Primary key                      │
│ action_type          │ Enum         │ What happened (indexed)          │
│ description          │ Text         │ Human-readable                   │
│ actor_id             │ UUID FK      │ Who did it (indexed)             │
│ target_user_id       │ UUID         │ Who was affected (indexed)       │
│ target_resource_type │ String(100)  │ What type (Teacher, Booking...)  │
│ target_resource_id   │ UUID         │ ID of affected resource          │
│ ip_address           │ String(50)   │ Where from                       │
│ user_agent           │ String(500)  │ What device/browser              │
│ metadata             │ JSON         │ Extra context (before/after...)  │
│ created_at           │ DateTime(TZ) │ When (indexed)                   │
└──────────────────────┴──────────────┴──────────────────────────────────┘

Relationships:
  audit_logs.actor_id FK→ users.id
  (Who performed the action)
```

---

## 7. Admin State Transitions

```
┌──────────────────┐
│  Admin Created   │ (is_active=true)
│  is_active=true  │
└────────┬─────────┘
         │
         │ Can login, use endpoint
         │ Has full role permissions
         │
         ├──→ Update role ──→ ┌──────────────────────┐
         │                    │ Role Changed         │
         │                    │ e.g., VERIFIER→...   │
         │                    │ is_active still true │
         │                    │ Can login, new perms  │
         │                    └──────────────────────┘
         │
         └──→ Deactivate ──→ ┌──────────────────────┐
                             │ Admin Deactivated    │
                             │ is_active=false      │
                             │ Cannot login anymore │
                             │ Still in DB (not del)│
                             │ History preserved    │
                             └──────────────────────┘

Note: Hard delete NEVER happens. Soft delete preserves:
  ✅ Audit trail (who did what)
  ✅ Historical data (what was changed)
  ✅ Forensic investigation (review past actions)
```

---

## 8. Access Control Decision Tree

```
User makes request to protected endpoint
                    │
                    ▼
        ┌───────────────────────┐
        │ Token provided?       │
        └───────────┬───────────┘
                    │
            ┌───────┴────────┐
            │                │
           NO               YES
            │                │
            ▼                ▼
        401            ┌──────────────────┐
        Unauth         │ Token valid?      │
                       │ Not expired?      │
                       └────────┬──────────┘
                                │
                        ┌───────┴────────┐
                        │                │
                       NO               YES
                        │                │
                        ▼                ▼
                    401              ┌──────────────────┐
                    Unauth           │ User exists?     │
                                     │ is_active?       │
                                     └────────┬─────────┘
                                              │
                                      ┌───────┴─────────┐
                                      │                 │
                                     NO               YES
                                      │                 │
                                      ▼                 ▼
                                  401                ┌────────────────────┐
                                  Unauth             │ Endpoint requires  │
                                                     │ specific role?     │
                                                     └────────┬───────────┘
                                                              │
                                                      ┌───────┴──────────┐
                                                      │                  │
                                                     NO                YES
                                                      │                  │
                                                      ▼                  ▼
                                                  ✅ ALLOW          ┌──────────────────┐
                                                                    │ User has role?   │
                                                                    └────────┬─────────┘
                                                                             │
                                                                     ┌───────┴────────┐
                                                                     │                │
                                                                    NO              YES
                                                                     │                │
                                                                     ▼                ▼
                                                                 403                ✅
                                                                 Forbidden          ALLOW
```

---

## 9. Timeline of Actions

```
Day 1: Platform Launch
├─ 09:00 You create superuser account
│        ├─ INSERT users (is_superuser=true)
│        └─ INSERT audit_logs (SUPERUSER_CREATED)
│
├─ 09:15 You create VERIFIER admin (Sarah)
│        ├─ INSERT users (admin_role=VERIFIER)
│        └─ INSERT audit_logs (ADMIN_CREATED) actor=you
│
├─ 09:30 You create FINANCE admin (Raj)
│        ├─ INSERT users (admin_role=FINANCE)
│        └─ INSERT audit_logs (ADMIN_CREATED) actor=you
│
└─ 09:45 You create SUPPORT admin (Priya)
         ├─ INSERT users (admin_role=SUPPORT)
         └─ INSERT audit_logs (ADMIN_CREATED) actor=you

Day 2: Daily Operations
├─ 10:00 Sarah logs in, verifies teachers
│        ├─ UPDATE teacher_profiles (status=APPROVED)
│        └─ INSERT audit_logs (TEACHER_VERIFIED) actor=sarah
│
├─ 10:30 Raj logs in, processes payouts
│        ├─ UPDATE payouts (status=SENT)
│        └─ INSERT audit_logs (ESCROW_RELEASED) actor=raj
│
└─ 11:00 Priya logs in, bans abusive user
         ├─ UPDATE users (is_banned=true)
         └─ INSERT audit_logs (USER_BANNED) actor=priya

Day 3: Admin Update
├─ 08:00 You discover security issue with Raj
│        ├─ PATCH users SET admin_role=null
│        ├─ PATCH users SET is_active=false
│        └─ INSERT audit_logs (ADMIN_DEACTIVATED) actor=you
│
└─ 08:15 You review audit trail
         ├─ SELECT * FROM audit_logs WHERE actor_id=raj_id
         └─ See all of Raj's actions (2 days of history)
```

This comprehensive visual guide makes it clear how the RBAC system works at every level!
