"""fix_document_type_enums_2

Revision ID: 58384ab24c18
Revises: 4e832761fc97
Create Date: 2026-04-10 21:49:22.032117

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '58384ab24c18'
down_revision: Union[str, Sequence[str], None] = '4e832761fc97'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    # 1. Define the names
    old_type = 'documenttype'
    new_type = 'documenttype_v2'
    # All the labels you want in the FINAL version
    new_labels = ('NID_FRONT', 'NID_BACK', 'PAN_CARD', 'SELFIE_WITH_NID')

    # 2. Create the new clean ENUM type
    labels_str = ", ".join([f"'{v}'" for v in new_labels])
    op.execute(f"CREATE TYPE {new_type} AS ENUM ({labels_str})")

    # 3. Alter the column to use the new type FIRST
    # We cast to text first, then to the new enum type. 
    # Any existing data that doesn't match will stay as strings for a moment.
    op.execute(f"""
        ALTER TABLE teacher_documents 
        ALTER COLUMN type TYPE {new_type} 
        USING type::text::{new_type}
    """)

    # 4. NOW update the data (Postgres now knows what 'NID_FRONT' is)
    op.execute("UPDATE teacher_documents SET type = 'NID_FRONT' WHERE type::text = 'CITIZENSHIP_FRONT'")
    op.execute("UPDATE teacher_documents SET type = 'NID_BACK' WHERE type::text = 'CITIZENSHIP_BACK'")
    op.execute("""
        UPDATE teacher_documents 
        SET type = 'SELFIE_WITH_NID' 
        WHERE type::text IN ('selfie_with_nid', 'SELFIE', 'SELFIE_WITH_CITIZENSHIP')
    """)

    # 5. Drop the old type and rename the new one
    op.execute(f"DROP TYPE {old_type}")
    op.execute(f"ALTER TYPE {new_type} RENAME TO {old_type}")