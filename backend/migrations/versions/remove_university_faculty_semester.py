"""Remove university, faculty, semester models and simplify subject schema

This migration:
1. Removes foreign key constraints from subjects table
2. Drops is_active, semester_number columns from subjects
3. Drops semesters table
4. Drops faculties table
5. Drops universities table

Revision ID: remove_hierarchy_001
Revises: fix_enums_001
Create Date: 2026-04-05 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'remove_hierarchy_001'
down_revision: Union[str, Sequence[str], None] = '49ac872f04b1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Remove university, faculty, and semester models; simplify subject."""
    
    # Try to drop semesters table first (depends on faculties)
    op.execute("""
        DROP TABLE IF EXISTS semesters CASCADE;
    """)
    
    # Drop faculties table (depends on universities)
    op.execute("""
        DROP TABLE IF EXISTS faculties CASCADE;
    """)
    
    # Drop universities table
    op.execute("""
        DROP TABLE IF EXISTS universities CASCADE;
    """)
    
    # Drop columns from subjects table if they exist
    # Use ALTER TABLE DROP COLUMN IF EXISTS (PostgreSQL 10+)
    op.execute("""
        ALTER TABLE IF EXISTS subjects
        DROP COLUMN IF EXISTS is_active,
        DROP COLUMN IF EXISTS semester_number,
        DROP COLUMN IF EXISTS university_id,
        DROP COLUMN IF EXISTS faculty_id,
        DROP COLUMN IF EXISTS class_name;
    """)
    
    # Drop old indexes if they exist
    op.execute("""
        DROP INDEX IF EXISTS ix_subject_faculty_semester;
        DROP INDEX IF EXISTS ix_subject_semester;
    """)
    
    # Drop old unique constraint if it exists
    op.execute("""
        ALTER TABLE IF EXISTS subjects
        DROP CONSTRAINT IF EXISTS uq_subject_per_faculty_semester;
    """)


def downgrade() -> None:
    """Downgrade: restore university, faculty, semester models."""
    # This is not reversible without data loss.
    # Would need to recreate entire schema.
    pass
