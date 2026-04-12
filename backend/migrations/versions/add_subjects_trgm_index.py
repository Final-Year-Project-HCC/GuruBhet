"""
Add trigram index for fast subject suggestion search
"""
from alembic import op

revision = 'add_subjects_trgm_index'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm;")
    op.execute("CREATE INDEX IF NOT EXISTS idx_subjects_name_trgm ON subjects USING gin (name gin_trgm_ops);")

def downgrade():
    op.execute("DROP INDEX IF EXISTS idx_subjects_name_trgm;")
