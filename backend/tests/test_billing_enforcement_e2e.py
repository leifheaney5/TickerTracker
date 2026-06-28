"""HTTP-layer enforcement verification: with BILLING_ENABLED=true, a Pro user
must NOT be blocked at any Free threshold, and a Free user must be blocked with
the consistent 402 body. Proves Pro unlock works end-to-end through the WSGI app."""
import pytest
import db
import models
from auth.passwords import hash_password
from app import app


@pytest.fixture
def billing_on(monkeypatch):
    monkeypatch.setenv("BILLING_ENABLED", "true")


def _client(email, pro=False):
    c = app.test_client()
    with db.get_session() as s:
        u = models.User(email=email, password_hash=hash_password("password123"),
                        email_verified=True)
        s.add(u); s.flush()
        if pro:
            s.add(models.BillingSubscription(user_id=u.id, status="active",
                                             plan="pro", stripe_customer_id="cus_x"))
        s.commit()
    c.post("/api/auth/login", json={"email": email, "password": "password123"})
    return c


def test_pro_user_not_blocked_at_any_free_threshold(billing_on):
    c = _client("pro_unlock@example.com", pro=True)
    # 16+ watchlist tickers (Free cap is 15) — all allowed.
    for i in range(20):
        r = c.post("/api/watchlist", json={"symbol": f"PRO{i}", "alert_price": 10})
        assert r.status_code == 200, f"ticker {i} blocked: {r.get_json()}"
    # 4+ active alerts (Free cap 3) — all allowed.
    for i in range(4):
        r = c.patch(f"/api/watchlist/PRO{i}", json={"alert_active": True})
        assert r.status_code == 200, f"alert {i} blocked: {r.get_json()}"
    # 2+ saved screens (Free cap 1) — allowed.
    for i in range(5):
        assert c.post("/api/screens", json={"name": f"s{i}", "filters": {}}).status_code == 200
    # Weekly digest enable (Pro feature) — allowed.
    assert c.patch("/api/settings", json={"news_digest": True}).status_code == 200
    assert c.get("/api/settings").get_json()["data"]["news_digest"] is True
    # Billing endpoint reports Pro with expanded limits.
    bs = c.get("/api/billing").get_json()["data"]
    assert bs["is_pro"] is True and bs["limits"]["watchlist"] == 250


def test_free_user_402_body_shape_is_consistent(billing_on):
    c = _client("free_shape@example.com", pro=False)
    for i in range(15):
        assert c.post("/api/watchlist", json={"symbol": f"FRE{i}"}).status_code == 200
    r = c.post("/api/watchlist", json={"symbol": "OVER"})
    assert r.status_code == 402
    body = r.get_json()
    # Exact consistent contract the frontend upgrade prompt depends on.
    assert set(body.keys()) >= {"error", "feature", "limit", "plan", "message"}
    assert body["error"] == "limit_exceeded"
    assert body["feature"] == "watchlist"
    assert body["limit"] == 15
    assert body["plan"] == "free"
    assert isinstance(body["message"], str) and body["message"]


def test_billing_disabled_enforces_nothing(monkeypatch):
    # Sanity: with the launch gate OFF, Free users are not blocked (pre-launch).
    monkeypatch.delenv("BILLING_ENABLED", raising=False)
    c = _client("gate_off@example.com", pro=False)
    for i in range(20):
        assert c.post("/api/watchlist", json={"symbol": f"OFF{i}"}).status_code == 200
