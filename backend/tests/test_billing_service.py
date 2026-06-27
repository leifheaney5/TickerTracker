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
