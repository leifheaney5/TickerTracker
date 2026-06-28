import os
os.environ.setdefault("DATABASE_URL", "sqlite://")
from unittest.mock import patch
import db, models
from services import store, watchlists, premium


def _fresh_user(pro=False):
    models.Base.metadata.drop_all(db.engine)
    models.Base.metadata.create_all(db.engine)
    with db.get_session() as s:
        u = models.User(email="u@x.com", name="U")
        s.add(u); s.flush()
        if pro:
            s.add(models.BillingSubscription(user_id=u.id, status="active", plan="pro"))
        s.commit()
        return u.id


def test_get_watchlist_returns_union_excluding_locked(monkeypatch):
    monkeypatch.setenv("BILLING_ENABLED", "1")  # enforce -> overflow is locked
    cap = premium.FREE_MAX_ACTIVE_ITEMS
    uid = _fresh_user()  # free
    lid = watchlists.get_or_create_primary_list(uid)
    for i in range(cap + 2):
        with db.get_session() as s:
            s.add(models.WatchlistItem(user_id=uid, watchlist_id=lid, symbol=f"S{i}", position=i)); s.commit()
    with patch("services.store.current_user_id", return_value=uid):
        syms = [w["symbol"] for w in store.get_watchlist()]
    assert len(syms) == cap  # locked overflow excluded
    assert f"S{cap}" not in syms


def test_add_watch_targets_primary_list():
    uid = _fresh_user(pro=True)
    with patch("services.store.current_user_id", return_value=uid):
        store.add_watch("NVDA", target=200)
        syms = [w["symbol"] for w in store.get_watchlist()]
    assert "NVDA" in syms
