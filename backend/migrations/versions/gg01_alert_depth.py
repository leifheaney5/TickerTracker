"""add alert depth columns — vol_spike_pct, earnings_days, alert_kind, push_subscriptions"""
from alembic import op
import sqlalchemy as sa

revision = "gg01_alert_depth"
down_revision = "ff01_signal_snapshots"
branch_labels = None
depends_on = None


def upgrade():
    # WatchlistItem: volume-spike and earnings proximity alert opt-ins
    op.add_column("watchlist_items",
                  sa.Column("vol_spike_pct", sa.Float(), nullable=True))
    op.add_column("watchlist_items",
                  sa.Column("earnings_days", sa.Integer(), nullable=True))

    # AlertLog: kind tag for deduplication and reporting
    op.add_column("alert_log",
                  sa.Column("alert_kind", sa.String(), nullable=True,
                             server_default="price"))

    # Web Push subscriptions table
    op.create_table(
        "push_subscriptions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("endpoint", sa.Text(), nullable=False, unique=True),
        sa.Column("p256dh", sa.Text(), nullable=False),
        sa.Column("auth", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("endpoint", name="uq_push_endpoint"),
    )
    op.create_index("ix_push_subscriptions_user_id", "push_subscriptions", ["user_id"])


def downgrade():
    op.drop_index("ix_push_subscriptions_user_id", table_name="push_subscriptions")
    op.drop_table("push_subscriptions")
    op.drop_column("alert_log", "alert_kind")
    op.drop_column("watchlist_items", "earnings_days")
    op.drop_column("watchlist_items", "vol_spike_pct")
