"""Stripe-backed freemium billing: plan limits, state, and limit checks."""
import os
import datetime as _dt

import db
import models

PLAN_FREE = "free"
PLAN_PRO = "pro"
PRO_STATUSES = {"active", "trialing"}

LIMITS = {
    PLAN_FREE: {"watchlist": 15, "alerts": 3, "screens": 1, "digest": False, "compare": 2},
    PLAN_PRO: {"watchlist": 250, "alerts": 100, "screens": 25, "digest": True, "compare": 10},
}


class BillingNotConfigured(Exception):
    """Raised when a Stripe operation is requested but env/customer is missing."""


def billing_enabled() -> bool:
    return os.environ.get("BILLING_ENABLED", "").strip().lower() in ("1", "true", "yes")


def _get_sub(s, user_id: int):
    return (s.query(models.BillingSubscription)
            .filter_by(user_id=user_id).first())


def plan_for(user_id: int) -> str:
    with db.get_session() as s:
        sub = _get_sub(s, user_id)
        if sub and (sub.status or "") in PRO_STATUSES:
            return PLAN_PRO
        return PLAN_FREE


def is_pro(user_id: int) -> bool:
    """Status-based Pro check. Intentionally independent of billing_enabled()."""
    return plan_for(user_id) == PLAN_PRO


def get_usage(user_id: int) -> dict:
    with db.get_session() as s:
        wl = s.query(models.WatchlistItem).filter_by(user_id=user_id).count()
        alerts = (s.query(models.WatchlistItem)
                  .filter_by(user_id=user_id, alert_active=True).count())
        screens = s.query(models.SavedScreen).filter_by(user_id=user_id).count()
        return {"watchlist": wl, "alerts": alerts, "screens": screens}


def get_billing_state(user_id: int) -> dict:
    with db.get_session() as s:
        sub = _get_sub(s, user_id)
        status = (sub.status if sub else "") or ""
        pro = status in PRO_STATUSES
        plan = PLAN_PRO if pro else PLAN_FREE
        cpe = sub.current_period_end if sub else None
        cancel = bool(sub.cancel_at_period_end) if sub else False
    return {
        "plan": plan,
        "status": status,
        "is_pro": pro,
        "limits": LIMITS[plan],
        "usage": get_usage(user_id),
        "current_period_end": cpe.isoformat() if isinstance(cpe, _dt.datetime) else None,
        "cancel_at_period_end": cancel,
    }


_FEATURE_MESSAGES = {
    "watchlist": "You've reached the Free plan limit of {limit} watchlist tickers. "
                 "Upgrade to Pro for up to {pro} tickers.",
    "alerts": "You've reached the Free plan limit of {limit} active price alerts. "
              "Upgrade to Pro for up to {pro} alerts.",
    "screens": "You've reached the Free plan limit of {limit} saved screener. "
               "Upgrade to Pro for up to {pro} saved screeners.",
    "digest": "The weekly market digest is a Pro feature. Upgrade to enable it.",
}


def _limit_error(feature: str, plan: str, limit) -> dict:
    msg = _FEATURE_MESSAGES[feature].format(limit=limit, pro=LIMITS[PLAN_PRO].get(feature))
    return {"error": "limit_exceeded", "feature": feature,
            "limit": limit, "plan": plan, "message": msg}


def _enforced(user_id: int) -> bool:
    """True only when limits should actively block (billing on AND user is Free)."""
    return billing_enabled() and not is_pro(user_id)


def check_watchlist_add(user_id: int, symbol: str) -> dict | None:
    if not _enforced(user_id):
        return None
    symbol = (symbol or "").upper()
    with db.get_session() as s:
        exists = (s.query(models.WatchlistItem)
                  .filter_by(user_id=user_id, symbol=symbol).first() is not None)
        if exists:
            return None  # update of an existing ticker, not a new add
    limit = LIMITS[PLAN_FREE]["watchlist"]
    if get_usage(user_id)["watchlist"] >= limit:
        return _limit_error("watchlist", PLAN_FREE, limit)
    return None


def check_alert_activate(user_id: int, symbol: str) -> dict | None:
    if not _enforced(user_id):
        return None
    symbol = (symbol or "").upper()
    with db.get_session() as s:
        item = (s.query(models.WatchlistItem)
                .filter_by(user_id=user_id, symbol=symbol).first())
        if item is not None and item.alert_active:
            return None  # already active -> no new alert consumed
    limit = LIMITS[PLAN_FREE]["alerts"]
    if get_usage(user_id)["alerts"] >= limit:
        return _limit_error("alerts", PLAN_FREE, limit)
    return None


def check_screen_add(user_id: int) -> dict | None:
    if not _enforced(user_id):
        return None
    limit = LIMITS[PLAN_FREE]["screens"]
    if get_usage(user_id)["screens"] >= limit:
        return _limit_error("screens", PLAN_FREE, limit)
    return None


def check_digest_enable(user_id: int) -> dict | None:
    if not billing_enabled() or is_pro(user_id):
        return None
    return _limit_error("digest", PLAN_FREE, LIMITS[PLAN_FREE]["digest"])


def _existing_customer_id(user_id: int) -> str | None:
    with db.get_session() as s:
        sub = _get_sub(s, user_id)
        return sub.stripe_customer_id if sub else None


def _app_base() -> str:
    return os.environ.get("APP_BASE_URL", "http://localhost:5000").rstrip("/")


def create_checkout_session(user_id: int, interval: str) -> str:
    import stripe
    key = os.environ.get("STRIPE_SECRET_KEY")
    if not key:
        raise BillingNotConfigured("STRIPE_SECRET_KEY not set")
    stripe.api_key = key
    if interval == "annual":
        price_id = os.environ.get("STRIPE_PRO_ANNUAL_PRICE_ID")
    else:
        price_id = os.environ.get("STRIPE_PRO_MONTHLY_PRICE_ID")
    if not price_id:
        raise BillingNotConfigured(f"price id not set for interval={interval!r}")
    base = _app_base()
    session = stripe.checkout.Session.create(
        mode="subscription",
        line_items=[{"price": price_id, "quantity": 1}],
        client_reference_id=str(user_id),
        customer=_existing_customer_id(user_id) or None,
        subscription_data={"metadata": {"user_id": str(user_id)}},
        success_url=f"{base}/?checkout=success",
        cancel_url=f"{base}/?checkout=cancel",
    )
    return session.url


def create_portal_session(user_id: int) -> str:
    import stripe
    key = os.environ.get("STRIPE_SECRET_KEY")
    if not key:
        raise BillingNotConfigured("STRIPE_SECRET_KEY not set")
    customer_id = _existing_customer_id(user_id)
    if not customer_id:
        raise BillingNotConfigured("no Stripe customer for user")
    stripe.api_key = key
    session = stripe.billing_portal.Session.create(
        customer=customer_id,
        return_url=f"{_app_base()}/?view=settings",
    )
    return session.url
