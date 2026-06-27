"""alert state columns on watchlist_items"""
from alembic import op
import sqlalchemy as sa

revision = "aa01_alert_state"
down_revision = "5312d8e01ae0"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("watchlist_items", sa.Column("alert_active", sa.Boolean(), server_default=sa.false(), nullable=False))
    op.add_column("watchlist_items", sa.Column("alert_last_fired_at", sa.DateTime(), nullable=True))


def downgrade():
    op.drop_column("watchlist_items", "alert_last_fired_at")
    op.drop_column("watchlist_items", "alert_active")
