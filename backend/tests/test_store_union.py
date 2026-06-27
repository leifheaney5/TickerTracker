import os
os.environ.setdefault("DATABASE_URL", "sqlite://")
from unittest.mock import patch
import db, models
from services import store, watchlists


def _fresh_user(plan="premium"):
    models.Base.metadata.drop_all(db.engine)
    models.Base.metadata.create_all(db.engine)
    with db.get_session() as s:
        u = models.User(email="u@x.com", name="U", plan=plan)
        s.add(u); s.commit()
        return u.id


def test_get_watchlist_returns_union_excluding_locked():
    uid = _fresh_user("free")
    lid = watchlists.get_or_create_primary_list(uid)
    for i in range(12):
        with db.get_session() as s:
            s.add(models.WatchlistItem(user_id=uid, watchlist_id=lid, symbol=f"S{i}", position=i)); s.commit()
    with patch("services.store.current_user_id", return_value=uid):
        syms = [w["symbol"] for w in store.get_watchlist()]
    assert len(syms) == 10  # locked overflow excluded
    assert "S10" not in syms


def test_add_watch_targets_primary_list():
    uid = _fresh_user("premium")
    with patch("services.store.current_user_id", return_value=uid):
        store.add_watch("NVDA", target=200)
        syms = [w["symbol"] for w in store.get_watchlist()]
    assert "NVDA" in syms
