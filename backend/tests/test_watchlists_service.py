# backend/tests/test_watchlists_service.py
import os
os.environ.setdefault("DATABASE_URL", "sqlite://")
import pytest
import db, models
from services import watchlists as wl


def _fresh_user(plan="free"):
    models.Base.metadata.drop_all(db.engine)
    models.Base.metadata.create_all(db.engine)
    with db.get_session() as s:
        u = models.User(email="u@x.com", name="U", plan=plan)
        s.add(u); s.commit()
        return u.id


def test_primary_list_created_lazily():
    uid = _fresh_user()
    lid = wl.get_or_create_primary_list(uid)
    assert isinstance(lid, int)
    # idempotent
    assert wl.get_or_create_primary_list(uid) == lid


def test_free_user_cannot_create_second_list():
    uid = _fresh_user("free")
    wl.get_or_create_primary_list(uid)
    with pytest.raises(wl.PremiumRequired):
        wl.create_watchlist(uid, "Prospective")


def test_premium_user_can_create_many_lists():
    uid = _fresh_user("premium")
    wl.get_or_create_primary_list(uid)
    a = wl.create_watchlist(uid, "Tech")
    b = wl.create_watchlist(uid, "Crypto")
    assert a["name"] == "Tech" and b["name"] == "Crypto"
    assert len(wl.list_watchlists(uid)) == 3


def test_free_user_capped_at_10_active_items():
    uid = _fresh_user("free")
    lid = wl.get_or_create_primary_list(uid)
    for i in range(10):
        wl.add_item(uid, lid, f"AA{i}")
    with pytest.raises(wl.FreeLimit):
        wl.add_item(uid, lid, "OVER")


def test_locked_flag_and_active_symbols_exclude_overflow():
    uid = _fresh_user("premium")  # create 12 then downgrade to test locking
    lid = wl.get_or_create_primary_list(uid)
    for i in range(12):
        wl.add_item(uid, lid, f"S{i}")
    with db.get_session() as s:
        s.get(models.User, uid).plan = "free"; s.commit()
    lists = wl.list_watchlists(uid)
    items = lists[0]["items"]
    assert sum(1 for it in items if it["locked"]) == 2
    assert len(wl.active_symbols(uid)) == 10


def test_cannot_delete_last_list():
    uid = _fresh_user("premium")
    wl.get_or_create_primary_list(uid)
    with pytest.raises(wl.LastList):
        only = wl.list_watchlists(uid)[0]
        wl.delete_watchlist(uid, only["id"])


def test_move_item_between_lists():
    uid = _fresh_user("premium")
    a = wl.get_or_create_primary_list(uid)
    b = wl.create_watchlist(uid, "B")["id"]
    wl.add_item(uid, a, "NVDA")
    moved = wl.update_item(uid, a, "NVDA", watchlist_id=b)
    assert moved["watchlist_id"] == b
    assert "NVDA" not in [i["symbol"] for i in wl.list_watchlists(uid)[0]["items"] if wl.list_watchlists(uid)[0]["id"] == a]
