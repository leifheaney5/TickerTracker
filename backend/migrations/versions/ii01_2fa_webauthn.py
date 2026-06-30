"""add TOTP 2FA columns + RecoveryCode + WebAuthnCredential tables"""
from alembic import op
import sqlalchemy as sa

revision = "ii01_2fa_webauthn"
down_revision = "hh01_portfolio_ledger"
branch_labels = None
depends_on = None


def upgrade():
    # ── TOTP columns on users ─────────────────────────────────────────────────
    # totp_secret is encrypted at rest (stored as a regular VARCHAR; the
    # EncryptedString TypeDecorator handles AES-GCM wrapping at the ORM layer).
    # Both columns are nullable/defaulted so existing rows remain valid.
    op.add_column("users",
                  sa.Column("totp_secret", sa.String(), nullable=True))
    op.add_column("users",
                  sa.Column("totp_enabled", sa.Boolean(), nullable=False,
                            server_default=sa.false()))

    # ── Recovery codes ─────────────────────────────────────────────────────────
    op.create_table(
        "recovery_codes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("code_hash", sa.String(), nullable=False),
        sa.Column("used_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_recovery_codes_user_id", "recovery_codes", ["user_id"])

    # ── WebAuthn credentials ───────────────────────────────────────────────────
    op.create_table(
        "webauthn_credentials",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("credential_id", sa.Text(), nullable=False),
        sa.Column("public_key", sa.Text(), nullable=False),
        sa.Column("sign_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("label", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("credential_id", name="uq_webauthn_credential_id"),
    )
    op.create_index("ix_webauthn_credentials_user_id", "webauthn_credentials", ["user_id"])
    op.create_index("ix_webauthn_credentials_credential_id", "webauthn_credentials",
                    ["credential_id"])


def downgrade():
    op.drop_index("ix_webauthn_credentials_credential_id",
                  table_name="webauthn_credentials")
    op.drop_index("ix_webauthn_credentials_user_id", table_name="webauthn_credentials")
    op.drop_table("webauthn_credentials")

    op.drop_index("ix_recovery_codes_user_id", table_name="recovery_codes")
    op.drop_table("recovery_codes")

    op.drop_column("users", "totp_enabled")
    op.drop_column("users", "totp_secret")
