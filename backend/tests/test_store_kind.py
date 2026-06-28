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


def test_remove_crypto_id_does_not_delete_same_letters_stock(monkeypatch):
    """Regression: remove_watch("ada") must NOT delete a STOCK row "ADA"."""
    db.Base.metadata.create_all(db.engine)
    with db.get_session() as s:
        u = models.User(email="kind3@t.co", name="t", email_verified=True)
        s.add(u); s.flush(); uid = u.id; s.commit()

    monkeypatch.setattr(store, "current_user_id", lambda: uid)

    # Add a STOCK "ADA" — no crypto "ada" row exists.
    store.add_watch("ADA", kind="stock")

    # Attempt to remove using the crypto id lowercase form.
    result = store.remove_watch("ada")

    # Should return False (no matching row found).
    assert result is False, "remove_watch('ada') should not remove stock 'ADA'"

    # The stock row must still be intact.
    wl = store.get_watchlist()
    assert any(w["symbol"] == "ADA" and w["kind"] == "stock" for w in wl), \
        "Stock 'ADA' was incorrectly deleted by remove_watch('ada')"
