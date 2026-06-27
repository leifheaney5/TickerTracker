"""multi watchlist: watchlists table + watchlist_id + user.plan

Revision ID: cc01_multi_watchlist
Revises: dd01_unsub_token
"""
from alembic import op
import sqlalchemy as sa

revision = "cc01_multi_watchlist"
# Chain tip determined by inspecting existing migration down_revision chain:
# b527cf04bf5b → 5312d8e01ae0 → aa01_alert_state → bb01_share_token
# → cc01_saved_screens → dd01_unsub_token  (current head)
down_revision = "dd01_unsub_token"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "watchlists",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("name", sa.String, nullable=False, server_default="My Watchlist"),
        sa.Column("position", sa.Integer, server_default="0"),
        sa.Column("share_token", sa.String, nullable=True, index=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )
    op.add_column("watchlist_items", sa.Column("watchlist_id", sa.Integer, sa.ForeignKey("watchlists.id"), nullable=True))
    op.add_column("users", sa.Column("plan", sa.String, server_default="free"))
    # data backfill is handled idempotently at runtime by db._ensure_columns.


def downgrade():
    op.drop_column("watchlist_items", "watchlist_id")
    op.drop_column("users", "plan")
    op.drop_table("watchlists")
