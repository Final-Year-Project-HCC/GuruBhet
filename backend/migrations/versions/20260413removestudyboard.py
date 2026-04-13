"""
Remove study_level_id and board_id from Subject model
Revision ID: 20260413removestudyboard
Revises: 
Create Date: 2026-04-13
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '20260413removestudyboard'
down_revision = 'add_subjects_trgm_index'
branch_labels = None
depends_on = None

def upgrade():
    with op.batch_alter_table('subjects') as batch_op:
        batch_op.drop_column('study_level_id')
        batch_op.drop_column('board_id')

def downgrade():
    with op.batch_alter_table('subjects') as batch_op:
        batch_op.add_column(sa.Column('study_level_id', sa.Uuid(as_uuid=True), nullable=False))
        batch_op.add_column(sa.Column('board_id', sa.Uuid(as_uuid=True), nullable=False))
