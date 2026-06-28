"""add signal_snapshots table (Pulse signal history)"""
from alembic import op
import sqlalchemy as sa

revision = "ff01_signal_snapshots"
down_revision = "ee01_billing"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "signal_snapshots",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("symbol", sa.String(), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("pulse_score", sa.Float(), server_default="0"),
        sa.Column("pulse_band", sa.String(), server_default=""),
        sa.Column("sentiment_mood", sa.String(), server_default=""),
        sa.Column("price", sa.Float(), server_default="0"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("symbol", "date", name="uq_signal_symbol_date"),
    )
    op.create_index("ix_signal_snapshots_symbol", "signal_snapshots", ["symbol"])
    op.create_index("ix_signal_snapshots_date", "signal_snapshots", ["date"])


def downgrade():
    op.drop_index("ix_signal_snapshots_date", table_name="signal_snapshots")
    op.drop_index("ix_signal_snapshots_symbol", table_name="signal_snapshots")
    op.drop_table("signal_snapshots")
