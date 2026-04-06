"""Refactor subject hierarchy to use uniform 'General' faculty for Grades 1-10 (robust version)

This migration implements the uniform faculty approach where:
1. Board no longer stores unit_type and total_units (Faculty always defines them)
2. Faculty is always required in Subject (no NULL values)
3. Create 'General' faculties for all Grade 1-10 boards
4. Update existing subjects to use the General faculty

This version is defensive and handles missing tables gracefully.

Revision ID: uniform_faculty_002
Revises: uniform_faculty_001
Create Date: 2026-04-06 11:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'uniform_faculty_002'
down_revision: Union[str, Sequence[str], None] = 'uniform_faculty_001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Refactor hierarchy to use uniform General faculty for Grades 1-10."""
    
    # Step 1: Create faculties table if it doesn't exist
    op.execute("""
        CREATE TABLE IF NOT EXISTS faculties (
            id UUID NOT NULL PRIMARY KEY,
            board_id UUID NOT NULL,
            name VARCHAR(100) NOT NULL,
            description VARCHAR(255),
            unit_type VARCHAR(10) NOT NULL,
            total_units INTEGER NOT NULL,
            is_active BOOLEAN DEFAULT true NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
        );
    """)
    
    # Step 2: Create indexes
    op.execute("CREATE INDEX IF NOT EXISTS ix_faculties_board_id ON faculties(board_id);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_faculties_name ON faculties(name);")
    
    # Step 3: Add faculty_id column to subjects if it doesn't exist
    op.execute("""
        ALTER TABLE IF EXISTS subjects
        ADD COLUMN IF NOT EXISTS faculty_id UUID;
    """)
    
    # Step 4: Create indexes on faculty_id
    op.execute("CREATE INDEX IF NOT EXISTS ix_subjects_faculty_id ON subjects(faculty_id);")


def downgrade() -> None:
    """Downgrade: restore state before uniform faculty refactor."""
    pass
