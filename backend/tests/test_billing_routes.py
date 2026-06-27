import db
import models
from auth.passwords import hash_password
from app import app


def _verified_client(email="billing_user@example.com"):
    c = app.test_client()
    with db.get_session() as s:
        s.add(models.User(email=email, password_hash=hash_password("password123"),
                          email_verified=True))
        s.commit()
    c.post("/api/auth/login", json={"email": email, "password": "password123"})
    return c


def test_billing_get_requires_auth():
    assert app.test_client().get("/api/billing").status_code == 401


def test_billing_get_returns_free_state():
    r = _verified_client().get("/api/billing")
    assert r.status_code == 200
    data = r.get_json()["data"]
    assert data["plan"] == "free" and data["is_pro"] is False


def test_checkout_requires_auth():
    assert app.test_client().post("/api/billing/checkout",
                                  json={"interval": "annual"}).status_code == 401


def test_checkout_503_when_unconfigured(monkeypatch):
    monkeypatch.delenv("STRIPE_SECRET_KEY", raising=False)
    r = _verified_client("co_route@example.com").post(
        "/api/billing/checkout", json={"interval": "annual"})
    assert r.status_code == 503


def test_portal_503_without_customer(monkeypatch):
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_x")
    r = _verified_client("po_route@example.com").post("/api/billing/portal")
    assert r.status_code == 503


def test_webhook_bad_signature_400(monkeypatch):
    monkeypatch.setenv("STRIPE_WEBHOOK_SECRET", "whsec_x")
    r = app.test_client().post("/api/stripe/webhook", data=b"{}",
                               headers={"Stripe-Signature": "bad"})
    assert r.status_code == 400


def test_webhook_valid_event_processed(monkeypatch):
    import stripe
    uid_holder = {}
    c = app.test_client()
    with db.get_session() as s:
        u = models.User(email="wh_route@example.com", email_verified=True)
        s.add(u); s.flush(); uid_holder["id"] = u.id; s.commit()
    event = {
        "id": "evt_route_1", "type": "customer.subscription.created",
        "data": {"object": {"id": "sub_r", "customer": "cus_r", "status": "active",
                            "current_period_end": 1893456000, "cancel_at_period_end": False,
                            "metadata": {"user_id": str(uid_holder["id"])},
                            "items": {"data": [{"price": {"id": "price_annual"}}]}}},
    }
    monkeypatch.setattr(stripe.Webhook, "construct_event",
                        staticmethod(lambda payload, sig, secret: event))
    r = c.post("/api/stripe/webhook", data=b"{}",
               headers={"Stripe-Signature": "good"})
    assert r.status_code == 200 and r.get_json()["received"] is True
    import services.billing as billing
    assert billing.is_pro(uid_holder["id"]) is True
