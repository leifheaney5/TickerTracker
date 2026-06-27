import models


def test_billing_tables_exist():
    # New tables must be importable as ORM models with the spec'd columns.
    cols = {c.name for c in models.BillingSubscription.__table__.columns}
    assert {"user_id", "plan", "status", "stripe_customer_id",
            "stripe_subscription_id", "stripe_price_id", "current_period_end",
            "cancel_at_period_end", "updated_at"} <= cols
    ev = {c.name for c in models.StripeEvent.__table__.columns}
    assert {"event_id", "event_type", "received_at"} <= ev
