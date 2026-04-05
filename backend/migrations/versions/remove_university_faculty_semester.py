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
    
    # Drop constraints and columns from subjects table
    # Check if columns exist before dropping
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    
    # Get existing columns in subjects table
    columns = [col['name'] for col in inspector.get_columns('subjects')]
    
    # Drop foreign keys if they exist
    if 'university_id' in columns:
        with op.batch_alter_table('subjects', schema=None) as batch_op:
            batch_op.drop_column('university_id')
    
    if 'faculty_id' in columns:
        with op.batch_alter_table('subjects', schema=None) as batch_op:
            batch_op.drop_column('faculty_id')
    
    # Drop columns if they exist
    if 'is_active' in columns:
        with op.batch_alter_table('subjects', schema=None) as batch_op:
            batch_op.drop_column('is_active')
    
    if 'semester_number' in columns:
        with op.batch_alter_table('subjects', schema=None) as batch_op:
            batch_op.drop_column('semester_number')
    
    if 'class_name' in columns:
        with op.batch_alter_table('subjects', schema=None) as batch_op:
            batch_op.drop_column('class_name')
    
    # Drop old indexes if they exist
    try:
        op.drop_index('ix_subject_faculty_semester', table_name='subjects')
    except:
        pass  # Index might not exist
    
    try:
        op.drop_index('ix_subject_semester', table_name='subjects')
    except:
        pass  # Index might not exist
    
    # Drop semesters table
    try:
        op.drop_table('semesters')
    except:
        pass  # Table might not exist
    
    # Drop faculties table
    try:
        op.drop_table('faculties')
    except:
        pass  # Table might not exist
    
    # Drop universities table
    try:
        op.drop_table('universities')
    except:
        pass  # Table might not exist


def downgrade() -> None:
    """Downgrade: restore university, faculty, semester models."""
    # This is not reversible without data loss.
    # Would need to recreate entire schema.
    pass
