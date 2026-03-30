# PostgreSQL Enum Mismatch Fix

## Problem

When creating a booking, you get:

```
invalid input value for enum bookingstatus: "PENDING_APPROVAL"
```

This means the PostgreSQL enum `bookingstatus` doesn't have the values your Python code expects.

## Root Cause

The database enum was likely created with different values than what's currently defined in `app/core/enums.py`:

**Expected values (current code):**

- PENDING_APPROVAL
- PENDING_PAYMENT
- ACTIVE
- COMPLETED
- CANCELLED_BY_STUDENT
- CANCELLED_BY_TEACHER
- DISPUTED

**Database likely has:** (older/different values)

## Solution: Fix the Enum

### ⚠️ IMPORTANT: Alembic Auto-migrations Don't Work for Enums

Alembic's auto-generation **cannot properly handle enum type changes** in PostgreSQL. You need to use **manual SQL**.

### Option 1: Manual SQL Fix (Recommended)

Run this SQL directly in your PostgreSQL database:

```sql
-- Step 1: Drop dependent columns
ALTER TABLE bookings DROP COLUMN IF EXISTS status;

-- Step 2: Drop old enum types
DROP TYPE IF EXISTS bookingstatus CASCADE;

-- Step 3: Create correct enum type
CREATE TYPE bookingstatus AS ENUM (
    'PENDING_APPROVAL',
    'PENDING_PAYMENT',
    'ACTIVE',
    'COMPLETED',
    'CANCELLED_BY_STUDENT',
    'CANCELLED_BY_TEACHER',
    'DISPUTED'
);

-- Step 4: Recreate column with new enum
ALTER TABLE bookings
ADD COLUMN status bookingstatus NOT NULL DEFAULT 'PENDING_APPROVAL';

-- Step 5: Verify
SELECT enum_range(NULL::bookingstatus);
-- Should return: {PENDING_APPROVAL,PENDING_PAYMENT,ACTIVE,COMPLETED,...}
```

**How to run:**

```bash
# Via psql terminal
psql -U your_user -d gurubhet_db
# Then paste the SQL above

# OR via file
psql -U your_user -d gurubhet_db -f /path/to/sql_file.sql
```

See `/docs/SQL_ENUM_FIX.md` for detailed steps and troubleshooting.

### Option 2: Alembic Manual Migration

If you prefer using Alembic, edit the migration file manually:

```python
# In migrations/versions/fix_enums_manual.py

def upgrade() -> None:
    op.execute('ALTER TABLE bookings DROP COLUMN status')
    op.execute('DROP TYPE IF EXISTS bookingstatus CASCADE')
    op.execute("""
        CREATE TYPE bookingstatus AS ENUM (
            'PENDING_APPROVAL',
            'PENDING_PAYMENT',
            ...
        )
    """)
    op.execute('ALTER TABLE bookings ADD COLUMN status bookingstatus ...')
```

Then run:

```bash
alembic upgrade head
```

### Option 3: Nuclear Option - Reset Database

If you have no production data:

```bash
# Drop and recreate database
dropdb gurubhet_db
createdb gurubhet_db

# Run all migrations fresh
alembic upgrade head

# Reseed data if needed
```

## Affected Enums

Check if other enums have the same issue:

- `bookingstatus` ❌ (current issue)
- `sessionstatus` (check in database)
- Other custom enums

## Verification

After fixing, verify the enum values:

```sql
-- Connect to database
psql -U your_user -d gurubhet_db

-- Check enum values
SELECT enum_range(NULL::bookingstatus);

-- Should return:
-- {PENDING_APPROVAL,PENDING_PAYMENT,ACTIVE,COMPLETED,CANCELLED_BY_STUDENT,CANCELLED_BY_TEACHER,DISPUTED}
```

## Prevention

Always run `alembic upgrade head` after pulling code changes that modify enums or models.

## Quick Test

After fixing, try creating a booking:

```bash
curl -X POST http://localhost:8000/api/v1/bookings/request \
  -H "x-access-token: $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "teacher_id": "...",
    "subject_id": "...",
    "total_sessions": 10,
    "rate_per_session": 10000,
    "session_duration_minutes": 60
  }'

# Should return 201 with booking details
```

## Related Files

- Model: `/app/models/booking.py`
- Enum: `/app/core/enums.py` (BookingStatus)
- Migrations: `/migrations/versions/`
