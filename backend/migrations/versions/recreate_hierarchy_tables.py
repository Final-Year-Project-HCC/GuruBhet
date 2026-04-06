"""Recreate hierarchy tables (StudyLevel, Board, Faculty, Subject)

This migration:
1. Drops existing subjects and faculties tables
2. Creates fresh study_levels table
3. Creates fresh boards table
4. Creates fresh faculties table
5. Creates fresh subjects table with proper constraints

Revision ID: recreate_hierarchy
Revises: 40912839d228
Create Date: 2026-04-06 13:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'recreate_hierarchy'
down_revision: Union[str, Sequence[str], None] = '40912839d228'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade: Drop and recreate hierarchy tables."""
    
    # Step 1: Drop existing tables (in reverse dependency order)
    op.execute("DROP TABLE IF EXISTS subjects CASCADE;")
    op.execute("DROP TABLE IF EXISTS faculties CASCADE;")
    op.execute("DROP TABLE IF EXISTS boards CASCADE;")
    op.execute("DROP TABLE IF EXISTS study_levels CASCADE;")
    
    # Step 2: Create study_levels table
    op.create_table(
        'study_levels',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.String(length=255), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name', name='uq_study_levels_name')
    )
    op.create_index('ix_study_levels_name', 'study_levels', ['name'], unique=True)
    
    # Step 3: Create boards table
    op.create_table(
        'boards',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('study_level_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.String(length=255), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['study_level_id'], ['study_levels.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_boards_study_level_id', 'boards', ['study_level_id'])
    op.create_index('ix_boards_name', 'boards', ['name'])
    
    # Step 4: Create faculties table
    op.create_table(
        'faculties',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('board_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.String(length=255), nullable=True),
        sa.Column('unit_type', sa.Enum('GRADE', 'SEMESTER', 'YEAR', name='unittype'), nullable=False),
        sa.Column('total_units', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['board_id'], ['boards.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_faculties_board_id', 'faculties', ['board_id'])
    op.create_index('ix_faculties_name', 'faculties', ['name'])
    
    # Step 5: Create subjects table
    op.create_table(
        'subjects',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('study_level_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('board_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('faculty_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('unit_value', sa.Integer(), nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['study_level_id'], ['study_levels.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['board_id'], ['boards.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['faculty_id'], ['faculties.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_subjects_name', 'subjects', ['name'])
    op.create_index('ix_subjects_study_level_id', 'subjects', ['study_level_id'])
    op.create_index('ix_subjects_board_id', 'subjects', ['board_id'])
    op.create_index('ix_subjects_faculty_id', 'subjects', ['faculty_id'])
    op.create_index('ix_subjects_unit_value', 'subjects', ['unit_value'])
    op.create_index('ix_subjects_is_active', 'subjects', ['is_active'])


def downgrade() -> None:
    """Downgrade: Drop recreated tables."""
    op.execute("DROP TABLE IF EXISTS subjects CASCADE;")
    op.execute("DROP TABLE IF EXISTS faculties CASCADE;")
    op.execute("DROP TABLE IF EXISTS boards CASCADE;")
    op.execute("DROP TABLE IF EXISTS study_levels CASCADE;")
