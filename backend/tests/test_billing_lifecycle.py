"""End-to-end billing data-flow verification: drive a full Stripe subscription
lifecycle through the webhook handler and assert billing state at every step.

This complements the unit tests by proving the *sequence* of real-world events
produces correct, idempotent data — the thing that must be "perfect" before
going live."""
import db
import models
import services.billing as billing


def _mk_user(email):
    with db.get_session() as s:
        u = models.User(email=email, name="Sub", email_verified=True)
        s.add(u); s.flush()
        s.add(models.Settings(user_id=u.id))
        s.commit()
        return u.id


def _sub_obj(uid, status, sub_id="sub_LIVE", cust="cus_LIVE",
             cancel=False, period_end=1893456000):
    return {
        "id": sub_id, "customer": cust, "status": status,
        "cancel_at_period_end": cancel, "current_period_end": period_end,
        "metadata": {"user_id": str(uid)},
        "items": {"data": [{"price": {"id": "price_annual"}}]},
    }


def _event(eid, etype, obj):
    return {"id": eid, "type": etype, "data": {"object": obj}}


def test_full_subscription_lifecycle_data_is_correct():
    uid = _mk_user("lifecycle@example.com")

    # 0) Brand-new user: Free, no subscription row.
    st = billing.get_billing_state(uid)
    assert st["plan"] == "free" and st["is_pro"] is False
    assert st["status"] == "" and st["current_period_end"] is None

    # 1) Checkout completes -> customer linked, becomes Pro.
    assert billing.handle_webhook_event(_event(
        "evt_1", "checkout.session.completed",
        {"client_reference_id": str(uid), "customer": "cus_LIVE",
         "subscription": "sub_LIVE", "metadata": {"user_id": str(uid)}})) is True
    st = billing.get_billing_state(uid)
    assert st["is_pro"] is True and st["plan"] == "pro"

    # 2) subscription.created with full detail -> price + period_end populated.
    assert billing.handle_webhook_event(_event(
        "evt_2", "customer.subscription.created", _sub_obj(uid, "active"))) is True
    st = billing.get_billing_state(uid)
    assert st["is_pro"] is True
    assert st["current_period_end"] is not None
    assert st["cancel_at_period_end"] is False
    with db.get_session() as s:
        sub = s.query(models.BillingSubscription).filter_by(user_id=uid).first()
        assert sub.stripe_customer_id == "cus_LIVE"
        assert sub.stripe_subscription_id == "sub_LIVE"
        assert sub.stripe_price_id == "price_annual"

    # 3) User schedules cancellation (still active until period end) -> still Pro,
    #    cancel flag now true.
    assert billing.handle_webhook_event(_event(
        "evt_3", "customer.subscription.updated",
        _sub_obj(uid, "active", cancel=True))) is True
    st = billing.get_billing_state(uid)
    assert st["is_pro"] is True and st["cancel_at_period_end"] is True

    # 4) Payment fails -> past_due is NOT Pro; Free limits return immediately.
    assert billing.handle_webhook_event(_event(
        "evt_4", "customer.subscription.updated",
        _sub_obj(uid, "past_due"))) is True
    st = billing.get_billing_state(uid)
    assert st["is_pro"] is False and st["plan"] == "free"
    assert st["status"] == "past_due"
    assert st["limits"]["watchlist"] == 15  # downgraded limits

    # 5) Recovery -> active again -> Pro restored.
    assert billing.handle_webhook_event(_event(
        "evt_5", "customer.subscription.updated",
        _sub_obj(uid, "active"))) is True
    assert billing.is_pro(uid) is True

    # 6) Final deletion -> canceled, Free.
    assert billing.handle_webhook_event(_event(
        "evt_6", "customer.subscription.deleted",
        _sub_obj(uid, "canceled"))) is True
    st = billing.get_billing_state(uid)
    assert st["is_pro"] is False and st["status"] == "canceled"

    # 7) Idempotency: replaying ANY processed event id is a no-op and does not
    #    resurrect a stale state.
    assert billing.handle_webhook_event(_event(
        "evt_5", "customer.subscription.updated", _sub_obj(uid, "active"))) is False
    assert billing.is_pro(uid) is False  # still canceled, replay ignored


def test_usage_reflects_real_rows_across_plans():
    uid = _mk_user("usagelive@example.com")
    with db.get_session() as s:
        for i in range(20):
            s.add(models.WatchlistItem(user_id=uid, symbol=f"S{i}",
                                       alert_active=(i < 5)))
        for i in range(3):
            s.add(models.SavedScreen(user_id=uid, name=f"sc{i}", filters_json="{}"))
        s.commit()
    # Free view of usage (over the would-be limits, but usage is truthful).
    usage = billing.get_usage(uid)
    assert usage == {"watchlist": 20, "alerts": 5, "screens": 3}
    # Make Pro; usage identical, limits expand.
    billing.handle_webhook_event(_event(
        "evt_u", "customer.subscription.created", _sub_obj(uid, "active")))
    st = billing.get_billing_state(uid)
    assert st["usage"] == {"watchlist": 20, "alerts": 5, "screens": 3}
    assert st["limits"]["watchlist"] == 250 and st["limits"]["screens"] == 25
