"""Tests for db._ensure_columns – production deploy-safety for alert columns.

Goals:
  (a) After calling _ensure_columns on a bare watchlist_items table (no alert
      columns), both alert_active and alert_last_fired_at are present.
  (b) Calling _ensure_columns a second time on an already-migrated table does
      NOT raise (idempotent).
  (c) The real schema built by init_db already has both columns (smoke-test
      for the full path).
"""
import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.pool import StaticPool


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _column_names(conn, table: str) -> set:
    rows = conn.execute(text(f"PRAGMA table_info({table})")).fetchall()
    return {r[1] for r in rows}


BARE_DDL = """
CREATE TABLE IF NOT EXISTS watchlist_items (
    id INTEGER PRIMARY KEY,
    user_id INTEGER,
    symbol TEXT,
    alert_target REAL
)
"""


# ---------------------------------------------------------------------------
# Fixture: isolated in-memory engine (independent of the shared test db)
# ---------------------------------------------------------------------------

@pytest.fixture()
def bare_engine():
    """A fresh in-memory SQLite engine with a watchlist_items table that
    intentionally lacks the alert columns."""
    eng = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    with eng.begin() as conn:
        conn.execute(text(BARE_DDL))
    yield eng
    eng.dispose()


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestEnsureColumns:
    def test_adds_missing_columns(self, bare_engine):
        """(a) _ensure_columns adds both alert columns when they are absent."""
        import db as db_module

        # Temporarily point db._is_sqlite at True and use our isolated engine.
        original_engine = db_module.engine
        original_sqlite = db_module._is_sqlite
        db_module.engine = bare_engine
        db_module._is_sqlite = True
        try:
            with bare_engine.begin() as conn:
                before = _column_names(conn, "watchlist_items")
            assert "alert_active" not in before
            assert "alert_last_fired_at" not in before

            with bare_engine.begin() as conn:
                db_module._ensure_columns(conn)

            with bare_engine.connect() as conn:
                after = _column_names(conn, "watchlist_items")
            assert "alert_active" in after, "alert_active must be present after ensure"
            assert "alert_last_fired_at" in after, "alert_last_fired_at must be present after ensure"
        finally:
            db_module.engine = original_engine
            db_module._is_sqlite = original_sqlite

    def test_idempotent(self, bare_engine):
        """(b) Calling _ensure_columns twice must not raise."""
        import db as db_module

        original_engine = db_module.engine
        original_sqlite = db_module._is_sqlite
        db_module.engine = bare_engine
        db_module._is_sqlite = True
        try:
            with bare_engine.begin() as conn:
                db_module._ensure_columns(conn)
            # Second call — must succeed without error
            with bare_engine.begin() as conn:
                db_module._ensure_columns(conn)

            with bare_engine.connect() as conn:
                cols = _column_names(conn, "watchlist_items")
            assert "alert_active" in cols
            assert "alert_last_fired_at" in cols
        finally:
            db_module.engine = original_engine
            db_module._is_sqlite = original_sqlite

    def test_full_schema_has_columns(self, fresh_db):  # noqa: F811
        """(c) The real schema built by init_db (via the autouse fresh_db
        fixture) already exposes both alert columns via PRAGMA table_info."""
        import db
        with db.engine.connect() as conn:
            cols = _column_names(conn, "watchlist_items")
        assert "alert_active" in cols, "full schema should have alert_active"
        assert "alert_last_fired_at" in cols, "full schema should have alert_last_fired_at"
