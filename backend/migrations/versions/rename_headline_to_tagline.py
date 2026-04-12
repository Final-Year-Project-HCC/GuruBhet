"""rename headline to tagline

Revision ID: rename_headline_tagline_001
Revises: uniform_faculty_002
Create Date: 2026-04-11 13:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'rename_headline_tagline_001'
down_revision = 'uniform_faculty_002'
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.alter_column('teacher_profiles', 'headline', new_column_name='tagline')

def downgrade() -> None:
    op.alter_column('teacher_profiles', 'tagline', new_column_name='headline')