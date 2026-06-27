import os
os.environ.setdefault("DATABASE_URL", "sqlite://")
from sqlalchemy import text
import db, models


def test_migration_creates_default_list_and_backfills():
    models.Base.metadata.drop_all(db.engine)
    with db.engine.begin() as c:
        c.execute(text("CREATE TABLE users (id INTEGER PRIMARY KEY, email VARCHAR, name VARCHAR, plan VARCHAR DEFAULT 'free', email_verified BOOLEAN DEFAULT 0, password_hash VARCHAR, phone VARCHAR, created_at DATETIME)"))
        c.execute(text("CREATE TABLE settings (user_id INTEGER PRIMARY KEY, share_token VARCHAR, unsub_token VARCHAR)"))
        c.execute(text("CREATE TABLE watchlist_items (id INTEGER PRIMARY KEY, user_id INTEGER, symbol VARCHAR, position INTEGER DEFAULT 0)"))
        c.execute(text("INSERT INTO users (id, email, name) VALUES (1, 'u@x.com', 'U')"))
        c.execute(text("INSERT INTO settings (user_id, share_token) VALUES (1, 'legacytoken')"))
        for i, sym in enumerate(["NVDA", "AAPL", "MSFT"]):
            c.execute(text("INSERT INTO watchlist_items (user_id, symbol, position) VALUES (1, :s, :p)"), {"s": sym, "p": i})

    db.init_db()  # should create watchlists table, add watchlist_id, backfill

    with db.get_session() as s:
        lists = s.query(models.Watchlist).filter_by(user_id=1).all()
        assert len(lists) == 1
        wl = lists[0]
        assert wl.name == "My Watchlist"
        assert wl.share_token == "legacytoken"
        items = s.query(models.WatchlistItem).filter_by(user_id=1).order_by(models.WatchlistItem.position).all()
        assert [it.symbol for it in items] == ["NVDA", "AAPL", "MSFT"]
        assert all(it.watchlist_id == wl.id for it in items)
