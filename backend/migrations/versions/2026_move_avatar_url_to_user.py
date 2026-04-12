"""
Move avatar_url to users and remove bio/avatar_url from student_profiles and teacher_profiles
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '2026moveavatarurltouser'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    # Add avatar_url to users
    op.add_column('users', sa.Column('avatar_url', sa.String(length=500), nullable=True))
    # Migrate teacher_profiles.avatar_url to users.avatar_url
    op.execute('''
        UPDATE users SET avatar_url = teacher_profiles.avatar_url
        FROM teacher_profiles
        WHERE users.id = teacher_profiles.user_id AND teacher_profiles.avatar_url IS NOT NULL
    ''')
    # Migrate student_profiles.avatar_url to users.avatar_url if not already set
    op.execute('''
        UPDATE users SET avatar_url = student_profiles.avatar_url
        FROM student_profiles
        WHERE users.id = student_profiles.user_id AND student_profiles.avatar_url IS NOT NULL AND users.avatar_url IS NULL
    ''')
    # Remove avatar_url and bio from student_profiles
    with op.batch_alter_table('student_profiles') as batch_op:
        batch_op.drop_column('avatar_url')
        batch_op.drop_column('bio')
    # Remove avatar_url from teacher_profiles
    with op.batch_alter_table('teacher_profiles') as batch_op:
        batch_op.drop_column('avatar_url')

def downgrade():
    # Add columns back
    with op.batch_alter_table('student_profiles') as batch_op:
        batch_op.add_column(sa.Column('avatar_url', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('bio', sa.Text(), nullable=True))
    with op.batch_alter_table('teacher_profiles') as batch_op:
        batch_op.add_column(sa.Column('avatar_url', sa.Text(), nullable=True))
    op.drop_column('users', 'avatar_url')
