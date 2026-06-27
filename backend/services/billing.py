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
