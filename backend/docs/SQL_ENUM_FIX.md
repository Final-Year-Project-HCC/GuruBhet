# Direct SQL Fix for Enum Types

If Alembic migrations aren't working, run this SQL directly in your PostgreSQL database:

```sql
-- Connect to your database first
-- psql -U your_user -d gurubhet_db

-- Step 1: Drop dependent columns first
ALTER TABLE bookings DROP COLUMN IF EXISTS status;
ALTER TABLE sessions DROP COLUMN IF EXISTS status;

-- Step 2: Drop old enum types
DROP TYPE IF EXISTS bookingstatus CASCADE;
DROP TYPE IF EXISTS sessionstatus CASCADE;

-- Step 3: Create new enum types with correct values
CREATE TYPE bookingstatus AS ENUM (
    'PENDING_APPROVAL',
    'PENDING_PAYMENT',
    'ACTIVE',
    'COMPLETED',
    'CANCELLED_BY_STUDENT',
    'CANCELLED_BY_TEACHER',
    'DISPUTED'
);

CREATE TYPE sessionstatus AS ENUM (
    'READY',
    'IN_PROGRESS',
    'COMPLETED',
    'CANCELLED_BY_STUDENT',
    'CANCELLED_BY_TEACHER'
);

-- Step 4: Recreate the columns with correct enum types
ALTER TABLE bookings
ADD COLUMN status bookingstatus NOT NULL DEFAULT 'PENDING_APPROVAL';

ALTER TABLE sessions
ADD COLUMN status sessionstatus NOT NULL DEFAULT 'READY';

-- Step 5: Recreate indexes
CREATE INDEX ix_bookings_status ON bookings(status);
CREATE INDEX ix_sessions_status ON sessions(status);

-- Step 6: Verify the enum values were created correctly
SELECT enum_range(NULL::bookingstatus);
-- Should return: {PENDING_APPROVAL,PENDING_PAYMENT,ACTIVE,COMPLETED,CANCELLED_BY_STUDENT,CANCELLED_BY_TEACHER,DISPUTED}

SELECT enum_range(NULL::sessionstatus);
-- Should return: {READY,IN_PROGRESS,COMPLETED,CANCELLED_BY_STUDENT,CANCELLED_BY_TEACHER}
```

## How to Run

### Option 1: From psql terminal

```bash
# Connect to database
psql -U <username> -d <database_name>

# Paste the SQL above and run it
```

### Option 2: From file

```bash
# Save the SQL to a file
cat > /tmp/fix_enums.sql << 'EOF'
[paste SQL above]
EOF

# Run it
psql -U <username> -d <database_name> -f /tmp/fix_enums.sql
```

### Option 3: From python

```python
from sqlalchemy import text
from app.db.session import sessionmanager

async def fix_enums():
    async with sessionmanager.connect() as conn:
        async with conn.begin():
            # Run all the SQL commands
            await conn.execute(text("ALTER TABLE bookings DROP COLUMN IF EXISTS status"))
            # ... etc
```

## After Running SQL

1. **Verify the enums exist:**

   ```sql
   SELECT * FROM pg_type WHERE typname IN ('bookingstatus', 'sessionstatus');
   ```

2. **Check enum values:**

   ```sql
   SELECT enum_range(NULL::bookingstatus);
   SELECT enum_range(NULL::sessionstatus);
   ```

3. **Restart your app:**

   ```bash
   # Stop the server
   Ctrl+C in terminal running uvicorn

   # Restart
   poetry run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```

4. **Test the booking endpoint:**

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

   # Should return 201 Created
   ```

## Troubleshooting

### If you get "column already exists" error

```sql
-- The column might already exist, just drop it again
ALTER TABLE bookings DROP COLUMN status CASCADE;
```

### If enum creation fails

```sql
-- Check if enum exists
SELECT * FROM pg_type WHERE typname = 'bookingstatus';

-- If it exists, drop it
DROP TYPE bookingstatus CASCADE;

-- Then recreate
CREATE TYPE bookingstatus AS ENUM (...);
```

### If sessions table doesn't exist

Just skip the sessions portion and only fix bookings:

```sql
ALTER TABLE bookings DROP COLUMN IF EXISTS status;
DROP TYPE IF EXISTS bookingstatus CASCADE;

CREATE TYPE bookingstatus AS ENUM (
    'PENDING_APPROVAL',
    'PENDING_PAYMENT',
    'ACTIVE',
    'COMPLETED',
    'CANCELLED_BY_STUDENT',
    'CANCELLED_BY_TEACHER',
    'DISPUTED'
);

ALTER TABLE bookings
ADD COLUMN status bookingstatus NOT NULL DEFAULT 'PENDING_APPROVAL';
```
