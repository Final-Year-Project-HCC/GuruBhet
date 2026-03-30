# Fix Missing sessions.status Column

The `sessions` table exists but is missing the `status` column that the Session model defines.

## Quick SQL Fix

⚠️ **IMPORTANT**: Run these commands **one by one** in order. PostgreSQL doesn't support some of the IF NOT EXISTS clauses for enums.

### Step 1: Create the sessionstatus enum type

```sql
DROP TYPE IF EXISTS sessionstatus CASCADE;

CREATE TYPE sessionstatus AS ENUM (
    'READY',
    'IN_PROGRESS',
    'COMPLETED',
    'CANCELLED_BY_STUDENT',
    'CANCELLED_BY_TEACHER'
);
```

### Step 2: Add the status column to sessions table

```sql
ALTER TABLE sessions
ADD COLUMN status sessionstatus NOT NULL DEFAULT 'READY';
```

### Step 3: Create index for faster queries

```sql
CREATE INDEX ix_sessions_status ON sessions(status);
```

### Step 4: Verify the column exists

```sql
\d sessions
```

Should show: `status | sessionstatus`

## How to Run (One by One)

### Option 1: Via psql Terminal (Recommended)

```bash
# Connect to database
psql -U <username> -d <database_name>
```

Then paste **each command separately** in the terminal, pressing Enter after each one:

```sql
-- Run this first
DROP TYPE IF EXISTS sessionstatus CASCADE;

-- Then run this
CREATE TYPE sessionstatus AS ENUM (
    'READY',
    'IN_PROGRESS',
    'COMPLETED',
    'CANCELLED_BY_STUDENT',
    'CANCELLED_BY_TEACHER'
);

-- Then run this
ALTER TABLE sessions
ADD COLUMN status sessionstatus NOT NULL DEFAULT 'READY';

-- Then run this
CREATE INDEX ix_sessions_status ON sessions(status);

-- Finally verify
\d sessions
```

### Option 2: Create a Safe SQL File

```bash
cat > /tmp/add_sessions_status.sql << 'EOF'
DROP TYPE IF EXISTS sessionstatus CASCADE;

CREATE TYPE sessionstatus AS ENUM (
    'READY',
    'IN_PROGRESS',
    'COMPLETED',
    'CANCELLED_BY_STUDENT',
    'CANCELLED_BY_TEACHER'
);

ALTER TABLE sessions
ADD COLUMN status sessionstatus NOT NULL DEFAULT 'READY';

CREATE INDEX ix_sessions_status ON sessions(status);
EOF

# Run it (note: this will work because we're not using IF NOT EXISTS on the enum)
psql -U <username> -d <database_name> -f /tmp/add_sessions_status.sql
```

## Why This Happens

PostgreSQL enum types (`CREATE TYPE ... AS ENUM`) don't support the `IF NOT EXISTS` clause. That's why we use `DROP TYPE IF EXISTS` first to safely remove it if it exists, then create it fresh.

## Troubleshooting

### If you get "type 'sessionstatus' already exists"

```sql
-- Just drop it first
DROP TYPE IF EXISTS sessionstatus CASCADE;

-- Then create it
CREATE TYPE sessionstatus AS ENUM (
    'READY',
    'IN_PROGRESS',
    'COMPLETED',
    'CANCELLED_BY_STUDENT',
    'CANCELLED_BY_TEACHER'
);
```

### If you get "column 'status' already exists"

The column might already be there. Check:

```sql
\d sessions
```

If status column already exists, you're done! Just restart your server.

### If you get "column 'status' of relation 'sessions' does not exist"

Run step 2 again:

```sql
ALTER TABLE sessions
ADD COLUMN status sessionstatus NOT NULL DEFAULT 'READY';
```

## After Running SQL

1. Verify the changes:

   ```sql
   \d sessions
   ```

2. Restart your server:

   ```bash
   # Stop: Ctrl+C in terminal running uvicorn
   # Start:
   poetry run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```

3. Test the endpoint again
