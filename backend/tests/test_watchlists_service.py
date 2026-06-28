# backend/tests/test_watchlists_service.py
import os
os.environ.setdefault("DATABASE_URL", "sqlite://")
import pytest
import db, models
from services import watchlists as wl
from services import premium


def _fresh_user(pro=False):
    """Fresh DB + one user. pro=True attaches an active Stripe subscription so
    billing.is_pro() is True. Premium status is billing-backed now (no User.plan)."""
    models.Base.metadata.drop_all(db.engine)
    models.Base.metadata.create_all(db.engine)
    with db.get_session() as s:
        u = models.User(email="u@x.com", name="U")
        s.add(u); s.flush()
        if pro:
            s.add(models.BillingSubscription(user_id=u.id, status="active", plan="pro"))
        s.commit()
        return u.id


def test_primary_list_created_lazily():
    uid = _fresh_user()
    lid = wl.get_or_create_primary_list(uid)
    assert isinstance(lid, int)
    # idempotent
    assert wl.get_or_create_primary_list(uid) == lid


def test_free_user_cannot_create_second_list(monkeypatch):
    monkeypatch.setenv("BILLING_ENABLED", "1")  # enforce limits
    uid = _fresh_user()  # free: no subscription
    wl.get_or_create_primary_list(uid)
    with pytest.raises(wl.PremiumRequired):
        wl.create_watchlist(uid, "Prospective")


def test_pro_user_can_create_many_lists():
    uid = _fresh_user(pro=True)
    wl.get_or_create_primary_list(uid)
    a = wl.create_watchlist(uid, "Tech")
    b = wl.create_watchlist(uid, "Crypto")
    assert a["name"] == "Tech" and b["name"] == "Crypto"
    assert len(wl.list_watchlists(uid)) == 3


def test_free_user_capped_at_active_items(monkeypatch):
    monkeypatch.setenv("BILLING_ENABLED", "1")
    uid = _fresh_user()  # free
    lid = wl.get_or_create_primary_list(uid)
    for i in range(premium.FREE_MAX_ACTIVE_ITEMS):
        wl.add_item(uid, lid, f"AA{i}")
    with pytest.raises(wl.FreeLimit):
        wl.add_item(uid, lid, "OVER")


def test_locked_flag_and_active_symbols_exclude_overflow(monkeypatch):
    # Build items as Pro (no cap), then drop to free + enforce so the overflow
    # beyond FREE_MAX_ACTIVE_ITEMS becomes locked.
    cap = premium.FREE_MAX_ACTIVE_ITEMS
    uid = _fresh_user(pro=True)
    lid = wl.get_or_create_primary_list(uid)
    for i in range(cap + 2):
        wl.add_item(uid, lid, f"S{i}")
    with db.get_session() as s:  # downgrade: remove subscription
        sub = s.query(models.BillingSubscription).filter_by(user_id=uid).first()
        if sub:
            s.delete(sub); s.commit()
    monkeypatch.setenv("BILLING_ENABLED", "1")
    lists = wl.list_watchlists(uid)
    items = lists[0]["items"]
    assert sum(1 for it in items if it["locked"]) == 2
    assert len(wl.active_symbols(uid)) == cap


def test_cannot_delete_last_list():
    uid = _fresh_user(pro=True)
    wl.get_or_create_primary_list(uid)
    with pytest.raises(wl.LastList):
        only = wl.list_watchlists(uid)[0]
        wl.delete_watchlist(uid, only["id"])


def test_move_item_between_lists():
    uid = _fresh_user(pro=True)
    a = wl.get_or_create_primary_list(uid)
    b = wl.create_watchlist(uid, "B")["id"]
    wl.add_item(uid, a, "NVDA")
    moved = wl.update_item(uid, a, "NVDA", watchlist_id=b)
    assert moved["watchlist_id"] == b
    assert "NVDA" not in [i["symbol"] for i in wl.list_watchlists(uid)[0]["items"] if wl.list_watchlists(uid)[0]["id"] == a]


def test_move_into_unowned_list_raises():
    # _fresh_user resets the schema, so create user A first, then add user B
    # without resetting, so both coexist.
    uidA = _fresh_user(pro=True)
    with db.get_session() as s:
        ub = models.User(email="b@x.com", name="B")
        s.add(ub); s.commit()
        uidB = ub.id
    la = wl.get_or_create_primary_list(uidA)
    lb = wl.get_or_create_primary_list(uidB)
    wl.add_item(uidA, la, "NVDA")
    with pytest.raises(ValueError):
        wl.update_item(uidA, la, "NVDA", watchlist_id=lb)
    # item stays in A's original list — move was rejected, not silently dropped
    item = wl.list_watchlists(uidA)[0]["items"][0]
    assert item["symbol"] == "NVDA"
    assert item["watchlist_id"] == la


def test_move_deduplicates_symbol_already_in_dest():
    """Moving NVDA from list A to list B when B already has NVDA must result in
    exactly ONE NVDA row in B and zero rows in A — no duplicate created."""
    uid = _fresh_user(pro=True)
    a = wl.get_or_create_primary_list(uid)
    b = wl.create_watchlist(uid, "B")["id"]
    wl.add_item(uid, a, "NVDA")
    wl.add_item(uid, b, "NVDA")

    # Move NVDA from A -> B (B already has NVDA)
    result = wl.update_item(uid, a, "NVDA", watchlist_id=b)
    assert result is not None
    assert result["watchlist_id"] == b

    # Exactly one NVDA row in B, zero in A
    with db.get_session() as s:
        count_b = s.query(models.WatchlistItem).filter_by(
            user_id=uid, watchlist_id=b, symbol="NVDA").count()
        count_a = s.query(models.WatchlistItem).filter_by(
            user_id=uid, watchlist_id=a, symbol="NVDA").count()
    assert count_b == 1, f"Expected 1 NVDA in list B, got {count_b}"
    assert count_a == 0
