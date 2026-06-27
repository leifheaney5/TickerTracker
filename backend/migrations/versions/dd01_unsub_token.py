"""add unsub_token to settings"""
from alembic import op
import sqlalchemy as sa

revision = "dd01_unsub_token"
down_revision = "cc01_saved_screens"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("settings", sa.Column("unsub_token", sa.String(), nullable=True))
    op.create_index("ix_settings_unsub_token", "settings", ["unsub_token"])


def downgrade():
    op.drop_index("ix_settings_unsub_token", table_name="settings")
    op.drop_column("settings", "unsub_token")
