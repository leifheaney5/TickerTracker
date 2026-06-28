import models
import db
import services.billing as billing


def _mk_user(email="b@example.com"):
    with db.get_session() as s:
        u = models.User(email=email, name="B", email_verified=True)
        s.add(u); s.flush()
        s.add(models.Settings(user_id=u.id))
        s.commit()
        return u.id


def _mk_sub(user_id, status="active", plan="pro"):
    with db.get_session() as s:
        s.add(models.BillingSubscription(user_id=user_id, status=status, plan=plan,
                                         stripe_customer_id="cus_1"))
        s.commit()


def test_billing_tables_exist():
    # New tables must be importable as ORM models with the spec'd columns.
    cols = {c.name for c in models.BillingSubscription.__table__.columns}
    assert {"user_id", "plan", "status", "stripe_customer_id",
            "stripe_subscription_id", "stripe_price_id", "current_period_end",
            "cancel_at_period_end", "updated_at"} <= cols
    ev = {c.name for c in models.StripeEvent.__table__.columns}
    assert {"event_id", "event_type", "received_at"} <= ev


def test_free_state_defaults_for_new_user():
    uid = _mk_user()
    st = billing.get_billing_state(uid)
    assert st["plan"] == "free"
    assert st["is_pro"] is False
    assert st["limits"]["watchlist"] == 15
    assert st["limits"]["alerts"] == 3
    assert st["limits"]["screens"] == 1
    assert st["limits"]["digest"] is False
    assert st["limits"]["compare"] == 2
    assert st["usage"] == {"watchlist": 0, "alerts": 0, "screens": 0}


def test_pro_state_unlocks_pro_limits():
    uid = _mk_user("pro@example.com")
    _mk_sub(uid, status="active")
    st = billing.get_billing_state(uid)
    assert st["plan"] == "pro" and st["is_pro"] is True
    assert st["limits"]["watchlist"] == 250
    assert st["limits"]["digest"] is True
    assert st["limits"]["compare"] == 10


def test_trialing_counts_as_pro_but_canceled_does_not():
    uid = _mk_user("trial@example.com")
    _mk_sub(uid, status="trialing")
    assert billing.is_pro(uid) is True
    uid2 = _mk_user("cancel@example.com")
    _mk_sub(uid2, status="canceled", plan="free")
    assert billing.is_pro(uid2) is False


def test_usage_counts_watchlist_active_alerts_and_screens():
    uid = _mk_user("usage@example.com")
    with db.get_session() as s:
        s.add(models.WatchlistItem(user_id=uid, symbol="AAPL", alert_active=True))
        s.add(models.WatchlistItem(user_id=uid, symbol="MSFT", alert_active=False))
        s.add(models.SavedScreen(user_id=uid, name="x", filters_json="{}"))
        s.commit()
    usage = billing.get_usage(uid)
    assert usage == {"watchlist": 2, "alerts": 1, "screens": 1}


import pytest


@pytest.fixture
def billing_on(monkeypatch):
    monkeypatch.setenv("BILLING_ENABLED", "true")


def _add_symbols(uid, n, active=0):
    with db.get_session() as s:
        for i in range(n):
            s.add(models.WatchlistItem(user_id=uid, symbol=f"SYM{i}",
                                       alert_active=(i < active)))
        s.commit()


def test_watchlist_limit_blocks_16th_but_allows_existing(billing_on):
    uid = _mk_user("wl@example.com")
    _add_symbols(uid, 15)
    err = billing.check_watchlist_add(uid, "NEWONE")
    assert err["error"] == "limit_exceeded" and err["feature"] == "watchlist"
    assert err["limit"] == 15 and err["plan"] == "free"
    assert billing.check_watchlist_add(uid, "SYM0") is None


def test_watchlist_limit_disabled_when_billing_off():
    uid = _mk_user("wloff@example.com")
    _add_symbols(uid, 15)
    assert billing.check_watchlist_add(uid, "NEWONE") is None  # BILLING_ENABLED unset


def test_pro_watchlist_allows_more_than_15(billing_on):
    uid = _mk_user("wlpro@example.com")
    _mk_sub(uid, status="active")
    _add_symbols(uid, 15)
    assert billing.check_watchlist_add(uid, "NEWONE") is None


def test_active_alert_limit_blocks_4th(billing_on):
    uid = _mk_user("al@example.com")
    _add_symbols(uid, 5, active=3)
    err = billing.check_alert_activate(uid, "SYM3")
    assert err["feature"] == "alerts" and err["limit"] == 3
    assert billing.check_alert_activate(uid, "SYM0") is None


def test_screen_limit_blocks_2nd(billing_on):
    uid = _mk_user("sc@example.com")
    with db.get_session() as s:
        s.add(models.SavedScreen(user_id=uid, name="one", filters_json="{}"))
        s.commit()
    err = billing.check_screen_add(uid)
    assert err["feature"] == "screens" and err["limit"] == 1


def test_digest_enable_blocked_for_free(billing_on):
    uid = _mk_user("dg@example.com")
    err = billing.check_digest_enable(uid)
    assert err["feature"] == "digest"
    uid2 = _mk_user("dgpro@example.com")
    _mk_sub(uid2, status="active")
    assert billing.check_digest_enable(uid2) is None


class _FakeSession:
    def __init__(self, url):
        self.url = url


def test_checkout_requires_stripe_env(monkeypatch):
    monkeypatch.delenv("STRIPE_SECRET_KEY", raising=False)
    uid = _mk_user("co@example.com")
    with pytest.raises(billing.BillingNotConfigured):
        billing.create_checkout_session(uid, "annual")


def test_checkout_uses_annual_price_and_returns_url(monkeypatch):
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_x")
    monkeypatch.setenv("STRIPE_PRO_ANNUAL_PRICE_ID", "price_annual")
    monkeypatch.setenv("APP_BASE_URL", "http://localhost:5000")
    uid = _mk_user("co2@example.com")
    captured = {}

    import stripe
    def _create(**kwargs):
        captured.update(kwargs)
        return _FakeSession("https://checkout.stripe.test/sess")
    monkeypatch.setattr(stripe.checkout.Session, "create", staticmethod(_create))

    url = billing.create_checkout_session(uid, "annual")
    assert url == "https://checkout.stripe.test/sess"
    assert captured["mode"] == "subscription"
    assert captured["line_items"][0]["price"] == "price_annual"
    assert captured["client_reference_id"] == str(uid)


def test_portal_requires_existing_customer(monkeypatch):
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_x")
    uid = _mk_user("po@example.com")  # no subscription row -> no customer id
    with pytest.raises(billing.BillingNotConfigured):
        billing.create_portal_session(uid)


def test_portal_returns_url_when_customer_exists(monkeypatch):
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_x")
    monkeypatch.setenv("APP_BASE_URL", "http://localhost:5000")
    uid = _mk_user("po2@example.com")
    _mk_sub(uid, status="active")  # sets stripe_customer_id="cus_1"
    import stripe
    monkeypatch.setattr(stripe.billing_portal.Session, "create",
                        staticmethod(lambda **kw: _FakeSession("https://portal.test/x")))
    assert billing.create_portal_session(uid) == "https://portal.test/x"


def _sub_event(etype, uid, status="active", sub_id="sub_1", cust="cus_9"):
    return {
        "id": f"evt_{etype}_{uid}",
        "type": etype,
        "data": {"object": {
            "id": sub_id,
            "customer": cust,
            "status": status,
            "cancel_at_period_end": False,
            "current_period_end": 1893456000,  # 2030-01-01
            "metadata": {"user_id": str(uid)},
            "items": {"data": [{"price": {"id": "price_annual"}}]},
        }},
    }


def test_webhook_subscription_created_sets_pro():
    uid = _mk_user("wh1@example.com")
    assert billing.handle_webhook_event(_sub_event("customer.subscription.created", uid)) is True
    assert billing.is_pro(uid) is True
    st = billing.get_billing_state(uid)
    assert st["status"] == "active"
    assert st["current_period_end"] is not None


def test_webhook_subscription_updated_then_deleted():
    uid = _mk_user("wh2@example.com")
    billing.handle_webhook_event(_sub_event("customer.subscription.created", uid))
    billing.handle_webhook_event(_sub_event("customer.subscription.deleted", uid,
                                            status="canceled", sub_id="sub_1"))
    assert billing.is_pro(uid) is False


def test_duplicate_webhook_event_ignored():
    uid = _mk_user("wh3@example.com")
    ev = _sub_event("customer.subscription.created", uid)
    assert billing.handle_webhook_event(ev) is True
    assert billing.handle_webhook_event(ev) is False  # same event id


def test_webhook_checkout_completed_links_customer():
    uid = _mk_user("wh4@example.com")
    ev = {
        "id": "evt_checkout_1",
        "type": "checkout.session.completed",
        "data": {"object": {
            "client_reference_id": str(uid),
            "customer": "cus_link",
            "subscription": "sub_link",
            "metadata": {"user_id": str(uid)},
        }},
    }
    assert billing.handle_webhook_event(ev) is True
    assert billing._existing_customer_id(uid) == "cus_link"
