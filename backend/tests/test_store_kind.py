# backend/tests/test_store_kind.py
import db
import models
import services.store as store
from auth import current_user_id


def _mk_user(s):
    u = models.User(email="kind@t.co", name="t", email_verified=True)
    s.add(u); s.flush()
    return u.id


def test_add_crypto_watch_preserves_id_case_and_kind(monkeypatch):
    db.Base.metadata.create_all(db.engine)
    with db.get_session() as s:
        uid = _mk_user(s); s.commit()
    monkeypatch.setattr(store, "current_user_id", lambda: uid)
    item = store.add_watch("solana", kind="crypto", coin_name="Solana", target=200)
    assert item["symbol"] == "solana"      # NOT upper-cased for crypto
    assert item["kind"] == "crypto"
    assert item["coin_name"] == "Solana"
    rows = store.get_watchlist()
    assert any(r["symbol"] == "solana" and r["kind"] == "crypto" for r in rows)


def test_add_stock_watch_still_upper_cases():
    # stock path unchanged: symbol upper-cased, kind defaults to "stock"
    import db as _db
    _db.Base.metadata.create_all(_db.engine)
    with _db.get_session() as s:
        u = models.User(email="kind2@t.co", name="t", email_verified=True)
        s.add(u); s.flush(); uid = u.id; s.commit()
    store.current_user_id = lambda: uid  # simple override
    item = store.add_watch("nvda")
    assert item["symbol"] == "NVDA" and item["kind"] == "stock"
