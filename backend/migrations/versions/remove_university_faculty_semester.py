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
down_revision: Union[str, Sequence[str], None] = 'fix_enums_001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Remove university, faculty, and semester models; simplify subject."""
    # Drop semesters table (depends on faculties)
    op.drop_table('semesters')
    
    # Drop faculties table (depends on universities)
    op.drop_table('faculties')
    
    # Drop universities table
    op.drop_table('universities')
    
    # Remove foreign keys and columns from subjects
    # Drop is_active column
    op.drop_column('subjects', 'is_active')
    
    # Drop semester_number column
    op.drop_column('subjects', 'semester_number')
    
    # Drop university_id foreign key
    op.drop_constraint(
        'subjects_university_id_fkey',
        'subjects',
        type_='foreignkey'
    )
    op.drop_column('subjects', 'university_id')
    
    # Drop faculty_id foreign key
    op.drop_constraint(
        'subjects_faculty_id_fkey',
        'subjects',
        type_='foreignkey'
    )
    op.drop_column('subjects', 'faculty_id')
    
    # Drop class_name column
    op.drop_column('subjects', 'class_name')
    
    # Drop old indexes
    op.drop_index('ix_subject_faculty_semester', table_name='subjects')
    op.drop_index('ix_subject_semester', table_name='subjects')
    
    # Drop old unique constraint
    op.drop_constraint(
        'uq_subject_per_faculty_semester',
        'subjects',
        type_='unique'
    )
    
    # Add unique constraint on name only (should already exist, but ensure it)
    op.create_unique_constraint('uq_subject_name', 'subjects', ['name'])


def downgrade() -> None:
    """Downgrade: restore university, faculty, semester models."""
    # This is not reversible without data loss.
    # Would need to recreate entire schema.
    pass
