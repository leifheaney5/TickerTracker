"""add saved_screens table"""
from alembic import op
import sqlalchemy as sa

revision = "cc01_saved_screens"
down_revision = "bb01_share_token"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "saved_screens",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("filters_json", sa.String(), nullable=True, server_default=""),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_saved_screens_user_id", "saved_screens", ["user_id"])


def downgrade():
    op.drop_index("ix_saved_screens_user_id", table_name="saved_screens")
    op.drop_table("saved_screens")
