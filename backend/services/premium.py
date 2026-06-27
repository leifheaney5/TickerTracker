"""Premium tier predicate. Single source of truth for free-vs-premium rules.

For now `User.plan` is set manually (DB/admin); Stripe billing (a later cycle)
will flip it. Keeping the check here means feature code never inlines tier logic.
"""
import db
import models

PLAN_FREE = "free"
PLAN_PREMIUM = "premium"

FREE_MAX_LISTS = 1
FREE_MAX_ACTIVE_ITEMS = 10


def is_premium(user) -> bool:
    return getattr(user, "plan", PLAN_FREE) == PLAN_PREMIUM


def is_premium_uid(uid: int) -> bool:
    with db.get_session() as s:
        u = s.get(models.User, uid)
        return is_premium(u) if u else False
