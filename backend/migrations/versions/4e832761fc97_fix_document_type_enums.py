"""fix_document_type_enums

Revision ID: 4e832761fc97
Revises: 3577674fe1f5
Create Date: 2026-04-10 21:46:17.853279

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4e832761fc97'
down_revision: Union[str, Sequence[str], None] = '3577674fe1f5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Wrap in a try-except or use op.execute to handle Postgres ENUM constraints
    # 1. Sync labels to match your new Uppercase Python Enum
    op.execute("ALTER TYPE documenttype RENAME VALUE 'selfie_with_nid' TO 'SELFIE_WITH_NID'")
    op.execute("ALTER TYPE documenttype RENAME VALUE 'CITIZENSHIP_FRONT' TO 'NID_FRONT'")
    op.execute("ALTER TYPE documenttype RENAME VALUE 'CITIZENSHIP_BACK' TO 'NID_BACK'")
    
    # 2. Cleanup: Move any records from the old 'CITIZENSHIP' selfie to the 'NID' selfie
    op.execute("""
        UPDATE teacher_documents 
        SET type = 'SELFIE_WITH_NID' 
        WHERE type = 'SELFIE_WITH_CITIZENSHIP'
    """)


def downgrade() -> None:
    """Downgrade schema."""
    # Logic to reverse the changes if needed
    op.execute("ALTER TYPE documenttype RENAME VALUE 'SELFIE_WITH_NID' TO 'selfie_with_nid'")
    op.execute("ALTER TYPE documenttype RENAME VALUE 'NID_FRONT' TO 'CITIZENSHIP_FRONT'")
    op.execute("ALTER TYPE documenttype RENAME VALUE 'NID_BACK' TO 'CITIZENSHIP_BACK'")
