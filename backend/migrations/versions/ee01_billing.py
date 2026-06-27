"""add billing_subscriptions and stripe_events"""
from alembic import op
import sqlalchemy as sa

revision = "ee01_billing"
down_revision = "dd01_unsub_token"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "billing_subscriptions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("plan", sa.String(), nullable=True),
        sa.Column("status", sa.String(), nullable=True),
        sa.Column("stripe_customer_id", sa.String(), nullable=True),
        sa.Column("stripe_subscription_id", sa.String(), nullable=True),
        sa.Column("stripe_price_id", sa.String(), nullable=True),
        sa.Column("current_period_end", sa.DateTime(), nullable=True),
        sa.Column("cancel_at_period_end", sa.Boolean(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_billing_subscriptions_user_id", "billing_subscriptions",
                    ["user_id"], unique=True)
    op.create_index("ix_billing_subscriptions_stripe_customer_id",
                    "billing_subscriptions", ["stripe_customer_id"])
    op.create_index("ix_billing_subscriptions_stripe_subscription_id",
                    "billing_subscriptions", ["stripe_subscription_id"])
    op.create_table(
        "stripe_events",
        sa.Column("event_id", sa.String(), primary_key=True),
        sa.Column("event_type", sa.String(), nullable=True),
        sa.Column("received_at", sa.DateTime(), nullable=True),
    )


def downgrade():
    op.drop_table("stripe_events")
    op.drop_index("ix_billing_subscriptions_stripe_subscription_id",
                  table_name="billing_subscriptions")
    op.drop_index("ix_billing_subscriptions_stripe_customer_id",
                  table_name="billing_subscriptions")
    op.drop_index("ix_billing_subscriptions_user_id",
                  table_name="billing_subscriptions")
    op.drop_table("billing_subscriptions")
