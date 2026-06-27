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
        if "target" not in existing:
            conn.execute(text(
                "ALTER TABLE watchlist_items ADD COLUMN target REAL DEFAULT 0.0"
            ))
        if "alert_price" not in existing:
            conn.execute(text(
                "ALTER TABLE watchlist_items ADD COLUMN alert_price REAL DEFAULT 0.0"
            ))
        if "alert_dir" not in existing:
            conn.execute(text(
                "ALTER TABLE watchlist_items ADD COLUMN alert_dir VARCHAR DEFAULT 'above'"
            ))
        if "alert_active" not in existing:
            conn.execute(text(
                "ALTER TABLE watchlist_items ADD COLUMN alert_active BOOLEAN DEFAULT 0"
            ))
        if "alert_last_fired_at" not in existing:
            conn.execute(text(
                "ALTER TABLE watchlist_items ADD COLUMN alert_last_fired_at DATETIME"
            ))
        if "created_at" not in existing:
            conn.execute(text(
                "ALTER TABLE watchlist_items ADD COLUMN created_at DATETIME"
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
            "ADD COLUMN IF NOT EXISTS target REAL DEFAULT 0.0"
        ))
        conn.execute(text(
            "ALTER TABLE watchlist_items "
            "ADD COLUMN IF NOT EXISTS alert_price REAL DEFAULT 0.0"
        ))
        conn.execute(text(
            "ALTER TABLE watchlist_items "
            "ADD COLUMN IF NOT EXISTS alert_dir VARCHAR DEFAULT 'above'"
        ))
        conn.execute(text(
            "ALTER TABLE watchlist_items "
            "ADD COLUMN IF NOT EXISTS alert_active BOOLEAN DEFAULT FALSE"
        ))
        conn.execute(text(
            "ALTER TABLE watchlist_items "
            "ADD COLUMN IF NOT EXISTS alert_last_fired_at TIMESTAMP"
        ))
        conn.execute(text(
            "ALTER TABLE watchlist_items "
            "ADD COLUMN IF NOT EXISTS created_at TIMESTAMP"
        ))
        conn.execute(text(
            "ALTER TABLE settings "
            "ADD COLUMN IF NOT EXISTS share_token VARCHAR"
        ))
        conn.execute(text(
            "ALTER TABLE settings "
            "ADD COLUMN IF NOT EXISTS unsub_token VARCHAR"
        ))

    # ── Multiple watchlists: add watchlist_items.watchlist_id, backfill a
    # default "My Watchlist" per user, and carry legacy settings.share_token
    # onto it. Idempotent: the backfill only runs for items lacking a list.
    if _is_sqlite:
        rows = conn.execute(text("PRAGMA table_info(watchlist_items)")).fetchall()
        if "watchlist_id" not in {r[1] for r in rows}:
            conn.execute(text("ALTER TABLE watchlist_items ADD COLUMN watchlist_id INTEGER"))
        # Guard: only alter users table if it exists (bare-engine tests may lack it)
        tables = {r[0] for r in conn.execute(text("SELECT name FROM sqlite_master WHERE type='table'")).fetchall()}
        if "users" in tables:
            ucols = conn.execute(text("PRAGMA table_info(users)")).fetchall()
            if "plan" not in {r[1] for r in ucols}:
                conn.execute(text("ALTER TABLE users ADD COLUMN plan VARCHAR DEFAULT 'free'"))
    else:
        conn.execute(text("ALTER TABLE watchlist_items ADD COLUMN IF NOT EXISTS watchlist_id INTEGER"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS plan VARCHAR DEFAULT 'free'"))

    # Backfill: every user that has items but no list gets one default list.
    user_ids = [r[0] for r in conn.execute(text(
        "SELECT DISTINCT user_id FROM watchlist_items WHERE watchlist_id IS NULL"
    )).fetchall()]
    for uid in user_ids:
        legacy_token = conn.execute(text(
            "SELECT share_token FROM settings WHERE user_id = :u"), {"u": uid}).scalar()
        conn.execute(text(
            "INSERT INTO watchlists (user_id, name, position, share_token) "
            "VALUES (:u, 'My Watchlist', 0, :tok)"), {"u": uid, "tok": legacy_token})
        new_id = conn.execute(text(
            "SELECT id FROM watchlists WHERE user_id = :u ORDER BY id DESC LIMIT 1"),
            {"u": uid}).scalar()
        conn.execute(text(
            "UPDATE watchlist_items SET watchlist_id = :w WHERE user_id = :u AND watchlist_id IS NULL"),
            {"w": new_id, "u": uid})


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
