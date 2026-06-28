# backend/tests/test_digest_service.py
import services.digest as dg


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


def test_digest_skips_non_pro_users():
    import db, models
    import services.digest as digest
    # Two opted-in verified users; only one is Pro.
    with db.get_session() as s:
        pro = models.User(email="pro_dg@example.com", name="P", email_verified=True)
        free = models.User(email="free_dg@example.com", name="F", email_verified=True)
        s.add(pro); s.add(free); s.flush()
        s.add(models.Settings(user_id=pro.id, news_digest=True))
        s.add(models.Settings(user_id=free.id, news_digest=True))
        s.add(models.WatchlistItem(user_id=pro.id, symbol="AAPL"))
        s.add(models.WatchlistItem(user_id=free.id, symbol="AAPL"))
        s.add(models.BillingSubscription(user_id=pro.id, status="active", plan="pro"))
        s.commit()
    sent = []
    n = digest.send_weekly_digest(
        quote_fn=lambda syms: ({s: {"price": 1.0, "change_pct": 0.0} for s in syms}, "mock"),
        send_fn=lambda to, subj, html: sent.append(to) or True,
    )
    assert n == 1 and sent == ["pro_dg@example.com"]
