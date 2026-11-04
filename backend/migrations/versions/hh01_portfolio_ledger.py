"""add Transaction table + realized_pnl/fees_paid columns to holdings"""
from alembic import op
import sqlalchemy as sa

revision = "hh01_portfolio_ledger"
down_revision = "gg01_alert_depth"
branch_labels = None
depends_on = None


def upgrade():
    # Extend Holding: accumulate realized P&L and fees across sells.
    # Nullable so existing rows (written by the legacy POST /api/holdings path)
    # are valid without a data migration; application defaults them to 0.0.
    op.add_column("holdings",
                  sa.Column("realized_pnl", sa.Float(), nullable=True, server_default="0"))
    op.add_column("holdings",
                  sa.Column("fees_paid", sa.Float(), nullable=True, server_default="0"))

    # Transaction ledger — one row per buy/sell event per user.
    op.create_table(
        "transactions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("symbol", sa.String(), nullable=False),
        sa.Column("kind", sa.String(), nullable=False),       # 'buy' | 'sell'
        sa.Column("quantity", sa.Float(), nullable=False),
        sa.Column("price", sa.Float(), nullable=False),
        sa.Column("fees", sa.Float(), nullable=True, server_default="0"),
        sa.Column("executed_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("note", sa.String(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_transactions_user_symbol", "transactions", ["user_id", "symbol"])


def downgrade():
    op.drop_index("ix_transactions_user_symbol", table_name="transactions")
    op.drop_table("transactions")
    op.drop_column("holdings", "fees_paid")
    op.drop_column("holdings", "realized_pnl")
