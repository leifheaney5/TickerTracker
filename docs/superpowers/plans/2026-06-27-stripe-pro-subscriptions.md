# Ticker Tracker Pro Subscriptions (Stripe) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add real Stripe-backed freemium subscriptions — public market browsing stays free; paid value is saved-personalization scale (watchlist/alerts/screens) plus the weekly digest.

**Architecture:** A new `services/billing.py` module owns plan constants, limit checks, billing-state assembly, Stripe Checkout/Portal session creation, and idempotent webhook sync. Subscription state lives in two **new tables** (`billing_subscriptions`, `stripe_events`) so `create_all()` builds them with no `_ensure_columns()` changes. Existing authenticated routes call billing limit-checkers and return HTTP `402` with a consistent error body. The frontend gains a `billing` slice in the Zustand store, a reusable `UpgradePrompt`, a real Plan & Billing card, and `402`-aware mutation flows.

**Tech Stack:** Flask 3, SQLAlchemy 2, Alembic, Stripe Python SDK, React + Zustand + Vite, Vitest + Testing Library, pytest.

## Global Constraints

These apply to **every** task. Values are copied verbatim from the spec.

- Stripe dependency pinned: `stripe==15.3.0` (add to `backend/requirements.txt`).
- New tables only (never add columns to `users`): `billing_subscriptions`, `stripe_events`.
- Alembic migration chains **after** `dd01_unsub_token` (latest revision). New revision id: `ee01_billing`.
- New env vars (add to `.env.example`): `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRO_MONTHLY_PRICE_ID`, `STRIPE_PRO_ANNUAL_PRICE_ID`, `BILLING_ENABLED=true|false`.
- Plan limits — Free: `{watchlist: 15, alerts: 3, screens: 1, digest: False, compare: 2}`; Pro: `{watchlist: 250, alerts: 100, screens: 25, digest: True, compare: 10}`. (`compare` is a UI-only cap on simultaneous stock comparison — enforced client-side, no `402`.)
- Pricing copy: **$7/mo** or **$59/yr**; annual is the primary upgrade CTA. CTA strings: `Upgrade yearly — $59/yr` (primary), `Monthly — $7/mo` (secondary), `Manage billing` (Pro).
- Stripe statuses `active` and `trialing` count as Pro; everything else (canceled, incomplete, unpaid, missing) is Free. No free trial in v1.
- Consistent limit error body (HTTP `402`, returned as plain JSON, **not** the `{data, meta}` envelope): `{"error": "limit_exceeded", "feature": <str>, "limit": <int>, "plan": <str>, "message": <str>}`.
- `is_pro(user_id)` (subscription-status check) is **independent** of `BILLING_ENABLED`. Limit *enforcement* (the `check_*` helpers and route 402s) is **gated** by `BILLING_ENABLED` so pre-launch behaves like today. The weekly digest cron gates on `is_pro` directly.
- Launch gate: do **not** set `BILLING_ENABLED=true` in production until market-data provider commercial-use rights are confirmed.
- Existing response/error conventions: read-only/market routes use `envelope(data, source=...)`; auth-required routes return `envelope({"error": ...}), 401` when anonymous. Billing GET/checkout/portal return enveloped bodies; only the `402` limit errors are plain JSON.

---

## File Structure

**Backend — create:**
- `backend/services/billing.py` — plan constants, limits, state, limit-checkers, Stripe session creation, webhook sync.
- `backend/migrations/versions/ee01_billing.py` — creates the two tables.
- `backend/tests/test_billing_service.py` — state/limits/sync/idempotency unit tests.
- `backend/tests/test_billing_routes.py` — route auth/config + 402 enforcement tests.

**Backend — modify:**
- `backend/requirements.txt` — add `stripe==15.3.0`.
- `backend/models.py` — add `BillingSubscription`, `StripeEvent`.
- `backend/app.py` — add billing routes + webhook + 402 enforcement in 4 existing routes.
- `backend/services/digest.py` — skip non-Pro users in `send_weekly_digest`.

**Frontend — create:**
- `frontend/src/components/UpgradePrompt.tsx` — reusable upgrade modal.
- `frontend/src/components/__tests__/UpgradePrompt.test.tsx`.
- `frontend/src/state/billing.test.ts` — store billing-slice tests.

**Frontend — modify:**
- `frontend/src/api/types.ts` — `BillingState` type.
- `frontend/src/api/client.ts` — `ApiError` class + `getBilling`/`checkout`/`portal`.
- `frontend/src/state/store.ts` — `billing` slice, `loadBilling`, `upgradePrompt` modal, 402 handling in mutations.
- `frontend/src/App.tsx` — refresh billing after `loadMe`; handle `?checkout=` return param; render `<UpgradePrompt/>`.
- `frontend/src/views/Settings.tsx` — Plan & Billing card; locked digest toggle for Free.
- `frontend/src/views/ManageWatchlist.tsx` — usage row; pre-check + 402 prompt.
- `frontend/src/views/Screener.tsx` — saved-screen usage; 402 on save.

**Docs — create/modify:**
- `docs/ops/stripe-billing-setup.md` (create), `README.md` (Billing section), `.env.example` (vars), `CHANGELOG.md` + `frontend/package.json` (version bump to `1.14.0`).

---

## Task 1: Stripe dependency + billing tables (models & migration)

**Files:**
- Modify: `backend/requirements.txt`
- Modify: `backend/models.py` (after `SavedScreen`, end of file)
- Create: `backend/migrations/versions/ee01_billing.py`
- Test: `backend/tests/test_billing_service.py`

**Interfaces:**
- Produces: `models.BillingSubscription` (cols: `id, user_id, plan, status, stripe_customer_id, stripe_subscription_id, stripe_price_id, current_period_end, cancel_at_period_end, updated_at`), `models.StripeEvent` (cols: `event_id, event_type, received_at`).

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_billing_service.py`:

```python
import models


def test_billing_tables_exist():
    # New tables must be importable as ORM models with the spec'd columns.
    cols = {c.name for c in models.BillingSubscription.__table__.columns}
    assert {"user_id", "plan", "status", "stripe_customer_id",
            "stripe_subscription_id", "stripe_price_id", "current_period_end",
            "cancel_at_period_end", "updated_at"} <= cols
    ev = {c.name for c in models.StripeEvent.__table__.columns}
    assert {"event_id", "event_type", "received_at"} <= ev
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_billing_service.py::test_billing_tables_exist -q`
Expected: FAIL with `AttributeError: module 'models' has no attribute 'BillingSubscription'`.

- [ ] **Step 3: Add the dependency**

In `backend/requirements.txt`, add after `resend==2.4.0`:

```
stripe==15.3.0
```

Then install: `cd backend && pip install stripe==15.3.0`

- [ ] **Step 4: Add the models**

Append to `backend/models.py` (the file already imports `Column, Integer, String, Float, Boolean, DateTime, ForeignKey, func, UniqueConstraint`):

```python
class BillingSubscription(Base):
    __tablename__ = "billing_subscriptions"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True, index=True)
    plan = Column(String, default="free")
    status = Column(String, default="")
    stripe_customer_id = Column(String, nullable=True, index=True)
    stripe_subscription_id = Column(String, nullable=True, index=True)
    stripe_price_id = Column(String, nullable=True)
    current_period_end = Column(DateTime, nullable=True)
    cancel_at_period_end = Column(Boolean, default=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class StripeEvent(Base):
    __tablename__ = "stripe_events"
    event_id = Column(String, primary_key=True)
    event_type = Column(String, default="")
    received_at = Column(DateTime, server_default=func.now())
```

- [ ] **Step 5: Add the Alembic migration**

Create `backend/migrations/versions/ee01_billing.py`:

```python
"""add billing_subscriptions and stripe_events"""
from alembic import op
import sqlalchemy as sa

revision = "ee01_billing"
down_revision = "dd01_unsub_token"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "billing_subscriptions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("plan", sa.String(), nullable=True),
        sa.Column("status", sa.String(), nullable=True),
        sa.Column("stripe_customer_id", sa.String(), nullable=True),
        sa.Column("stripe_subscription_id", sa.String(), nullable=True),
        sa.Column("stripe_price_id", sa.String(), nullable=True),
        sa.Column("current_period_end", sa.DateTime(), nullable=True),
        sa.Column("cancel_at_period_end", sa.Boolean(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_billing_subscriptions_user_id", "billing_subscriptions",
                    ["user_id"], unique=True)
    op.create_index("ix_billing_subscriptions_stripe_customer_id",
                    "billing_subscriptions", ["stripe_customer_id"])
    op.create_index("ix_billing_subscriptions_stripe_subscription_id",
                    "billing_subscriptions", ["stripe_subscription_id"])
    op.create_table(
        "stripe_events",
        sa.Column("event_id", sa.String(), primary_key=True),
        sa.Column("event_type", sa.String(), nullable=True),
        sa.Column("received_at", sa.DateTime(), nullable=True),
    )


def downgrade():
    op.drop_table("stripe_events")
    op.drop_index("ix_billing_subscriptions_stripe_subscription_id",
                  table_name="billing_subscriptions")
    op.drop_index("ix_billing_subscriptions_stripe_customer_id",
                  table_name="billing_subscriptions")
    op.drop_index("ix_billing_subscriptions_user_id",
                  table_name="billing_subscriptions")
    op.drop_table("billing_subscriptions")
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/test_billing_service.py::test_billing_tables_exist -q`
Expected: PASS. (`conftest.py`'s `fresh_db` fixture rebuilds the in-memory DB via `create_all`, so the tables exist.)

- [ ] **Step 7: Commit**

```bash
git add backend/requirements.txt backend/models.py backend/migrations/versions/ee01_billing.py backend/tests/test_billing_service.py
git commit -m "feat(billing): add billing_subscriptions + stripe_events tables and migration"
```

---

## Task 2: Billing plan constants, state, and usage

**Files:**
- Create: `backend/services/billing.py`
- Test: `backend/tests/test_billing_service.py` (append)

**Interfaces:**
- Consumes: `models.BillingSubscription`, `models.WatchlistItem`, `models.SavedScreen`, `db.get_session`.
- Produces:
  - Constants: `PLAN_FREE = "free"`, `PLAN_PRO = "pro"`, `PRO_STATUSES = {"active", "trialing"}`, `LIMITS: dict[str, dict]`.
  - `billing_enabled() -> bool`
  - `plan_for(user_id: int) -> str`  (returns `"pro"`/`"free"`)
  - `is_pro(user_id: int) -> bool`  (status-based, ignores `billing_enabled`)
  - `get_usage(user_id: int) -> dict`  (`{"watchlist": int, "alerts": int, "screens": int}`)
  - `get_billing_state(user_id: int) -> dict`  (`{plan, status, is_pro, limits, usage, current_period_end, cancel_at_period_end}`)

- [ ] **Step 1: Write the failing tests**

Append to `backend/tests/test_billing_service.py`:

```python
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_billing_service.py -q`
Expected: FAIL with `ModuleNotFoundError: No module named 'services.billing'`.

- [ ] **Step 3: Create the service**

Create `backend/services/billing.py`:

```python
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_billing_service.py -q`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/services/billing.py backend/tests/test_billing_service.py
git commit -m "feat(billing): plan limits, billing state, and usage counts"
```

---

## Task 3: Server-side limit checkers

**Files:**
- Modify: `backend/services/billing.py`
- Test: `backend/tests/test_billing_service.py` (append)

**Interfaces:**
- Consumes: `billing_enabled`, `is_pro`, `get_usage`, `LIMITS`.
- Produces (each returns the limit-error dict `{error, feature, limit, plan, message}` or `None`):
  - `check_watchlist_add(user_id: int, symbol: str) -> dict | None`
  - `check_alert_activate(user_id: int, symbol: str) -> dict | None`
  - `check_screen_add(user_id: int) -> dict | None`
  - `check_digest_enable(user_id: int) -> dict | None`

- [ ] **Step 1: Write the failing tests**

Append to `backend/tests/test_billing_service.py`:

```python
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
    # Existing symbol is an update, not a new add -> allowed.
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
    # Activating a currently-inactive symbol would be the 4th -> blocked.
    err = billing.check_alert_activate(uid, "SYM3")
    assert err["feature"] == "alerts" and err["limit"] == 3
    # Re-activating an already-active symbol is a no-op -> allowed.
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
    # Pro user allowed.
    uid2 = _mk_user("dgpro@example.com")
    _mk_sub(uid2, status="active")
    assert billing.check_digest_enable(uid2) is None
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_billing_service.py -k "limit or digest_enable" -q`
Expected: FAIL with `AttributeError: module 'services.billing' has no attribute 'check_watchlist_add'`.

- [ ] **Step 3: Implement the checkers**

Append to `backend/services/billing.py`:

```python
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_billing_service.py -q`
Expected: PASS (all billing-service tests).

- [ ] **Step 5: Commit**

```bash
git add backend/services/billing.py backend/tests/test_billing_service.py
git commit -m "feat(billing): server-side limit checkers returning 402 error bodies"
```

---

## Task 4: Stripe Checkout & Customer Portal session creation

**Files:**
- Modify: `backend/services/billing.py`
- Test: `backend/tests/test_billing_service.py` (append)

**Interfaces:**
- Consumes: `BillingNotConfigured`, `models.BillingSubscription`.
- Produces:
  - `create_checkout_session(user_id: int, interval: str) -> str`  (returns Checkout URL; `interval` is `"monthly"`/`"annual"`)
  - `create_portal_session(user_id: int) -> str`  (returns Portal URL)
  - `_existing_customer_id(user_id: int) -> str | None` (internal helper)

- [ ] **Step 1: Write the failing tests**

Append to `backend/tests/test_billing_service.py`:

```python
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_billing_service.py -k "checkout or portal" -q`
Expected: FAIL with `AttributeError: ... has no attribute 'create_checkout_session'`.

- [ ] **Step 3: Implement session creation**

Append to `backend/services/billing.py`:

```python
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_billing_service.py -k "checkout or portal" -q`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/services/billing.py backend/tests/test_billing_service.py
git commit -m "feat(billing): Stripe Checkout + Customer Portal session creation"
```

---

## Task 5: Webhook event sync (idempotent)

**Files:**
- Modify: `backend/services/billing.py`
- Test: `backend/tests/test_billing_service.py` (append)

**Interfaces:**
- Consumes: `models.StripeEvent`, `models.BillingSubscription`, `PRO_STATUSES`.
- Produces: `handle_webhook_event(event: dict) -> bool`  (returns `True` if processed, `False` if duplicate).

- [ ] **Step 1: Write the failing tests**

Append to `backend/tests/test_billing_service.py`:

```python
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_billing_service.py -k webhook -q`
Expected: FAIL with `AttributeError: ... has no attribute 'handle_webhook_event'`.

- [ ] **Step 3: Implement webhook sync**

Append to `backend/services/billing.py`:

```python
def _ts_to_dt(ts):
    if not ts:
        return None
    try:
        return _dt.datetime.fromtimestamp(int(ts), tz=_dt.timezone.utc).replace(tzinfo=None)
    except (TypeError, ValueError):
        return None


def _user_id_from_object(obj: dict):
    meta = obj.get("metadata") or {}
    if meta.get("user_id"):
        try:
            return int(meta["user_id"])
        except (TypeError, ValueError):
            pass
    if obj.get("client_reference_id"):
        try:
            return int(obj["client_reference_id"])
        except (TypeError, ValueError):
            pass
    cust = obj.get("customer")
    if cust:
        with db.get_session() as s:
            sub = (s.query(models.BillingSubscription)
                   .filter_by(stripe_customer_id=cust).first())
            if sub:
                return sub.user_id
    return None


def _upsert_subscription(user_id: int, **fields) -> None:
    if user_id is None:
        return
    with db.get_session() as s:
        sub = _get_sub(s, user_id)
        if sub is None:
            sub = models.BillingSubscription(user_id=user_id)
            s.add(sub)
        for k, v in fields.items():
            if v is not None:
                setattr(sub, k, v)
        s.commit()


def _sync_from_checkout(obj: dict) -> None:
    uid = _user_id_from_object(obj)
    _upsert_subscription(
        uid,
        stripe_customer_id=obj.get("customer"),
        stripe_subscription_id=obj.get("subscription"),
        status="active",
        plan=PLAN_PRO,
    )


def _sync_from_subscription(obj: dict) -> None:
    uid = _user_id_from_object(obj)
    status = obj.get("status") or ""
    try:
        price_id = obj["items"]["data"][0]["price"]["id"]
    except (KeyError, IndexError, TypeError):
        price_id = None
    _upsert_subscription(
        uid,
        stripe_subscription_id=obj.get("id"),
        stripe_customer_id=obj.get("customer"),
        stripe_price_id=price_id,
        status=status,
        plan=PLAN_PRO if status in PRO_STATUSES else PLAN_FREE,
        current_period_end=_ts_to_dt(obj.get("current_period_end")),
        cancel_at_period_end=bool(obj.get("cancel_at_period_end")),
    )


def _sync_deleted(obj: dict) -> None:
    uid = _user_id_from_object(obj)
    _upsert_subscription(uid, status="canceled", plan=PLAN_FREE)


def handle_webhook_event(event: dict) -> bool:
    event_id = event.get("id")
    etype = event.get("type", "")
    with db.get_session() as s:
        if event_id and s.get(models.StripeEvent, event_id) is not None:
            return False
        if event_id:
            s.add(models.StripeEvent(event_id=event_id, event_type=etype))
            s.commit()
    obj = (event.get("data") or {}).get("object") or {}
    if etype == "checkout.session.completed":
        _sync_from_checkout(obj)
    elif etype in ("customer.subscription.created", "customer.subscription.updated"):
        _sync_from_subscription(obj)
    elif etype == "customer.subscription.deleted":
        _sync_deleted(obj)
    return True
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_billing_service.py -q`
Expected: PASS (full billing-service suite).

- [ ] **Step 5: Commit**

```bash
git add backend/services/billing.py backend/tests/test_billing_service.py
git commit -m "feat(billing): idempotent Stripe webhook event sync"
```

---

## Task 6: Billing API routes + webhook route

**Files:**
- Modify: `backend/app.py`
- Test: `backend/tests/test_billing_routes.py`

**Interfaces:**
- Consumes: `services.billing`, `_require_user`, `envelope`.
- Produces routes:
  - `GET /api/billing` → `envelope(get_billing_state(uid))`
  - `POST /api/billing/checkout` body `{interval}` → `envelope({"url": ...})` / `503` on `BillingNotConfigured`
  - `POST /api/billing/portal` → `envelope({"url": ...})` / `503` on `BillingNotConfigured`
  - `POST /api/stripe/webhook` → `{"received": True}` / `400` on bad signature

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_billing_routes.py`:

```python
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_billing_routes.py -q`
Expected: FAIL (routes return 404 / not found).

- [ ] **Step 3: Add the routes**

In `backend/app.py`, add the import near the other service imports (after the `from services import digest as _digest` line, ~line 237):

```python
from services import billing as _billing
```

Then add these routes immediately before the `# ─── SPA fallback ───` comment block (~line 412):

```python
# ─── Billing (Stripe subscriptions) ──────────────────────────────────────────

@app.route("/api/billing", methods=["GET"])
def billing_get():
    uid = _require_user()
    if uid is None:
        return envelope({"error": "authentication required"}), 401
    return envelope(_billing.get_billing_state(uid), source="db")


@app.route("/api/billing/checkout", methods=["POST"])
def billing_checkout():
    uid = _require_user()
    if uid is None:
        return envelope({"error": "authentication required"}), 401
    b = request.get_json(force=True) or {}
    interval = "annual" if b.get("interval") == "annual" else "monthly"
    try:
        url = _billing.create_checkout_session(uid, interval)
    except _billing.BillingNotConfigured as e:
        return envelope({"error": "billing unavailable", "detail": str(e)}), 503
    return envelope({"url": url}, source="stripe")


@app.route("/api/billing/portal", methods=["POST"])
def billing_portal():
    uid = _require_user()
    if uid is None:
        return envelope({"error": "authentication required"}), 401
    try:
        url = _billing.create_portal_session(uid)
    except _billing.BillingNotConfigured as e:
        return envelope({"error": "billing unavailable", "detail": str(e)}), 503
    return envelope({"url": url}, source="stripe")


@app.route("/api/stripe/webhook", methods=["POST"])
def stripe_webhook():
    import stripe
    payload = request.get_data()
    sig = request.headers.get("Stripe-Signature", "")
    secret = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
    try:
        event = stripe.Webhook.construct_event(payload, sig, secret)
    except Exception:
        return jsonify({"error": "invalid signature"}), 400
    _billing.handle_webhook_event(event)
    return jsonify({"received": True}), 200
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_billing_routes.py -q`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/app.py backend/tests/test_billing_routes.py
git commit -m "feat(billing): GET /api/billing + checkout/portal/webhook routes"
```

---

## Task 7: Enforce limits in existing mutation routes

**Files:**
- Modify: `backend/app.py` (`watchlist_post`, `watchlist_patch`, `screens_post`, `settings_patch`)
- Test: `backend/tests/test_billing_routes.py` (append)

**Interfaces:**
- Consumes: `_billing.check_watchlist_add/check_alert_activate/check_screen_add/check_digest_enable`.
- Produces: HTTP `402` with the plain limit-error JSON when a Free user exceeds a limit (only when `BILLING_ENABLED`).

- [ ] **Step 1: Write the failing tests**

Append to `backend/tests/test_billing_routes.py`:

```python
import pytest


@pytest.fixture
def billing_on(monkeypatch):
    monkeypatch.setenv("BILLING_ENABLED", "true")


def test_watchlist_16th_blocked_402(billing_on):
    c = _verified_client("wl16@example.com")
    for i in range(15):
        assert c.post("/api/watchlist", json={"symbol": f"SYM{i}"}).status_code == 200
    r = c.post("/api/watchlist", json={"symbol": "OVERX"})
    assert r.status_code == 402
    body = r.get_json()
    assert body["error"] == "limit_exceeded" and body["feature"] == "watchlist"
    # Updating an existing ticker still works.
    assert c.post("/api/watchlist", json={"symbol": "SYM0", "target": 5}).status_code == 200


def test_alert_4th_activation_blocked_402(billing_on):
    c = _verified_client("al4@example.com")
    for i in range(4):
        c.post("/api/watchlist", json={"symbol": f"AL{i}", "alert_price": 10})
    for i in range(3):
        assert c.patch(f"/api/watchlist/AL{i}",
                       json={"alert_active": True}).status_code == 200
    r = c.patch("/api/watchlist/AL3", json={"alert_active": True})
    assert r.status_code == 402 and r.get_json()["feature"] == "alerts"


def test_second_screen_blocked_402(billing_on):
    c = _verified_client("sc2@example.com")
    assert c.post("/api/screens", json={"name": "one", "filters": {}}).status_code == 200
    r = c.post("/api/screens", json={"name": "two", "filters": {}})
    assert r.status_code == 402 and r.get_json()["feature"] == "screens"


def test_free_digest_enable_blocked_402(billing_on):
    c = _verified_client("dg402@example.com")
    r = c.patch("/api/settings", json={"news_digest": True})
    assert r.status_code == 402 and r.get_json()["feature"] == "digest"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_billing_routes.py -k "402 or blocked" -q`
Expected: FAIL (routes currently return 200).

- [ ] **Step 3: Add enforcement to the four routes**

In `backend/app.py`, edit `watchlist_post` (~line 247). Replace its body so it captures `uid` and checks the limit:

```python
@app.route("/api/watchlist", methods=["POST"])
def watchlist_post():
    uid = _require_user()
    if uid is None:
        return envelope({"error": "authentication required"}), 401
    b = request.get_json(force=True) or {}
    sym = (b.get("symbol") or "").upper()
    if not valid_symbol(sym):
        return envelope({"error": "invalid symbol"}), 400
    err = _billing.check_watchlist_add(uid, sym)
    if err:
        return jsonify(err), 402
    item = add_watch(sym, target=float(b.get("target", 0) or 0),
                     alert_price=float(b.get("alert_price", 0) or 0),
                     alert_dir=b.get("alert_dir", "above"))
    return envelope(item, source="db")
```

Edit `watchlist_patch` (~line 261). Capture `uid` and check before applying when activating an alert:

```python
@app.route("/api/watchlist/<sym>", methods=["PATCH"])
def watchlist_patch(sym):
    uid = _require_user()
    if uid is None:
        return envelope({"error": "authentication required"}), 401
    b = request.get_json(force=True) or {}
    # Explicit allowlist of client-patchable fields (avoid mass-assignment).
    allowed = {"target", "alert_price", "alert_dir", "alert_active"}
    fields = {k: v for k, v in b.items() if k in allowed}
    if fields.get("alert_active") is True:
        err = _billing.check_alert_activate(uid, sym.upper())
        if err:
            return jsonify(err), 402
    item = update_watch(sym, **fields)
    if item is None:
        return envelope({"error": "not found"}, source="db"), 404
    return envelope(item, source="db")
```

Edit `screens_post` (~line 340). Add the check after validating `name`/`filters`, before `save_screen`:

```python
    if not isinstance(filters, dict):
        return envelope({"error": "filters must be an object"}), 400
    err = _billing.check_screen_add(uid)
    if err:
        return jsonify(err), 402
    return envelope(save_screen(uid, name, filters), source="db")
```

Edit `settings_patch` (~line 289). Capture `uid` and check digest before applying:

```python
@app.route("/api/settings", methods=["PATCH"])
def settings_patch():
    uid = _require_user()
    if uid is None:
        return envelope({"error": "authentication required"}), 401
    b = request.get_json(force=True) or {}
    allowed = {"live_updates", "alert_notifs", "news_digest", "hide_balances",
               "currency", "broker_connected", "broker_name"}
    fields = {k: v for k, v in b.items() if k in allowed}
    if fields.get("news_digest") is True:
        err = _billing.check_digest_enable(uid)
        if err:
            return jsonify(err), 402
    return envelope(update_settings(**fields), source="db")
```

(Note: the `screens_post` handler already defines `uid = _require_user()` at its top — keep that; only add the check lines shown.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_billing_routes.py tests/test_store_routes.py tests/test_screens.py -q`
Expected: PASS (new 402 tests pass; existing route tests still green because `BILLING_ENABLED` is unset there, so checkers no-op).

- [ ] **Step 5: Commit**

```bash
git add backend/app.py backend/tests/test_billing_routes.py
git commit -m "feat(billing): enforce Free-plan limits with HTTP 402 in mutation routes"
```

---

## Task 8: Weekly digest cron skips non-Pro users

**Files:**
- Modify: `backend/services/digest.py` (`send_weekly_digest`)
- Test: `backend/tests/test_digest_service.py` (append)

**Interfaces:**
- Consumes: `services.billing.is_pro`.

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/test_digest_service.py`:

```python
def test_digest_skips_non_pro_users():
    import db, models
    import services.digest as digest
    import services.billing as billing
    # Two opted-in verified users; only one is Pro.
    with db.get_session() as s:
        pro = models.User(email="pro_dg@example.com", name="P", email_verified=True)
        free = models.User(email="free_dg@example.com", name="F", email_verified=True)
        s.add(pro); s.add(free); s.flush()
        s.add(models.Settings(user_id=pro.id, news_digest=True))
        s.add(models.Settings(user_id=free.id, news_digest=True))
        s.add(models.WatchlistItem(user_id=pro.id, symbol="AAPL"))
        s.add(models.WatchlistItem(user_id=free.id, symbol="AAPL"))
        s.add(models.BillingSubscription(user_id=pro.id, status="active", plan="pro"))
        s.commit()
    sent = []
    n = digest.send_weekly_digest(
        quote_fn=lambda syms: ({s: {"price": 1.0, "change_pct": 0.0} for s in syms}, "mock"),
        send_fn=lambda to, subj, html: sent.append(to) or True,
    )
    assert n == 1 and sent == ["pro_dg@example.com"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_digest_service.py::test_digest_skips_non_pro_users -q`
Expected: FAIL with `assert 2 == 1` (both users currently emailed).

- [ ] **Step 3: Add the Pro gate**

In `backend/services/digest.py`, add the import near the top (after `import models`):

```python
import services.billing as billing
```

In `send_weekly_digest`, inside the `for st in opted:` loop, add the skip right after the existing user/email guard:

```python
            user = s.get(models.User, st.user_id)
            if not user or not user.email or not user.email_verified:
                continue
            if not billing.is_pro(st.user_id):
                continue  # weekly digest is a Pro feature
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_digest_service.py -q`
Expected: PASS.

- [ ] **Step 5: Run the full backend suite**

Run: `cd backend && python -m pytest -q`
Expected: PASS (all tests green).

- [ ] **Step 6: Commit**

```bash
git add backend/services/digest.py backend/tests/test_digest_service.py
git commit -m "feat(billing): weekly digest cron sends to Pro users only"
```

---

## Task 8b: Email price-hit alerts are Pro-only (alert cron gate)

**Files:**
- Modify: `backend/services/alerts.py` (`check_alerts`)
- Test: `backend/tests/test_alerts_service.py` (append)

**Interfaces:**
- Consumes: `services.billing.is_pro`.

**Note:** Free users may still *arm* up to 3 active alerts (the `check_alert_activate`
limit from Task 7 still governs the toggle), but **email delivery on a price hit
is Pro-only**. This gate lives in the cron's `check_alerts`, exactly mirroring the
digest gate, and is independent of `BILLING_ENABLED`.

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/test_alerts_service.py`:

```python
def test_price_hit_email_only_for_pro_users():
    import db, models
    import services.alerts as alerts
    import services.billing as billing
    # Free + Pro user, both with an armed alert that should fire at price 200.
    with db.get_session() as s:
        free = models.User(email="free_al@example.com", name="F", email_verified=True)
        pro = models.User(email="pro_al@example.com", name="P", email_verified=True)
        s.add(free); s.add(pro); s.flush()
        s.add(models.Settings(user_id=free.id, alert_notifs=True))
        s.add(models.Settings(user_id=pro.id, alert_notifs=True))
        s.add(models.WatchlistItem(user_id=free.id, symbol="AAPL",
                                   alert_price=150, alert_dir="above", alert_active=True))
        s.add(models.WatchlistItem(user_id=pro.id, symbol="AAPL",
                                   alert_price=150, alert_dir="above", alert_active=True))
        s.add(models.BillingSubscription(user_id=pro.id, status="active", plan="pro"))
        s.commit()
    sent = []
    n = alerts.check_alerts(
        quote_fn=lambda syms: ({s: {"price": 200.0} for s in syms}, "mock"),
        send_fn=lambda to, subj, html: sent.append(to) or True,
    )
    assert n == 1 and sent == ["pro_al@example.com"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_alerts_service.py::test_price_hit_email_only_for_pro_users -q`
Expected: FAIL with `assert 2 == 1` (both users emailed today).

- [ ] **Step 3: Add the Pro gate**

In `backend/services/alerts.py`, add the import near the top (after `import models`):

```python
import services.billing as billing
```

In `check_alerts`, inside the `for w in due:` loop, add the skip right after the existing `alert_notifs` guard:

```python
            if settings is not None and not settings.alert_notifs:
                continue
            if not billing.is_pro(w.user_id):
                continue  # price-hit alert emails are a Pro feature
```

Existing alert-firing tests rely on the `_seed_for_test` helper at the bottom of
`alerts.py`; extend it to seed a Pro subscription so those tests keep firing.
Add to the `with db.get_session()` block in `_seed_for_test`, after the
`s.add(models.WatchlistItem(...))` line and before `s.commit()`:

```python
        s.add(models.BillingSubscription(user_id=u.id, status="active", plan="pro"))
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_alerts_service.py tests/test_alert_api.py -q`
Expected: PASS. (The new test seeds its own Free/Pro users; pre-existing tests are Pro via the updated `_seed_for_test`. If any alert test does NOT use `_seed_for_test` and asserts firing, add a Pro `BillingSubscription` row to its setup.)

- [ ] **Step 5: Run the full backend suite**

Run: `cd backend && python -m pytest -q`
Expected: PASS (all tests green; fix any alert tests per Step 4).

- [ ] **Step 6: Commit**

```bash
git add backend/services/alerts.py backend/tests/test_alerts_service.py
git commit -m "feat(billing): price-hit alert emails sent to Pro users only"
```

---

## Task 9: Frontend billing types + API client (with ApiError)

**Files:**
- Modify: `frontend/src/api/types.ts`
- Modify: `frontend/src/api/client.ts`

**Interfaces:**
- Produces:
  - `BillingState` type (matches `get_billing_state`).
  - `ApiError` class (`status: number`, `body: any`).
  - `api.getBilling()`, `api.checkout(interval)`, `api.portal()`.

- [ ] **Step 1: Add the BillingState type**

Append to `frontend/src/api/types.ts`:

```typescript
export interface BillingLimits {
  watchlist: number
  alerts: number
  screens: number
  digest: boolean
}

export interface BillingUsage {
  watchlist: number
  alerts: number
  screens: number
}

export interface BillingState {
  plan: 'free' | 'pro'
  status: string
  is_pro: boolean
  limits: BillingLimits
  usage: BillingUsage
  current_period_end: string | null
  cancel_at_period_end: boolean
}
```

- [ ] **Step 2: Add ApiError + capture body in client**

In `frontend/src/api/client.ts`, add the import for `BillingState` to the existing type import list, then add the `ApiError` class and update `get`/`send` to throw it. Replace the top of the file (imports + the two helpers) with:

```typescript
import type {
  Envelope, QuotesResponse, Bar, Fundamentals, CryptoResponse, Fng,
  NewsItem, Ratings, WatchlistItem, Settings, Holding, Timeframe, SymbolHit,
  SharedWatchlistResponse, EarningsRow, SavedScreen, WatchlistSentiment,
  BillingState,
} from './types'

export interface Result<T> {
  data: T
  source: string
  stale: boolean
  fetchedAt: string
}

// Carries the parsed response body so callers can inspect 402 limit errors
// ({error:"limit_exceeded", feature, limit, plan, message}).
export class ApiError extends Error {
  status: number
  body: any
  constructor(status: number, body: any, path: string) {
    super(`${path} → ${status}`)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

async function get<T>(path: string): Promise<Result<T>> {
  const r = await fetch(path, { credentials: 'include' })
  if (!r.ok) throw new ApiError(r.status, await r.json().catch(() => null), path)
  const env = (await r.json()) as Envelope<T>
  return { data: env.data, source: env.meta.source, stale: env.meta.stale, fetchedAt: env.meta.fetched_at }
}

async function send<T>(path: string, method: string, body?: unknown): Promise<Result<T>> {
  const r = await fetch(path, {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!r.ok) throw new ApiError(r.status, await r.json().catch(() => null), path)
  const env = (await r.json()) as Envelope<T>
  return { data: env.data, source: env.meta.source, stale: env.meta.stale, fetchedAt: env.meta.fetched_at }
}
```

Then add the billing methods inside the `api` object (after the `sentiment` entry):

```typescript
  getBilling: () => get<BillingState>('/api/billing'),
  checkout: (interval: 'monthly' | 'annual') =>
    send<{ url: string }>('/api/billing/checkout', 'POST', { interval }),
  portal: () => send<{ url: string }>('/api/billing/portal', 'POST'),
```

- [ ] **Step 3: Typecheck/build**

Run: `cd frontend && npm run build`
Expected: builds with no type errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/api/types.ts frontend/src/api/client.ts
git commit -m "feat(billing): frontend BillingState type + ApiError + billing API client methods"
```

---

## Task 10: Store billing slice + upgrade-prompt state + 402 handling

**Files:**
- Modify: `frontend/src/state/store.ts`
- Test: `frontend/src/state/billing.test.ts`

**Interfaces:**
- Consumes: `api.getBilling`, `ApiError`.
- Produces store fields/actions:
  - `billing: BillingState | null`, `loadBilling: () => Promise<void>`
  - `upgradePrompt: { feature: string; message: string } | null`
  - `openUpgrade: (feature?: string, message?: string) => void`, `closeUpgrade: () => void`
  - `addWatch`/`updateWatch` now open the upgrade prompt and resync on `402`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/state/billing.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useStore } from './store'
import { api, ApiError } from '../api/client'

describe('billing store slice', () => {
  beforeEach(() => {
    useStore.setState({ billing: null, upgradePrompt: null })
    vi.restoreAllMocks()
  })

  it('loadBilling stores fetched state', async () => {
    vi.spyOn(api, 'getBilling').mockResolvedValue({
      data: {
        plan: 'free', status: '', is_pro: false,
        limits: { watchlist: 15, alerts: 3, screens: 1, digest: false },
        usage: { watchlist: 2, alerts: 0, screens: 0 },
        current_period_end: null, cancel_at_period_end: false,
      },
      source: 'db', stale: false, fetchedAt: '',
    })
    await useStore.getState().loadBilling()
    expect(useStore.getState().billing?.plan).toBe('free')
    expect(useStore.getState().billing?.usage.watchlist).toBe(2)
  })

  it('openUpgrade/closeUpgrade toggle the prompt', () => {
    useStore.getState().openUpgrade('watchlist', 'Limit reached')
    expect(useStore.getState().upgradePrompt?.feature).toBe('watchlist')
    useStore.getState().closeUpgrade()
    expect(useStore.getState().upgradePrompt).toBeNull()
  })

  it('addWatch opens upgrade prompt on 402', async () => {
    vi.spyOn(api, 'addWatch').mockRejectedValue(
      new ApiError(402, { error: 'limit_exceeded', feature: 'watchlist', message: 'Upgrade' }, '/api/watchlist'))
    await useStore.getState().addWatch('NVDA')
    expect(useStore.getState().upgradePrompt?.feature).toBe('watchlist')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm run test -- billing`
Expected: FAIL (`loadBilling`/`openUpgrade` not defined).

- [ ] **Step 3: Add the slice to the store**

In `frontend/src/state/store.ts`:

1. Extend the type imports (line 7-10) to include `BillingState`:

```typescript
import type {
  Quote, Bar, Fundamentals, NewsItem, Ratings, WatchlistItem, Settings, Holding,
  CryptoResponse, Fng, Timeframe, AuthUser, BillingState,
} from '../api/types'
```

2. Import `ApiError` alongside `api`:

```typescript
import { api, ApiError } from '../api/client'
```

3. In the `StoreState` interface, add (after the `holdings: Holding[]` data field block, near `settings`):

```typescript
  billing: BillingState | null
  upgradePrompt: { feature: string; message: string } | null
```

and in the actions section (near `loadHoldings`):

```typescript
  loadBilling: () => Promise<void>
  openUpgrade: (feature?: string, message?: string) => void
  closeUpgrade: () => void
```

4. In the store body initial state (near `holdings: [],`):

```typescript
  billing: null,
  upgradePrompt: null,
```

5. Add the actions (place near `loadHoldings`):

```typescript
  loadBilling: async () => {
    try {
      const { data } = await api.getBilling()
      set({ billing: data })
    } catch { /* anonymous or offline: leave null */ }
  },

  openUpgrade: (feature = 'pro', message = '') =>
    set({ upgradePrompt: { feature, message } }),
  closeUpgrade: () => set({ upgradePrompt: null }),
```

6. Replace `addWatch` and `updateWatch` to handle `402`:

```typescript
  addWatch: async (sym, target = 0) => {
    try {
      await api.addWatch({ symbol: sym, target })
      const { data } = await api.getWatchlist()
      set({ watchlist: data })
    } catch (e) {
      if (e instanceof ApiError && e.status === 402) {
        get().openUpgrade(e.body?.feature ?? 'watchlist', e.body?.message ?? '')
      }
      // otherwise ignore (offline)
    }
  },

  updateWatch: async (sym, fields) => {
    // Optimistic local update, then persist.
    const prev = get().watchlist
    set((st) => ({
      watchlist: st.watchlist.map((w) => (w.symbol === sym ? { ...w, ...fields } : w)),
    }))
    try {
      await api.updateWatch(sym, fields)
    } catch (e) {
      if (e instanceof ApiError && e.status === 402) {
        set({ watchlist: prev }) // roll back optimistic change
        get().openUpgrade(e.body?.feature ?? 'alerts', e.body?.message ?? '')
      }
      // otherwise keep optimistic value (offline)
    }
  },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm run test -- billing`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/state/store.ts frontend/src/state/billing.test.ts
git commit -m "feat(billing): store billing slice, upgrade-prompt state, 402-aware mutations"
```

---

## Task 11: UpgradePrompt component

**Files:**
- Create: `frontend/src/components/UpgradePrompt.tsx`
- Test: `frontend/src/components/__tests__/UpgradePrompt.test.tsx`

**Interfaces:**
- Consumes: `useStore` (`upgradePrompt`, `closeUpgrade`, `billing`), `api.checkout`.
- Produces: `<UpgradePrompt />` — renders only when `upgradePrompt` is set; primary annual + secondary monthly CTAs redirect to the returned Stripe URL.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/__tests__/UpgradePrompt.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { UpgradePrompt } from '../UpgradePrompt'
import { useStore } from '../../state/store'
import { api } from '../../api/client'

describe('UpgradePrompt', () => {
  beforeEach(() => {
    useStore.setState({ upgradePrompt: null })
    vi.restoreAllMocks()
  })

  it('renders nothing when no prompt is set', () => {
    const { container } = render(<UpgradePrompt />)
    expect(container.firstChild).toBeNull()
  })

  it('shows the message and triggers annual checkout', async () => {
    const spy = vi.spyOn(api, 'checkout').mockResolvedValue({
      data: { url: 'https://checkout.test/go' }, source: 'stripe', stale: false, fetchedAt: '',
    })
    // jsdom: stub navigation so the redirect does not throw.
    const loc = { href: '' } as Location
    vi.stubGlobal('location', loc)
    useStore.setState({ upgradePrompt: { feature: 'watchlist', message: 'Limit reached' } })
    render(<UpgradePrompt />)
    expect(screen.getByText('Limit reached')).toBeInTheDocument()
    fireEvent.click(screen.getByText(/Upgrade yearly/i))
    await waitFor(() => expect(spy).toHaveBeenCalledWith('annual'))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm run test -- UpgradePrompt`
Expected: FAIL (module not found).

- [ ] **Step 3: Create the component**

Create `frontend/src/components/UpgradePrompt.tsx`:

```typescript
import { useState } from 'react'
import { useStore } from '../state/store'
import { api } from '../api/client'
import { FONT_SANS } from '../theme/tokens'

// Reusable upgrade modal shown when a Free user hits a plan limit. Annual is the
// primary CTA per the commercial offer; both CTAs redirect to Stripe Checkout.
export function UpgradePrompt() {
  const prompt = useStore((s) => s.upgradePrompt)
  const close = useStore((s) => s.closeUpgrade)
  const [busy, setBusy] = useState<'monthly' | 'annual' | null>(null)

  if (!prompt) return null

  const go = async (interval: 'monthly' | 'annual') => {
    setBusy(interval)
    try {
      const { data } = await api.checkout(interval)
      location.href = data.url
    } catch {
      setBusy(null)
    }
  }

  return (
    <div
      onClick={close}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 420, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 18, padding: '26px 26px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}
      >
        <span style={{ fontSize: '18px', fontWeight: 800, color: 'var(--tx)' }}>Upgrade to Ticker Tracker Pro</span>
        <span style={{ fontSize: '13.5px', color: 'var(--tx2)', lineHeight: 1.5 }}>
          {prompt.message || 'Unlock more watchlist tickers, price alerts, saved screeners, and the weekly digest.'}
        </span>
        <button
          onClick={() => go('annual')}
          disabled={busy !== null}
          style={{ height: 44, borderRadius: 12, border: 'none', background: 'var(--accent)', color: 'var(--accentInk)', fontFamily: FONT_SANS, fontSize: '14px', fontWeight: 800, cursor: 'pointer' }}
        >
          {busy === 'annual' ? 'Redirecting…' : 'Upgrade yearly — $59/yr'}
        </button>
        <button
          onClick={() => go('monthly')}
          disabled={busy !== null}
          style={{ height: 40, borderRadius: 11, border: '1px solid var(--line2)', background: 'transparent', color: 'var(--tx2)', fontFamily: FONT_SANS, fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
        >
          {busy === 'monthly' ? 'Redirecting…' : 'Monthly — $7/mo'}
        </button>
        <button
          onClick={close}
          style={{ alignSelf: 'center', marginTop: 2, background: 'transparent', border: 'none', color: 'var(--tx3)', fontFamily: FONT_SANS, fontSize: '12.5px', cursor: 'pointer' }}
        >
          Maybe later
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm run test -- UpgradePrompt`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/UpgradePrompt.tsx frontend/src/components/__tests__/UpgradePrompt.test.tsx
git commit -m "feat(billing): reusable UpgradePrompt modal"
```

---

## Task 12: Wire billing into App (mount refresh, checkout-return, render prompt)

**Files:**
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: `loadBilling`, `<UpgradePrompt/>`.

- [ ] **Step 1: Add store selectors + import**

In `frontend/src/App.tsx`, import the component near the other component imports:

```typescript
import { UpgradePrompt } from './components/UpgradePrompt'
```

Add the `loadBilling` selector near the other store selectors (~line 41):

```typescript
  const loadBilling = useStore((s) => s.loadBilling)
```

- [ ] **Step 2: Refresh billing on mount + handle checkout return**

In the mount `useEffect` (~line 54-77), call `loadBilling()` when authenticated and handle the `?checkout=` param:

```typescript
  useEffect(() => {
    loadMe().then(() => {
      if (useStore.getState().currentUser) {
        loadWatchlist()
        loadSettings()
        loadHoldings()
        loadBilling()
      }
    })

    const params = new URLSearchParams(window.location.search)
    const verify = params.get('verify')
    if (verify === 'ok' || verify === 'failed') {
      setVerifyBanner(verify)
      const clean = window.location.pathname
      window.history.replaceState(null, '', clean)
    }
    if (params.get('reset_token')) {
      openAuth()
    }
    // Returning from Stripe Checkout: refresh billing state and clean the URL.
    const checkout = params.get('checkout')
    if (checkout === 'success' || checkout === 'cancel') {
      if (checkout === 'success') loadBilling()
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [loadMe, loadWatchlist, loadSettings, loadHoldings, loadBilling, openAuth])
```

- [ ] **Step 3: Render the UpgradePrompt**

Add `<UpgradePrompt />` near the top of the App's returned JSX tree (alongside other global overlays/modals — e.g. just before the closing fragment/root `</div>`). Place it so it renders on every view:

```tsx
      <UpgradePrompt />
```

- [ ] **Step 4: Login also refreshes billing**

In `frontend/src/state/store.ts`, in the `login` action, add `loadBilling()` to the post-login refresh line:

```typescript
    await get().loadWatchlist(); await get().loadSettings(); await get().loadHoldings(); await get().loadBilling()
```

Also clear it on logout — in the `logout` action's `set(...)`:

```typescript
    set({ currentUser: null, watchlist: [], holdings: [], settings: null, billing: null })
```

- [ ] **Step 5: Build to verify**

Run: `cd frontend && npm run build`
Expected: builds clean.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/App.tsx frontend/src/state/store.ts
git commit -m "feat(billing): refresh billing on mount/login, handle Stripe checkout return, render UpgradePrompt"
```

---

## Task 13: Settings — Plan & Billing card + locked digest toggle

**Files:**
- Modify: `frontend/src/views/Settings.tsx`
- Test: `frontend/src/views/__tests__/Settings.billing.test.tsx`

**Interfaces:**
- Consumes: `useStore` (`billing`, `openUpgrade`), `api.checkout`, `api.portal`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/views/__tests__/Settings.billing.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Settings } from '../Settings'
import { useStore } from '../../state/store'
import { api } from '../../api/client'

const baseSettings = {
  broker_connected: false, broker_name: '', live_updates: true,
  alert_notifs: true, news_digest: false, hide_balances: false, currency: 'USD',
}

function setAuthed(is_pro: boolean) {
  useStore.setState({
    currentUser: { id: 1, email: 'u@e.com', name: 'U', email_verified: true },
    settings: { ...baseSettings },
    holdings: [],
    billing: {
      plan: is_pro ? 'pro' : 'free', status: is_pro ? 'active' : '', is_pro,
      limits: { watchlist: is_pro ? 250 : 15, alerts: is_pro ? 100 : 3, screens: is_pro ? 25 : 1, digest: is_pro },
      usage: { watchlist: 4, alerts: 1, screens: 0 },
      current_period_end: null, cancel_at_period_end: false,
    },
  })
}

describe('Settings billing card', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('Free state shows upgrade CTAs and usage', () => {
    setAuthed(false)
    render(<Settings />)
    expect(screen.getByText(/Upgrade yearly/i)).toBeInTheDocument()
    expect(screen.getByText(/Monthly — \$7\/mo/i)).toBeInTheDocument()
    expect(screen.getByText(/4\s*\/\s*15/)).toBeInTheDocument() // watchlist usage
  })

  it('annual CTA calls checkout', async () => {
    setAuthed(false)
    const spy = vi.spyOn(api, 'checkout').mockResolvedValue({
      data: { url: 'https://c.test/x' }, source: 'stripe', stale: false, fetchedAt: '',
    })
    vi.stubGlobal('location', { href: '' } as Location)
    render(<Settings />)
    fireEvent.click(screen.getByText(/Upgrade yearly/i))
    await waitFor(() => expect(spy).toHaveBeenCalledWith('annual'))
  })

  it('Pro state shows Manage billing', () => {
    setAuthed(true)
    render(<Settings />)
    expect(screen.getByText(/Manage billing/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm run test -- Settings.billing`
Expected: FAIL (no Upgrade CTAs rendered yet).

- [ ] **Step 3: Replace the fake Pro badge with the Plan & Billing card**

In `frontend/src/views/Settings.tsx`:

1. Add selectors + imports at the top of the component:

```typescript
import { useStore, isAuthed } from '../state/store'
import { FONT_SANS } from '../theme/tokens'
import { Toggle } from '../components/Toggle'
import { api } from '../api/client'
```

and inside `Settings()`:

```typescript
  const billing = useStore((s) => s.billing)
  const openUpgrade = useStore((s) => s.openUpgrade)
```

2. Remove the fake badge span (line 75: the `◆ Pro plan` span) — delete that single `<span>…Pro plan</span>` element from the profile card.

3. Insert a Plan & Billing card right after the profile card's closing `</div>` (after line 76). Add these helper handlers above the `return` (near `toggleRow`):

```typescript
  const startCheckout = async (interval: 'monthly' | 'annual') => {
    try {
      const { data } = await api.checkout(interval)
      location.href = data.url
    } catch { /* show nothing; billing may be disabled pre-launch */ }
  }
  const openPortal = async () => {
    try {
      const { data } = await api.portal()
      location.href = data.url
    } catch { /* ignore */ }
  }

  const usageRow = (label: string, used: number, limit: number) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '7px 0' }}>
      <span style={{ fontSize: '12.5px', color: 'var(--tx2)' }}>{label}</span>
      <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--tx)' }}>{used} / {limit}</span>
    </div>
  )
```

Then the card JSX (insert after the profile card):

```tsx
        {billing && (
          <div style={{ ...card, padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--tx)' }}>Plan &amp; Billing</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 11px', borderRadius: 20, background: billing.is_pro ? 'rgba(61,220,132,.12)' : 'var(--cardHi)', fontSize: '12px', fontWeight: 700, color: billing.is_pro ? 'var(--accent)' : 'var(--tx2)' }}>
                {billing.is_pro ? '◆ Pro' : 'Free'}
              </span>
            </div>
            <div style={{ borderTop: '1px solid var(--line)', paddingTop: 8 }}>
              {usageRow('Watchlist tickers', billing.usage.watchlist, billing.limits.watchlist)}
              {usageRow('Active price alerts', billing.usage.alerts, billing.limits.alerts)}
              {usageRow('Saved screeners', billing.usage.screens, billing.limits.screens)}
            </div>
            {billing.is_pro ? (
              <button onClick={openPortal} style={{ alignSelf: 'flex-start', height: 38, padding: '0 16px', borderRadius: 10, border: '1px solid var(--line2)', background: 'transparent', color: 'var(--tx2)', fontFamily: FONT_SANS, fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Manage billing</button>
            ) : (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button onClick={() => startCheckout('annual')} style={{ height: 40, padding: '0 18px', borderRadius: 11, border: 'none', background: 'var(--accent)', color: 'var(--accentInk)', fontFamily: FONT_SANS, fontSize: '13.5px', fontWeight: 800, cursor: 'pointer' }}>Upgrade yearly — $59/yr</button>
                <button onClick={() => startCheckout('monthly')} style={{ height: 40, padding: '0 16px', borderRadius: 11, border: '1px solid var(--line2)', background: 'transparent', color: 'var(--tx2)', fontFamily: FONT_SANS, fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Monthly — $7/mo</button>
              </div>
            )}
          </div>
        )}
```

4. Lock the weekly digest toggle for Free users. Replace the digest line in the Notifications card (line 106):

```tsx
          {(billing?.is_pro ?? true)
            ? toggleRow('Weekly market digest', 'Email summary of your watchlist every Monday', 'news_digest')
            : (
              <div style={row}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                  <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--tx)' }}>Weekly market digest <span style={{ fontSize: '11px', color: 'var(--tx3)' }}>· Pro</span></span>
                  <span style={{ fontSize: '11.5px', color: 'var(--tx3)' }}>Email summary of your watchlist every Monday</span>
                </div>
                <button onClick={() => openUpgrade('digest', 'The weekly market digest is a Pro feature.')} style={{ height: 32, padding: '0 13px', borderRadius: 9, border: 'none', background: 'var(--accent)', color: 'var(--accentInk)', fontFamily: FONT_SANS, fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>Upgrade</button>
              </div>
            )}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm run test -- Settings.billing`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/views/Settings.tsx frontend/src/views/__tests__/Settings.billing.test.tsx
git commit -m "feat(billing): Settings Plan & Billing card + Pro-locked weekly digest toggle"
```

---

## Task 14: ManageWatchlist — usage display + client pre-check + 402 prompt

**Files:**
- Modify: `frontend/src/views/ManageWatchlist.tsx`

**Interfaces:**
- Consumes: `useStore` (`billing`, `openUpgrade`). (Store `addWatch` already opens the prompt on `402` from Task 10.)

- [ ] **Step 1: Add billing selectors**

In `frontend/src/views/ManageWatchlist.tsx`, add inside the component (near the other `useStore` calls):

```typescript
  const billing = useStore((s) => s.billing)
  const openUpgrade = useStore((s) => s.openUpgrade)
```

- [ ] **Step 2: Show ticker usage against the plan limit**

In the header subtitle (line 96), append usage when billing is known:

```tsx
            <span style={{ fontSize: '13px', color: 'var(--tx2)' }}>
              {items.length} ticker{items.length === 1 ? '' : 's'}
              {billing ? ` of ${billing.limits.watchlist}` : ''} · add in bulk, set targets, remove
            </span>
```

- [ ] **Step 3: Prevent obvious over-limit bulk adds client-side**

In `submitBulk`, after computing `syms` and before the add loop, short-circuit when the batch would clearly exceed the Free limit:

```typescript
    if (!syms.length) return
    if (billing && !billing.is_pro) {
      const room = billing.limits.watchlist - items.length
      if (room <= 0 || syms.length > room) {
        openUpgrade('watchlist',
          `Your Free plan allows ${billing.limits.watchlist} watchlist tickers. Upgrade to Pro for more.`)
        return
      }
    }
    setAdding(true)
```

(The per-symbol `addWatch` calls also surface a `402` upgrade prompt via the store if the server rejects — this client check just avoids a doomed bulk loop.)

- [ ] **Step 4: Build to verify**

Run: `cd frontend && npm run build`
Expected: clean build.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/views/ManageWatchlist.tsx
git commit -m "feat(billing): Manage Watchlist shows usage and blocks over-limit bulk adds"
```

---

## Task 15: Screener — saved-screen usage + 402 on save

**Files:**
- Modify: `frontend/src/views/Screener.tsx`

**Interfaces:**
- Consumes: `useStore` (`billing`, `openUpgrade`), `ApiError`.

- [ ] **Step 1: Add billing selectors + ApiError import**

In `frontend/src/views/Screener.tsx`:

```typescript
import { api, ApiError } from '../api/client'
```

and inside the component:

```typescript
  const billing = useStore((s) => s.billing)
  const openUpgrade = useStore((s) => s.openUpgrade)
```

- [ ] **Step 2: Catch 402 on save**

Replace `handleSave` so it surfaces the upgrade prompt on `402`:

```typescript
  const handleSave = async () => {
    const n = saveName.trim()
    if (!n) return
    setSaving(true)
    try {
      const { data } = await api.saveScreen({ name: n, filters: { grp, perf, cap } })
      setSavedScreens((prev) => [...prev, data])
      setSaveName('')
    } catch (e) {
      if (e instanceof ApiError && e.status === 402) {
        openUpgrade(e.body?.feature ?? 'screens', e.body?.message ?? '')
      }
    } finally {
      setSaving(false)
    }
  }
```

- [ ] **Step 3: Show saved-screen usage**

Under the `SAVED SCREENS` label (line 134), add a usage hint when billing is known and the user is authed:

```tsx
          <span style={{ fontSize: '11px', letterSpacing: '.04em', color: 'var(--tx3)', fontWeight: 600 }}>
            SAVED SCREENS{authed && billing ? ` · ${savedScreens.length}/${billing.limits.screens}` : ''}
          </span>
```

- [ ] **Step 4: Build to verify**

Run: `cd frontend && npm run build`
Expected: clean build.

- [ ] **Step 5: Run the full frontend suite**

Run: `cd frontend && npm run test`
Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/views/Screener.tsx
git commit -m "feat(billing): Screener shows saved-screen usage and 402 upgrade prompt"
```

---

## Task 15b: Compare cap — Free 2 / Pro 10

**Files:**
- Modify: `frontend/src/state/store.ts` (`toggleCompare`)
- Modify: `frontend/src/views/Screener.tsx` (`toggleCmp`)
- Test: `frontend/src/state/billing.test.ts` (append)

**Interfaces:**
- Consumes: `useStore` (`billing`, `openUpgrade`).

**Note:** Compare selection is transient UI state (not persisted, no server call),
so the cap is enforced purely client-side. The limit comes from
`billing.limits.compare` (Free 2, Pro 10). When billing is unknown (anonymous /
offline), fall back to the Free cap of 2. Hitting the cap opens the upgrade prompt.

- [ ] **Step 1: Write the failing test**

Append to `frontend/src/state/billing.test.ts` (inside the existing `describe`):

```typescript
  it('toggleCompare caps Free users at 2 and opens upgrade prompt', () => {
    useStore.setState({
      compare: [], upgradePrompt: null,
      billing: {
        plan: 'free', status: '', is_pro: false,
        limits: { watchlist: 15, alerts: 3, screens: 1, digest: false, compare: 2 },
        usage: { watchlist: 0, alerts: 0, screens: 0 },
        current_period_end: null, cancel_at_period_end: false,
      },
    })
    const { toggleCompare } = useStore.getState()
    toggleCompare('AAPL'); toggleCompare('MSFT')
    expect(useStore.getState().compare).toHaveLength(2)
    toggleCompare('NVDA') // third -> blocked
    expect(useStore.getState().compare).toHaveLength(2)
    expect(useStore.getState().upgradePrompt?.feature).toBe('compare')
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm run test -- billing`
Expected: FAIL (current cap is hard-coded at 4 and no upgrade prompt fires).

- [ ] **Step 3: Gate the store's toggleCompare**

In `frontend/src/state/store.ts`, replace `toggleCompare`:

```typescript
  toggleCompare: (sym) => {
    const st = get()
    if (st.compare.includes(sym)) {
      set({ compare: st.compare.filter((x) => x !== sym) })
      return
    }
    const cap = st.billing?.limits.compare ?? 2
    if (st.compare.length >= cap) {
      get().openUpgrade('compare',
        `Free plan compares up to ${cap} stocks at once. Upgrade to Pro to compare up to 10.`)
      return
    }
    set({ compare: [...st.compare, sym] })
  },
```

- [ ] **Step 4: Gate the Screener's local compare**

In `frontend/src/views/Screener.tsx`, the Screener keeps its own `cmp` local state with a hard-coded cap of 4. Add the billing selectors (already added in Task 15: `billing`, `openUpgrade`) and replace `toggleCmp`:

```typescript
  const toggleCmp = (sym: string) =>
    setCmp((c) => {
      if (c.includes(sym)) return c.filter((x) => x !== sym)
      const cap = billing?.limits.compare ?? 2
      if (c.length >= cap) {
        openUpgrade('compare',
          `Free plan compares up to ${cap} stocks at once. Upgrade to Pro to compare up to 10.`)
        return c
      }
      return [...c, sym]
    })
```

- [ ] **Step 5: Run tests + build to verify**

Run: `cd frontend && npm run test -- billing && npm run build`
Expected: PASS and clean build.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/state/store.ts frontend/src/views/Screener.tsx frontend/src/state/billing.test.ts
git commit -m "feat(billing): cap stock compare at 2 (Free) / 10 (Pro) with upgrade prompt"
```

---

## Task 16: Docs, env vars, and Stripe setup guide

**Files:**
- Create: `docs/ops/stripe-billing-setup.md`
- Modify: `.env.example`
- Modify: `README.md`

**Interfaces:** none (documentation).

- [ ] **Step 1: Add env vars to `.env.example`**

Append to `.env.example`:

```bash
# ── Billing (Stripe subscriptions) ───────────────────────────────────────────
# Master switch. Leave false until market-data licensing for commercial use is
# confirmed. When false, plan limits are NOT enforced (app behaves as pre-launch).
# BILLING_ENABLED=false

# Stripe secret key (test: sk_test_..., live: sk_live_...). https://dashboard.stripe.com/apikeys
# STRIPE_SECRET_KEY=sk_test_your_key
# Webhook signing secret for POST /api/stripe/webhook (whsec_...).
# STRIPE_WEBHOOK_SECRET=whsec_your_secret
# Price IDs for the Ticker Tracker Pro product (Stripe Dashboard → Product → Pricing).
# STRIPE_PRO_MONTHLY_PRICE_ID=price_monthly_id   # $7/month
# STRIPE_PRO_ANNUAL_PRICE_ID=price_annual_id     # $59/year
```

- [ ] **Step 2: Create the setup guide**

Create `docs/ops/stripe-billing-setup.md`:

```markdown
# Stripe Billing Setup

Ticker Tracker Pro is a freemium subscription: $7/month or $59/year (annual is
the primary CTA). Statuses `active` and `trialing` count as Pro.

## 1. Create the product & prices
1. Stripe Dashboard → **Products** → **Add product**: name `Ticker Tracker Pro`.
2. Add a recurring price: **$7.00 / month** → copy its price id → `STRIPE_PRO_MONTHLY_PRICE_ID`.
3. Add a second recurring price: **$59.00 / year** → copy its price id → `STRIPE_PRO_ANNUAL_PRICE_ID`.

## 2. Configure the Customer Portal
Dashboard → **Settings → Billing → Customer portal**. Enable:
- Cancel subscription.
- Update payment method.
Save. (`POST /api/billing/portal` returns a portal session.)

## 3. Add the webhook endpoint
Dashboard → **Developers → Webhooks → Add endpoint**:
- URL: `https://tickertracker.info/api/stripe/webhook`
- Events:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
- Copy the signing secret → `STRIPE_WEBHOOK_SECRET`.

## 4. Environment variables
Set on the Railway web service (and any service that needs them):
`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRO_MONTHLY_PRICE_ID`,
`STRIPE_PRO_ANNUAL_PRICE_ID`, `BILLING_ENABLED`.

## 5. Local testing
```bash
stripe listen --forward-to localhost:5000/api/stripe/webhook
```
Use the `whsec_...` it prints as `STRIPE_WEBHOOK_SECRET` locally. Trigger test
events with `stripe trigger checkout.session.completed`.

## Launch gate
**Do not set `BILLING_ENABLED=true` in production** until market-data provider
commercial-use rights are confirmed or upgraded. Until then limits are not
enforced and the app behaves exactly as it does today.

## References
- https://docs.stripe.com/webhooks
- https://docs.stripe.com/billing/subscriptions/webhooks
- https://docs.stripe.com/customer-management
- https://docs.stripe.com/cli
- https://docs.stripe.com/get-started/development-environment?lang=python
```

- [ ] **Step 3: Add a Billing section to the README**

Add a short section to `README.md` (after the existing env/setup content) summarizing the freemium tiers, the five env vars, and a pointer to `docs/ops/stripe-billing-setup.md`. Include the Free vs Pro limit table and the launch-gate note:

| Feature | Free | Pro |
| --- | --- | --- |
| Watchlist tickers | 15 | 250 |
| Active price alerts | 3 | 100 |
| Saved screeners | 1 | 25 |
| Compare stocks at once | 2 | 10 |
| Price-hit alert emails | — | ✓ |
| Weekly market digest | — | ✓ |

- [ ] **Step 4: Commit**

```bash
git add docs/ops/stripe-billing-setup.md .env.example README.md
git commit -m "docs(billing): Stripe setup guide, env vars, README Billing section + launch gate"
```

---

## Task 17: Version bump + changelog + full verification

**Files:**
- Modify: `frontend/package.json` (version → `1.14.0`)
- Modify: `CHANGELOG.md`

**Interfaces:** none.

- [ ] **Step 1: Bump version**

In `frontend/package.json`, change `"version": "1.13.1"` → `"version": "1.14.0"`.

- [ ] **Step 2: Add a CHANGELOG entry**

Prepend a `## [1.14.0]` entry to `CHANGELOG.md` describing: real Stripe Pro subscriptions (freemium), plan limits enforced server-side with `402` (watchlist/alerts/screens), Plan & Billing card, upgrade prompts, Customer Portal, compare cap (Free 2 / Pro 10), price-hit alert emails now Pro-only, weekly digest now Pro-only, `BILLING_ENABLED` launch gate. Match the existing changelog format/heading style.

- [ ] **Step 3: Run all verification commands**

```bash
cd backend && python -m pytest -q
cd frontend && npm run test
cd frontend && npm run build
```
Expected: backend suite green, frontend suite green, build succeeds.

- [ ] **Step 4: Commit**

```bash
git add frontend/package.json CHANGELOG.md
git commit -m "chore(release): v1.14.0 — Stripe Pro subscriptions"
```

---

## Self-Review

**Spec coverage:**
- Stripe dep pinned `15.3.0` → Task 1. New tables (`billing_subscriptions`, `stripe_events`) → Task 1. Migration after `dd01` → Task 1. Env vars → Tasks 4/16. `BILLING_ENABLED` → Tasks 2/3.
- `billing.py`: plan constants/limits → Task 2; `get_billing_state` → Task 2; `create_checkout_session`/`create_portal_session` → Task 4; webhook sync helpers → Task 5.
- Routes `GET /api/billing`, `POST /api/billing/checkout`, `POST /api/billing/portal`, `POST /api/stripe/webhook` (raw body sig verify, 4 events, idempotency) → Tasks 5/6.
- Limit enforcement on watchlist POST (402), watchlist PATCH alert (402), screens POST (402), settings digest (402), digest cron skip → Tasks 7/8. Consistent error body → Task 3.
- Price-hit alert emails Pro-only (alert cron gate) → Task 8b. Compare cap Free 2 / Pro 10 (client-side, upgrade prompt) → Tasks 2 (limit), 15b (enforcement in store + Screener).
- Frontend types/client → Task 9; store `billing`/`loadBilling`/refresh hooks/checkout-return → Tasks 10/12; Plan & Billing card → Task 13; reusable upgrade prompt → Task 11; ManageWatchlist usage + 402 → Task 14; alert toggle rollback + 402 → Task 10 (store `updateWatch`); Screener usage + 402 → Task 15; digest toggle locked Free / normal Pro → Task 13.
- Docs/setup → Task 16; tests throughout; verification → Task 17.
- Full test plan (backend + frontend bullets) mapped to Tasks 2,3,4,5,6,7,8 (backend) and 10,11,13,14,15 (frontend).

**Type consistency:** `BillingState` shape identical across `types.ts`, store, components, and backend `get_billing_state`. `check_*` helpers consistently return `dict | None`. `ApiError` used identically in store, Screener.

**Assumptions carried from spec:** real Stripe is v1; no trial; annual is primary CTA; `active`/`trialing` = Pro; data licensing is a launch gate (handled via `BILLING_ENABLED`, default false), not a code blocker.
