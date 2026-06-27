import logging
import os
from contextlib import contextmanager
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///ticker.db")
# Railway provides postgres:// ; normalize to the psycopg v3 dialect explicitly
# (`postgresql+psycopg://`). Without the +psycopg suffix SQLAlchemy defaults to
# the psycopg2 driver, which isn't installed (we use psycopg[binary] v3), and
# create_engine would crash at import — taking the whole app down on boot.
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg://", 1)
elif DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)

_is_sqlite = DATABASE_URL.startswith("sqlite")
_connect_args = {"check_same_thread": False} if _is_sqlite else {"connect_timeout": 10}
# in-memory sqlite needs a shared static pool to persist across connections
_kw = {}
if DATABASE_URL == "sqlite://":
    from sqlalchemy.pool import StaticPool
    _kw = {"poolclass": StaticPool}
if not _is_sqlite:
    # Recycle connections + pre-ping so a dropped Postgres connection doesn't
    # surface as a hard error on the next request.
    _kw["pool_pre_ping"] = True
    _kw["pool_recycle"] = 300

engine = create_engine(DATABASE_URL, connect_args=_connect_args, **_kw)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)
Base = declarative_base()


@contextmanager
def get_session():
    s = SessionLocal()
    try:
        yield s
    finally:
        s.close()


def _auth_schema_is_stale() -> bool:
    """True if the users table exists but lacks the auth columns (i.e. a
    pre-auth database that create_all can't upgrade, since create_all never
    ALTERs existing tables). Used to trigger a one-time rebuild."""
    try:
        from sqlalchemy import inspect
        insp = inspect(engine)
        if "users" not in insp.get_table_names():
            return False  # fresh DB; create_all will build it correctly
        cols = {c["name"] for c in insp.get_columns("users")}
        return "password_hash" not in cols
    except Exception:
        return False


def _ensure_columns(conn) -> None:
    """Additively add alert_active and alert_last_fired_at to watchlist_items
    if they are absent.  Idempotent: safe to call on a fresh or already-migrated
    table.  Uses ADD COLUMN IF NOT EXISTS on Postgres; falls back to PRAGMA
    inspection on SQLite (which lacks that syntax)."""
    from sqlalchemy import text
    if _is_sqlite:
        rows = conn.execute(text("PRAGMA table_info(watchlist_items)")).fetchall()
        existing = {r[1] for r in rows}  # column name is index 1
        if "alert_active" not in existing:
            conn.execute(text(
                "ALTER TABLE watchlist_items ADD COLUMN alert_active BOOLEAN DEFAULT 0"
            ))
        if "alert_last_fired_at" not in existing:
            conn.execute(text(
                "ALTER TABLE watchlist_items ADD COLUMN alert_last_fired_at DATETIME"
            ))
        # settings.share_token — added in bb01_share_token migration.
        # Guard: only run if the settings table exists (bare-engine tests
        # may only have watchlist_items).
        tables = {r[0] for r in conn.execute(text("SELECT name FROM sqlite_master WHERE type='table'")).fetchall()}
        if "settings" in tables:
            rows_s = conn.execute(text("PRAGMA table_info(settings)")).fetchall()
            existing_s = {r[1] for r in rows_s}
            if "share_token" not in existing_s:
                conn.execute(text(
                    "ALTER TABLE settings ADD COLUMN share_token VARCHAR"
                ))
            if "unsub_token" not in existing_s:
                conn.execute(text(
                    "ALTER TABLE settings ADD COLUMN unsub_token VARCHAR"
                ))
    else:
        # Postgres 9.6+ supports ADD COLUMN IF NOT EXISTS natively.
        conn.execute(text(
            "ALTER TABLE watchlist_items "
            "ADD COLUMN IF NOT EXISTS alert_active BOOLEAN DEFAULT FALSE"
        ))
        conn.execute(text(
            "ALTER TABLE watchlist_items "
            "ADD COLUMN IF NOT EXISTS alert_last_fired_at TIMESTAMP"
        ))
        conn.execute(text(
            "ALTER TABLE settings "
            "ADD COLUMN IF NOT EXISTS share_token VARCHAR"
        ))
        conn.execute(text(
            "ALTER TABLE settings "
            "ADD COLUMN IF NOT EXISTS unsub_token VARCHAR"
        ))


def init_db():
    # create_all builds any MISSING tables but never alters existing ones, so a
    # database created before the auth feature keeps an old `users` table without
    # password_hash/email_verified. When we detect that drift, drop the
    # auth-affected tables so create_all rebuilds them with the current schema.
    # Guarded by the staleness check, so this is a no-op once the schema is
    # current and on a fresh DB. (Safe because launch starts with no real data.)
    try:
        import models  # noqa: F401
        from sqlalchemy import text
        if _auth_schema_is_stale():
            logging.getLogger(__name__).warning(
                "Pre-auth schema detected; rebuilding user/personalization tables.")
            cascade = "" if _is_sqlite else " CASCADE"
            with engine.begin() as conn:
                for tbl in ("watchlist_items", "holdings", "alert_log",
                            "custom_symbols", "settings", "oauth_identities",
                            "email_tokens", "login_attempts", "users"):
                    conn.execute(text(f"DROP TABLE IF EXISTS {tbl}{cascade}"))
        Base.metadata.create_all(engine)
    except Exception as e:  # pragma: no cover
        logging.getLogger(__name__).error("init_db failed (continuing): %s", e)

    # Ensure alert columns exist on watchlist_items regardless of whether the
    # table was just created or already existed from a prior deployment.
    # create_all above never ALTERs existing tables, so prod databases that
    # pre-date the aa01_alert_state Alembic migration would be missing these.
    try:
        from sqlalchemy import text  # noqa: F811 (may already be imported)
        with engine.begin() as conn:
            _ensure_columns(conn)
    except Exception as e:  # pragma: no cover
        logging.getLogger(__name__).error(
            "init_db _ensure_columns failed (continuing): %s", e)
