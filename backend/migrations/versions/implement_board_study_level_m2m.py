"""Implement many-to-many relationship between Board and StudyLevel

This migration:
1. Creates board_study_levels junction table
2. Migrates existing board-to-study_level data
3. Drops study_level_id column from boards table

Revision ID: impl_board_study_level_m2m
Revises: recreate_hierarchy
Create Date: 2026-04-06 15:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'impl_board_study_level_m2m'
down_revision: Union[str, Sequence[str], None] = 'recreate_hierarchy'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade: Create junction table and migrate data."""
    
    # Step 1: Create board_study_levels junction table
    op.create_table(
        'board_study_levels',
        sa.Column('board_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('study_level_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['board_id'], ['boards.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['study_level_id'], ['study_levels.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('board_id', 'study_level_id')
    )
    op.create_index('ix_board_study_levels_board', 'board_study_levels', ['board_id'])
    op.create_index('ix_board_study_levels_study_level', 'board_study_levels', ['study_level_id'])
    
    # Step 2: Migrate existing data from boards.study_level_id to junction table
    # For each board that has a study_level_id, insert into junction table
    op.execute("""
        INSERT INTO board_study_levels (board_id, study_level_id)
        SELECT id, study_level_id FROM boards
        WHERE study_level_id IS NOT NULL
        ON CONFLICT DO NOTHING;
    """)
    
    # Step 3: Drop the study_level_id column from boards table
    op.drop_constraint('boards_study_level_id_fkey', 'boards', type_='foreignkey')
    op.drop_index('ix_boards_study_level_id', table_name='boards')
    op.drop_column('boards', 'study_level_id')


def downgrade() -> None:
    """Downgrade: Restore board.study_level_id and drop junction table."""
    
    # Step 1: Add study_level_id column back to boards
    op.add_column('boards', 
        sa.Column('study_level_id', postgresql.UUID(as_uuid=True), nullable=True)
    )
    
    # Step 2: Restore data from junction table back to boards
    op.execute("""
        UPDATE boards 
        SET study_level_id = bsl.study_level_id
        FROM board_study_levels bsl
        WHERE boards.id = bsl.board_id;
    """)
    
    # Step 3: Make study_level_id NOT NULL again
    op.alter_column('boards', 'study_level_id', nullable=False)
    
    # Step 4: Recreate foreign key constraint
    op.create_foreign_key(
        'boards_study_level_id_fkey',
        'boards', 'study_levels',
        ['study_level_id'], ['id'],
        ondelete='CASCADE'
    )
    op.create_index('ix_boards_study_level_id', 'boards', ['study_level_id'])
    
    # Step 5: Drop junction table
    op.drop_table('board_study_levels')
