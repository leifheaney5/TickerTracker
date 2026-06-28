"""Premium tier predicate. Single source of truth for free-vs-premium rules.

Premium status is billing-backed (Stripe). Enforcement only happens when
billing is enabled; otherwise everyone is unlimited (no behavior regression
in environments/tests where billing is off).
"""
from services import billing

FREE_MAX_LISTS = 1
# Single source of truth for the free active-ticker cap (shared with billing).
FREE_MAX_ACTIVE_ITEMS = billing.LIMITS[billing.PLAN_FREE]["watchlist"]  # = 15


def is_premium_uid(uid: int) -> bool:
    return (not billing.billing_enabled()) or billing.is_pro(uid)


def is_premium(user) -> bool:
    return is_premium_uid(user.id) if user is not None else False
