"""Tests for M-1 (rate limit) and M-2 (mass-assignment allowlist) hardening."""
import app as appmod
from app import app


def _reset_rl():
    with appmod._rl_lock:
        appmod._rl_hits.clear()


def test_market_endpoint_rate_limited(monkeypatch):
    _reset_rl()
    # Make the upstream cheap/deterministic so the test only exercises the limiter.
    monkeypatch.setattr(appmod, "get_quotes", lambda syms: ({}, "mock"))
    c = app.test_client()
    # Under the cap: all 200. Over the cap: 429.
    limit = appmod._RL_MAX
    statuses = [c.get("/api/quotes?syms=AAPL",
                      headers={"X-Forwarded-For": "9.9.9.9"}).status_code
                for _ in range(limit + 5)]
    assert statuses.count(429) >= 1
    assert statuses[0] == 200
    _reset_rl()


def test_rate_limit_is_per_ip(monkeypatch):
    _reset_rl()
    monkeypatch.setattr(appmod, "get_quotes", lambda syms: ({}, "mock"))
    c = app.test_client()
    # Exhaust IP A.
    for _ in range(appmod._RL_MAX + 2):
        c.get("/api/quotes?syms=AAPL", headers={"X-Forwarded-For": "1.1.1.1"})
    # A fresh IP is unaffected.
    r = c.get("/api/quotes?syms=AAPL", headers={"X-Forwarded-For": "2.2.2.2"})
    assert r.status_code == 200
    _reset_rl()


def test_settings_patch_ignores_unknown_fields(monkeypatch):
    # Patch update_settings to echo the fields it actually received.
    captured = {}
    monkeypatch.setattr(appmod, "update_settings",
                        lambda **f: captured.update(f) or {"ok": True})
    monkeypatch.setattr(appmod, "_require_user", lambda: 1)
    _reset_rl()
    app.test_client().patch("/api/settings", json={
        "currency": "EUR", "is_admin": True, "user_id": 999, "id": 5,
    })
    assert captured == {"currency": "EUR"}  # injected fields dropped


def test_watchlist_patch_allowlist(monkeypatch):
    captured = {}
    monkeypatch.setattr(appmod, "update_watch",
                        lambda sym, **f: captured.update(f) or {"symbol": sym})
    monkeypatch.setattr(appmod, "_require_user", lambda: 1)
    _reset_rl()
    app.test_client().patch("/api/watchlist/AAPL", json={
        "target": 200, "user_id": 7, "position": 0,
    })
    assert captured == {"target": 200}  # only allowlisted field passes through
