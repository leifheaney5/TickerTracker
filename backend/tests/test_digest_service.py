# backend/tests/test_digest_service.py
import db, models
import services.digest as dg
from services import premium


def test_build_digest_html_lists_symbols():
    html = dg.build_digest_html("Sam", [
        {"symbol": "AAPL", "price": 283.78, "change_pct": 1.2},
        {"symbol": "NVDA", "price": 192.53, "change_pct": -0.8},
    ])
    assert "AAPL" in html and "NVDA" in html
    assert "Sam" in html


def test_digest_escapes_user_name_and_symbol():
    # A name (and symbol) containing HTML must be escaped, not rendered raw.
    html = dg.build_digest_html('<script>alert(1)</script>', [
        {"symbol": "<b>X</b>", "price": 10.0, "change_pct": 1.0},
    ])
    assert "<script>" not in html
    assert "&lt;script&gt;" in html
    assert "<b>X</b>" not in html
    assert "&lt;b&gt;X&lt;/b&gt;" in html


def test_send_weekly_digest_only_opted_in(monkeypatch):
    sent = []
    def fake_quote(syms): return ({s: {"price": 10.0, "change_pct": 1.0} for s in syms}, "t")
    def fake_send(to, subject, html): sent.append(to); return True
    dg._seed_for_test(email="in@e.com", news_digest=True, symbol="AAPL")
    dg._seed_for_test(email="out@e.com", news_digest=False, symbol="AAPL")
    n = dg.send_weekly_digest(quote_fn=fake_quote, send_fn=fake_send)
    assert n == 1
    assert sent == ["in@e.com"]


def test_locked_overflow_items_excluded_from_digest():
    """Free user with 12 items (indices 10+11 locked): locked overflow tickers
    must NOT appear in the digest payload sent to that user."""
    # Reset DB for clean state
    models.Base.metadata.drop_all(db.engine)
    models.Base.metadata.create_all(db.engine)

    with db.get_session() as s:
        u = models.User(email="dlock@e.com", name="D", email_verified=True, plan="premium")
        s.add(u); s.flush()
        s.add(models.Settings(user_id=u.id, news_digest=True,
                              unsub_token="tok-digest-test"))
        wl = models.Watchlist(user_id=u.id, name="My Watchlist", position=0)
        s.add(wl); s.flush()
        for i in range(12):
            s.add(models.WatchlistItem(
                user_id=u.id, watchlist_id=wl.id, symbol=f"DK{i}", position=i,
            ))
        s.commit()
        uid = u.id

    # Downgrade to free — items at index >= 10 become locked
    with db.get_session() as s:
        s.get(models.User, uid).plan = "free"; s.commit()

    captured_html = []
    def fake_quote(syms): return ({sym: {"price": 5.0, "change_pct": 0.5} for sym in syms}, "t")
    def fake_send(to, subject, html): captured_html.append(html); return True

    n = dg.send_weekly_digest(quote_fn=fake_quote, send_fn=fake_send)
    assert n == 1, "digest email should be sent to the opted-in user"

    html = captured_html[0]
    # Active symbols (DK0..DK9) must appear; locked (DK10, DK11) must not
    for i in range(premium.FREE_MAX_ACTIVE_ITEMS):
        assert f"DK{i}" in html, f"Active symbol DK{i} missing from digest"
    for locked_sym in ("DK10", "DK11"):
        assert locked_sym not in html, (
            f"Locked symbol {locked_sym} leaked into digest"
        )
