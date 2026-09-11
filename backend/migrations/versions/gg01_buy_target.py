"""add buy target to watchlist items

Revision ID: gg01_buy_target
Revises: cc01_multi_watchlist, ff01_signal_snapshots
"""
from alembic import op
import sqlalchemy as sa

revision = "gg01_buy_target"
down_revision = ("cc01_multi_watchlist", "ff01_signal_snapshots")
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "watchlist_items",
        sa.Column("buy_target", sa.Float(), server_default="0.0", nullable=True),
    )


def downgrade():
    op.drop_column("watchlist_items", "buy_target")
