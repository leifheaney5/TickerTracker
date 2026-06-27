# backend/tests/test_digest_service.py
import services.digest as dg


def test_build_digest_html_lists_symbols():
    html = dg.build_digest_html("Sam", [
        {"symbol": "AAPL", "price": 283.78, "change_pct": 1.2},
        {"symbol": "NVDA", "price": 192.53, "change_pct": -0.8},
    ])
    assert "AAPL" in html and "NVDA" in html
    assert "Sam" in html


def test_send_weekly_digest_only_opted_in(monkeypatch):
    sent = []
    def fake_quote(syms): return ({s: {"price": 10.0, "change_pct": 1.0} for s in syms}, "t")
    def fake_send(to, subject, html): sent.append(to); return True
    dg._seed_for_test(email="in@e.com", news_digest=True, symbol="AAPL")
    dg._seed_for_test(email="out@e.com", news_digest=False, symbol="AAPL")
    n = dg.send_weekly_digest(quote_fn=fake_quote, send_fn=fake_send)
    assert n == 1
    assert sent == ["in@e.com"]
