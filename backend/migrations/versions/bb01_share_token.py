"""add share_token to settings"""
from alembic import op
import sqlalchemy as sa

revision = "bb01_share_token"
down_revision = "aa01_alert_state"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("settings", sa.Column("share_token", sa.String(), nullable=True))
    op.create_index("ix_settings_share_token", "settings", ["share_token"], unique=False)


def downgrade():
    op.drop_index("ix_settings_share_token", table_name="settings")
    op.drop_column("settings", "share_token")
