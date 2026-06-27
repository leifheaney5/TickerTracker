# Launch Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Ticker Tracker launch-ready by delivering real email price alerts + a weekly digest, fixing remaining data/UX QA defects (news links, timestamps, anonymous Compare), and documenting the two human-only launch gates (Resend domain, Google OAuth).

**Architecture:** All alert/digest logic lives in pure, testable functions in `backend/services/alerts.py` and `backend/services/digest.py`, driven by a standalone CLI entrypoint `backend/jobs.py` that a **separate Railway cron service** invokes on a schedule (every 5 min for alerts, weekly for digest). The existing web service is untouched by the scheduler. Email reuses the existing `providers/email.py::_send`. Frontend changes are small, inline-style edits consistent with the existing token-based components.

**Tech Stack:** Flask + SQLAlchemy 2 + psycopg v3 (backend), Resend (email), Railway cron (scheduler), React 18 + Vite + TypeScript + Zustand (frontend), pytest + vitest (tests).

## Global Constraints

- No `Co-Authored-By:` trailers in commit messages (user global rule).
- Keep `CHANGELOG.md` updated and roll the semver `VERSION` + `frontend/package.json` version as needed; small, modular commits.
- Backend response envelope is always `{data, meta:{source, stale}}` via `envelope(...)`.
- Frontend uses INLINE styles + design tokens from `frontend/src/theme/tokens.ts` (COLORS, FONT_SANS, FONT_MONO). NO CSS framework, NO Tailwind.
- DB access uses `with db.get_session() as s:` (a `@contextmanager`). Never open raw sessions.
- Email sends go through `providers.email._send(to: str, subject: str, html: str) -> bool` (returns False, never raises, when `RESEND_API_KEY` is unset).
- Schema changes: add columns via Alembic migration in `backend/migrations/versions/`; the boot-time `init_db()` create_all covers fresh DBs but does NOT ALTER existing tables.
- Provider quotes come from `services.quotes.get_quotes(syms: list[str]) -> tuple[dict[str, dict], str]` where each quote dict has keys `price, change_pct, day_open, day_high, day_low, prev_close, volume`.
- Existing models (do not redefine): `WatchlistItem(user_id, symbol, position, target, alert_price, alert_dir, created_at)`, `AlertLog(user_id, symbol, price, triggered_at)`, `Settings(user_id, alert_notifs, news_digest, ...)`, `User(id, email, name, email_verified)`.
- All new backend tests live in `backend/tests/` and run green under `cd backend && ./.venv/Scripts/python.exe -m pytest -q` (currently 87 passing).
- The cron entrypoint must be import-safe (no side effects on import) so unit tests can call its functions directly.

---

### Task 1: Alert state columns + migration

**Files:**
- Modify: `backend/models.py` (add two columns to `WatchlistItem`, after `alert_dir`, line ~26)
- Create: `backend/migrations/versions/aa01_alert_state.py`
- Test: `backend/tests/test_alert_model.py`

**Interfaces:**
- Consumes: existing `WatchlistItem` model and `db.get_session()`.
- Produces: `WatchlistItem.alert_active: bool` (default False — whether the user armed an alert) and `WatchlistItem.alert_last_fired_at: datetime|None` (last time this alert emailed, for de-dupe/cooldown). Later tasks read both.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_alert_model.py
import db, models

def test_watchlist_item_has_alert_state_columns():
    cols = {c.name for c in models.WatchlistItem.__table__.columns}
    assert "alert_active" in cols
    assert "alert_last_fired_at" in cols

def test_alert_state_defaults(tmp_path, monkeypatch):
    # fresh in-memory DB via create_all reflects the new columns with defaults
    item = models.WatchlistItem(user_id=1, symbol="AAPL")
    assert item.alert_active in (False, None)
    assert item.alert_last_fired_at is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && ./.venv/Scripts/python.exe -m pytest tests/test_alert_model.py -v`
Expected: FAIL — `assert "alert_active" in cols` fails (column missing).

- [ ] **Step 3: Add the columns**

In `backend/models.py`, inside `class WatchlistItem`, immediately after the `alert_dir` line, add:

```python
    alert_active = Column(Boolean, default=False)
    alert_last_fired_at = Column(DateTime, nullable=True)
```

(Confirm `Boolean` and `DateTime` are already imported at the top of `models.py` — they are, used by other models.)

- [ ] **Step 4: Write the Alembic migration**

```python
# backend/migrations/versions/aa01_alert_state.py
"""alert state columns on watchlist_items"""
from alembic import op
import sqlalchemy as sa

revision = "aa01_alert_state"
down_revision = "5312d8e01ae0"  # the auth columns migration (latest)
branch_labels = None
depends_on = None

def upgrade():
    op.add_column("watchlist_items", sa.Column("alert_active", sa.Boolean(), server_default=sa.false(), nullable=False))
    op.add_column("watchlist_items", sa.Column("alert_last_fired_at", sa.DateTime(), nullable=True))

def downgrade():
    op.drop_column("watchlist_items", "alert_last_fired_at")
    op.drop_column("watchlist_items", "alert_active")
```

Before writing `down_revision`, verify the current head: `cd backend && ./.venv/Scripts/python.exe -m alembic heads`. If it prints a revision other than `5312d8e01ae0`, use that printed value as `down_revision`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && ./.venv/Scripts/python.exe -m pytest tests/test_alert_model.py -v`
Expected: PASS (2 passed).

- [ ] **Step 6: Run the full suite (no regressions)**

Run: `cd backend && ./.venv/Scripts/python.exe -m pytest -q`
Expected: all pass (89 = 87 + 2 new).

- [ ] **Step 7: Commit**

```bash
git add backend/models.py backend/migrations/versions/aa01_alert_state.py backend/tests/test_alert_model.py
git commit -m "feat(alerts): add alert_active + alert_last_fired_at columns + migration"
```

---

### Task 2: Expose alert fields through the watchlist API + allowlist

**Files:**
- Modify: `backend/services/store.py` (`_wl_dict` serializer, ~line 100; `update_watch`)
- Modify: `backend/app.py` (`watchlist_patch` allowlist, ~line 189)
- Modify: `frontend/src/api/types.ts` (`WatchlistItem` interface, line 83)
- Test: `backend/tests/test_alert_api.py`

**Interfaces:**
- Consumes: Task 1 columns; existing `update_watch(sym, **fields)` and `_wl_dict`.
- Produces: watchlist GET/PATCH round-trips `alert_active: bool`. Frontend `WatchlistItem` type gains `alert_active: boolean`.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_alert_api.py
import app as appmod
from app import app

def test_watchlist_patch_accepts_alert_active(monkeypatch):
    captured = {}
    monkeypatch.setattr(appmod, "update_watch",
                        lambda sym, **f: captured.update(f) or {"symbol": sym, **f})
    monkeypatch.setattr(appmod, "_require_user", lambda: 1)
    with appmod._rl_lock:
        appmod._rl_hits.clear()
    r = app.test_client().patch("/api/watchlist/AAPL",
                                json={"alert_active": True, "alert_price": 200, "evil": 1})
    assert r.status_code == 200
    assert captured == {"alert_active": True, "alert_price": 200}  # 'evil' dropped
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && ./.venv/Scripts/python.exe -m pytest tests/test_alert_api.py -v`
Expected: FAIL — `alert_active` not in the allowlist, so `captured` lacks it.

- [ ] **Step 3: Add `alert_active` to the watchlist PATCH allowlist**

In `backend/app.py` `watchlist_patch`, change the allowlist set:

```python
    allowed = {"target", "alert_price", "alert_dir", "alert_active"}
```

- [ ] **Step 4: Serialize the field in `_wl_dict`**

In `backend/services/store.py`, find `_wl_dict` (the function building the watchlist item dict) and add `alert_active` to the returned dict:

```python
        "alert_active": bool(w.alert_active),
```

(Match the existing key style in that dict; do not add `alert_last_fired_at` — that is server-internal.)

- [ ] **Step 5: Add the field to the frontend type**

In `frontend/src/api/types.ts`, in `interface WatchlistItem`, add after `alert_dir`:

```typescript
  alert_active: boolean
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd backend && ./.venv/Scripts/python.exe -m pytest tests/test_alert_api.py -v`
Expected: PASS.

- [ ] **Step 7: Verify frontend still type-checks**

Run: `cd frontend && npm run build`
Expected: build succeeds (0 TS errors).

- [ ] **Step 8: Commit**

```bash
git add backend/app.py backend/services/store.py frontend/src/api/types.ts backend/tests/test_alert_api.py
git commit -m "feat(alerts): expose alert_active through watchlist API + type"
```

---

### Task 3: Alert evaluation logic (pure function)

**Files:**
- Create: `backend/services/alerts.py`
- Test: `backend/tests/test_alerts_service.py`

**Interfaces:**
- Consumes: `services.quotes.get_quotes`, `providers.email._send`, models, `db.get_session`.
- Produces:
  - `should_fire(price: float, alert_price: float, alert_dir: str) -> bool` — pure comparison.
  - `due_alerts(session) -> list[WatchlistItem]` — armed alerts not on cooldown (`alert_active and alert_price>0` and `alert_last_fired_at` older than `COOLDOWN` or None).
  - `check_alerts(now=None, quote_fn=None, send_fn=None) -> int` — evaluates all due alerts, emails matches, writes `AlertLog`, stamps `alert_last_fired_at`; returns count fired. `quote_fn`/`send_fn` are injectable for tests (default to the real ones).
  - Module constant `COOLDOWN = timedelta(hours=12)`.

- [ ] **Step 1: Write the failing tests**

```python
# backend/tests/test_alerts_service.py
import datetime as dt
import db, models
import services.alerts as al

def test_should_fire_above():
    assert al.should_fire(101, 100, "above") is True
    assert al.should_fire(99, 100, "above") is False

def test_should_fire_below():
    assert al.should_fire(99, 100, "below") is True
    assert al.should_fire(101, 100, "below") is False

def test_check_alerts_fires_and_stamps(monkeypatch):
    # one armed alert on AAPL above 100; price comes back 150 -> should fire once
    sent = []
    def fake_quote(syms): return ({s: {"price": 150.0} for s in syms}, "test")
    def fake_send(to, subject, html): sent.append((to, subject)); return True

    # Seed an in-memory DB with a user + armed alert.
    al._seed_for_test(user_email="u@e.com", symbol="AAPL",
                      alert_price=100, alert_dir="above", alert_active=True)
    fired = al.check_alerts(quote_fn=fake_quote, send_fn=fake_send)
    assert fired == 1
    assert sent and sent[0][0] == "u@e.com"
    # second run is suppressed by cooldown
    fired2 = al.check_alerts(quote_fn=fake_quote, send_fn=fake_send)
    assert fired2 == 0
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && ./.venv/Scripts/python.exe -m pytest tests/test_alerts_service.py -v`
Expected: FAIL — `No module named 'services.alerts'`.

- [ ] **Step 3: Implement the service**

```python
# backend/services/alerts.py
import datetime as dt
import logging
import db
import models
from services.quotes import get_quotes
from providers.email import _send

logger = logging.getLogger(__name__)
COOLDOWN = dt.timedelta(hours=12)


def should_fire(price: float, alert_price: float, alert_dir: str) -> bool:
    if not alert_price:
        return False
    if alert_dir == "below":
        return price <= alert_price
    return price >= alert_price  # default "above"


def due_alerts(session, now=None):
    now = now or dt.datetime.utcnow()
    rows = (session.query(models.WatchlistItem)
            .filter(models.WatchlistItem.alert_active.is_(True))
            .filter(models.WatchlistItem.alert_price > 0)
            .all())
    out = []
    for w in rows:
        last = w.alert_last_fired_at
        if last is None or (now - last) >= COOLDOWN:
            out.append(w)
    return out


def _alert_email_html(symbol, price, alert_price, alert_dir):
    arrow = "rose above" if alert_dir == "above" else "fell below"
    return (f"<p><b>{symbol}</b> {arrow} your alert price.</p>"
            f"<p>Current: ${price:,.2f} &middot; Alert: ${alert_price:,.2f}</p>"
            f'<p><a href="https://tickertracker.info">Open Ticker Tracker</a></p>')


def check_alerts(now=None, quote_fn=None, send_fn=None) -> int:
    now = now or dt.datetime.utcnow()
    quote_fn = quote_fn or get_quotes
    send_fn = send_fn or _send
    fired = 0
    with db.get_session() as s:
        due = due_alerts(s, now=now)
        if not due:
            return 0
        syms = sorted({w.symbol for w in due})
        quotes, _ = quote_fn(syms)
        for w in due:
            q = quotes.get(w.symbol)
            if not q:
                continue
            price = q["price"]
            if not should_fire(price, w.alert_price, w.alert_dir):
                continue
            user = s.query(models.User).get(w.user_id)
            settings = s.query(models.Settings).get(w.user_id)
            if not user or not user.email:
                continue
            if settings is not None and not settings.alert_notifs:
                continue
            ok = send_fn(user.email,
                         f"{w.symbol} hit your alert price",
                         _alert_email_html(w.symbol, price, w.alert_price, w.alert_dir))
            if ok:
                s.add(models.AlertLog(user_id=w.user_id, symbol=w.symbol, price=price))
                w.alert_last_fired_at = now
                fired += 1
        s.commit()
    return fired


def _seed_for_test(user_email, symbol, alert_price, alert_dir, alert_active):
    """Test helper: create a user + armed watchlist alert in the current DB."""
    with db.get_session() as s:
        u = models.User(email=user_email, name="t", email_verified=True)
        s.add(u); s.flush()
        s.add(models.Settings(user_id=u.id, alert_notifs=True))
        s.add(models.WatchlistItem(user_id=u.id, symbol=symbol,
                                   alert_price=alert_price, alert_dir=alert_dir,
                                   alert_active=alert_active))
        s.commit()
```

Note: if `models.User` requires a non-null `password_hash`, set a dummy in `_seed_for_test` (`password_hash="x"`); check the model and adjust before running.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && ./.venv/Scripts/python.exe -m pytest tests/test_alerts_service.py -v`
Expected: PASS (3 passed). If `check_alerts` test fails on session isolation (the test DB), confirm the test DB fixture in `conftest.py` creates all tables; reuse the same fixture other service tests use.

- [ ] **Step 5: Commit**

```bash
git add backend/services/alerts.py backend/tests/test_alerts_service.py
git commit -m "feat(alerts): price-alert evaluation service with cooldown + email"
```

---

### Task 4: Weekly digest logic (pure function)

**Files:**
- Create: `backend/services/digest.py`
- Test: `backend/tests/test_digest_service.py`

**Interfaces:**
- Consumes: `services.quotes.get_quotes`, `providers.email._send`, models, `db.get_session`.
- Produces:
  - `build_digest_html(name: str, rows: list[dict]) -> str` — pure; `rows` are `{"symbol","price","change_pct"}`.
  - `send_weekly_digest(quote_fn=None, send_fn=None) -> int` — for each user with `Settings.news_digest == True` and a verified email, email a recap of their watchlist; returns users emailed.

- [ ] **Step 1: Write the failing tests**

```python
# backend/tests/test_digest_service.py
import services.digest as dg

def test_build_digest_html_lists_symbols():
    html = dg.build_digest_html("Sam", [
        {"symbol": "AAPL", "price": 283.78, "change_pct": 1.2},
        {"symbol": "NVDA", "price": 192.53, "change_pct": -0.8},
    ])
    assert "AAPL" in html and "NVDA" in html
    assert "Sam" in html

def test_send_weekly_digest_only_opted_in(monkeypatch):
    sent = []
    def fake_quote(syms): return ({s: {"price": 10.0, "change_pct": 1.0} for s in syms}, "t")
    def fake_send(to, subject, html): sent.append(to); return True
    dg._seed_for_test(email="in@e.com", news_digest=True, symbol="AAPL")
    dg._seed_for_test(email="out@e.com", news_digest=False, symbol="AAPL")
    n = dg.send_weekly_digest(quote_fn=fake_quote, send_fn=fake_send)
    assert n == 1
    assert sent == ["in@e.com"]
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && ./.venv/Scripts/python.exe -m pytest tests/test_digest_service.py -v`
Expected: FAIL — `No module named 'services.digest'`.

- [ ] **Step 3: Implement the service**

```python
# backend/services/digest.py
import logging
import db
import models
from services.quotes import get_quotes
from providers.email import _send

logger = logging.getLogger(__name__)


def build_digest_html(name: str, rows: list[dict]) -> str:
    greeting = f"<p>Hi {name or 'there'}, here's your watchlist this week:</p>"
    items = "".join(
        f"<li><b>{r['symbol']}</b>: ${r['price']:,.2f} "
        f"({'+' if r['change_pct'] >= 0 else ''}{r['change_pct']:.2f}%)</li>"
        for r in rows
    )
    body = f"<ul>{items}</ul>" if rows else "<p>Your watchlist is empty.</p>"
    return (greeting + body +
            '<p><a href="https://tickertracker.info">Open Ticker Tracker</a></p>')


def send_weekly_digest(quote_fn=None, send_fn=None) -> int:
    quote_fn = quote_fn or get_quotes
    send_fn = send_fn or _send
    emailed = 0
    with db.get_session() as s:
        opted = (s.query(models.Settings)
                 .filter(models.Settings.news_digest.is_(True)).all())
        for st in opted:
            user = s.query(models.User).get(st.user_id)
            if not user or not user.email or not user.email_verified:
                continue
            items = (s.query(models.WatchlistItem)
                     .filter_by(user_id=st.user_id)
                     .order_by(models.WatchlistItem.position).all())
            syms = [w.symbol for w in items]
            quotes, _ = quote_fn(syms) if syms else ({}, "none")
            rows = [{"symbol": w.symbol,
                     "price": quotes.get(w.symbol, {}).get("price", 0.0),
                     "change_pct": quotes.get(w.symbol, {}).get("change_pct", 0.0)}
                    for w in items]
            if send_fn(user.email, "Your Ticker Tracker weekly digest",
                       build_digest_html(user.name, rows)):
                emailed += 1
    return emailed


def _seed_for_test(email, news_digest, symbol):
    with db.get_session() as s:
        u = models.User(email=email, name="t", email_verified=True)
        s.add(u); s.flush()
        s.add(models.Settings(user_id=u.id, news_digest=news_digest))
        s.add(models.WatchlistItem(user_id=u.id, symbol=symbol))
        s.commit()
```

(Same `password_hash` caveat as Task 3 if the model requires it.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && ./.venv/Scripts/python.exe -m pytest tests/test_digest_service.py -v`
Expected: PASS (2 passed).

- [ ] **Step 5: Commit**

```bash
git add backend/services/digest.py backend/tests/test_digest_service.py
git commit -m "feat(digest): weekly watchlist digest service (opt-in)"
```

---

### Task 5: Cron job entrypoint

**Files:**
- Create: `backend/jobs.py`
- Test: `backend/tests/test_jobs.py`

**Interfaces:**
- Consumes: `services.alerts.check_alerts`, `services.digest.send_weekly_digest`.
- Produces: a CLI `python backend/jobs.py <command>` where `<command>` ∈ `{check-alerts, weekly-digest}`. `main(argv)` returns process exit code (0 ok). Import-safe (guarded by `if __name__ == "__main__"`).

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_jobs.py
import jobs

def test_main_dispatches_check_alerts(monkeypatch):
    called = {}
    monkeypatch.setattr(jobs, "check_alerts", lambda: called.setdefault("a", 1) or 3)
    rc = jobs.main(["check-alerts"])
    assert rc == 0 and called.get("a") == 1

def test_main_dispatches_weekly_digest(monkeypatch):
    called = {}
    monkeypatch.setattr(jobs, "send_weekly_digest", lambda: called.setdefault("d", 1) or 2)
    rc = jobs.main(["weekly-digest"])
    assert rc == 0 and called.get("d") == 1

def test_main_unknown_command_returns_nonzero():
    assert jobs.main(["nope"]) != 0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && ./.venv/Scripts/python.exe -m pytest tests/test_jobs.py -v`
Expected: FAIL — `No module named 'jobs'`.

- [ ] **Step 3: Implement the entrypoint**

```python
# backend/jobs.py
"""Cron entrypoint. Run on Railway via:  python backend/jobs.py check-alerts
                                          python backend/jobs.py weekly-digest"""
import sys
import logging
from services.alerts import check_alerts
from services.digest import send_weekly_digest

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("jobs")


def main(argv) -> int:
    if not argv:
        logger.error("usage: jobs.py <check-alerts|weekly-digest>")
        return 2
    cmd = argv[0]
    if cmd == "check-alerts":
        n = check_alerts()
        logger.info("alerts fired: %s", n)
        return 0
    if cmd == "weekly-digest":
        n = send_weekly_digest()
        logger.info("digests sent: %s", n)
        return 0
    logger.error("unknown command: %s", cmd)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && ./.venv/Scripts/python.exe -m pytest tests/test_jobs.py -v`
Expected: PASS (3 passed).

- [ ] **Step 5: Commit**

```bash
git add backend/jobs.py backend/tests/test_jobs.py
git commit -m "feat(jobs): cron entrypoint for check-alerts + weekly-digest"
```

---

### Task 6: Frontend — arm/disarm alerts in the Manage Watchlist screen

**Files:**
- Modify: `frontend/src/views/ManageWatchlist.tsx`
- Modify: `frontend/src/state/store.ts` (ensure `updateWatch` round-trips `alert_active`, `alert_price`, `alert_dir`)
- Test: `frontend/src/views/ManageWatchlist.test.tsx`

**Interfaces:**
- Consumes: Task 2's `alert_active` field + existing `updateWatch(sym, patch)` store action.
- Produces: a per-row "Alert" control that sets `alert_price`, `alert_dir`, and toggles `alert_active`.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/views/ManageWatchlist.test.tsx
import { render, screen } from '@testing-library/react'
import { ManageWatchlist } from './ManageWatchlist'
import { useStore } from '../state/store'
import { describe, it, expect, beforeEach } from 'vitest'

describe('ManageWatchlist alerts', () => {
  beforeEach(() => {
    useStore.setState({
      currentUser: { id: 1, email: 'a@b.c', name: 'A', email_verified: true },
      watchlist: [{ symbol: 'AAPL', position: 0, target: 0, alert_price: 0,
                    alert_dir: 'above', alert_active: false }],
    } as any)
  })
  it('renders an alert control per row', () => {
    render(<ManageWatchlist />)
    expect(screen.getByText('AAPL')).toBeTruthy()
    expect(screen.getByTitle(/set price alert/i)).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm run test -- ManageWatchlist`
Expected: FAIL — no element with title "set price alert".

- [ ] **Step 3: Add the alert control to each row**

In `ManageWatchlist.tsx`, the editable list currently has columns `TICKER PRICE 24H TARGET (remove)`. Add an "ALERT" header and per-row control. Add to the header array: `['TICKER', 'PRICE', '24H', 'TARGET', 'ALERT', '']` and widen the grid template (add one `120px` track). In each row, before the remove button, add:

```tsx
                <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    title="Set price alert"
                    type="number"
                    placeholder="$"
                    defaultValue={w.alert_price || ''}
                    onBlur={(e) => updateWatch(w.symbol, { alert_price: parseFloat(e.target.value) || 0 })}
                    style={{ width: 64, height: 28, padding: '0 7px', borderRadius: 7, border: `1px solid ${COLORS.line2}`, background: COLORS.bg, color: COLORS.tx, fontFamily: FONT_MONO, fontSize: '12px' }}
                  />
                  <button
                    onClick={() => updateWatch(w.symbol, { alert_active: !w.alert_active })}
                    title={w.alert_active ? 'Alert on' : 'Alert off'}
                    style={{ height: 28, padding: '0 8px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: 700, background: w.alert_active ? COLORS.up : COLORS.cardHi, color: w.alert_active ? COLORS.accentInk : COLORS.tx3 }}
                  >
                    {w.alert_active ? 'ON' : 'OFF'}
                  </button>
                </div>
```

Update BOTH `gridTemplateColumns` occurrences (header row and data row) to include the new track, e.g.:
`'minmax(160px,1.6fr) 110px 90px 150px 120px 90px'`.

- [ ] **Step 4: Confirm the store action sends the fields**

In `frontend/src/state/store.ts`, find `updateWatch`. Confirm it calls `api.updateWatch(sym, patch)` and merges the response into `watchlist`. If `patch` is typed as `Partial<WatchlistItem>`, `alert_active`/`alert_price`/`alert_dir` already pass through — no change needed. If it whitelists keys, add the three alert keys.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd frontend && npm run test -- ManageWatchlist`
Expected: PASS.

- [ ] **Step 6: Build**

Run: `cd frontend && npm run build`
Expected: success.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/views/ManageWatchlist.tsx frontend/src/state/store.ts frontend/src/views/ManageWatchlist.test.tsx
git commit -m "feat(alerts): arm/disarm price alerts in Manage Watchlist"
```

---

### Task 7: Fix news links pointing at API URLs (BUG-018)

**Files:**
- Modify: `backend/providers/finnhub.py` (`fetch_news`, ~line 84)
- Test: `backend/tests/test_news_links.py`

**Interfaces:**
- Consumes: existing `fetch_news` shape `{source, datetime, sentiment, headline, url, symbol}`.
- Produces: `fetch_news` never returns an item whose `url` is empty or a raw `finnhub.io/api` endpoint.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_news_links.py
import providers.finnhub as fh

def test_fetch_news_drops_api_urls(monkeypatch):
    rows = [
        {"headline": "Real article", "url": "https://example.com/a", "source": "X", "datetime": 0},
        {"headline": "API url", "url": "https://finnhub.io/api/news?id=9", "source": "Y", "datetime": 0},
        {"headline": "No url", "url": "", "source": "Z", "datetime": 0},
    ]
    class R:
        ok = True
        def raise_for_status(self): pass
        def json(self): return rows
    monkeypatch.setattr(fh, "_key", lambda: "k")
    monkeypatch.setattr(fh.requests, "get", lambda *a, **k: R())
    out = fh.fetch_news("AAPL")
    urls = [x["url"] for x in out]
    assert "https://example.com/a" in urls
    assert all("finnhub.io/api" not in u for u in urls)
    assert all(u for u in urls)  # no empty urls
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && ./.venv/Scripts/python.exe -m pytest tests/test_news_links.py -v`
Expected: FAIL — API-url and empty-url items are currently returned.

- [ ] **Step 3: Filter bad URLs in `fetch_news`**

In `backend/providers/finnhub.py`, in `fetch_news`, change the final list comprehension to skip items without a usable article URL. Replace the `return [...]` block with:

```python
    out = []
    for a in rows:
        url = a.get("url", "") or ""
        if not url or "finnhub.io/api" in url:
            continue  # skip raw API endpoints / missing links (BUG-018)
        if not a.get("headline"):
            continue
        out.append({
            "source": a.get("source", "—"),
            "datetime": _ago(a.get("datetime", 0)),
            "sentiment": _sentiment(a),
            "headline": a.get("headline", ""),
            "url": url,
            "symbol": sym or "MKT",
        })
    return out
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && ./.venv/Scripts/python.exe -m pytest tests/test_news_links.py -v`
Expected: PASS.

- [ ] **Step 5: Run the full suite (existing news tests still pass)**

Run: `cd backend && ./.venv/Scripts/python.exe -m pytest -q`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add backend/providers/finnhub.py backend/tests/test_news_links.py
git commit -m "fix(news): drop API-endpoint/empty news URLs so links open real articles (BUG-018)"
```

---

### Task 8: "As of" timestamps on quotes and Fear & Greed (BUG-013, BUG-017)

**Files:**
- Modify: `backend/app.py` (extend `envelope` meta OR add `fetched_at`) — see step 3 for the chosen approach
- Modify: `frontend/src/components/KeyStats.tsx` (or the Dashboard header where price shows) to render "as of HH:MM"
- Modify: `frontend/src/views/MarketViews.tsx` (Fear & Greed display) to show the same
- Test: `backend/tests/test_meta_timestamp.py`

**Interfaces:**
- Consumes: existing `envelope(data, source=..., stale=...)`.
- Produces: every envelope's `meta` includes `fetched_at` (ISO-8601 UTC string). Frontend `Result`/`Envelope` types gain `fetched_at`.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_meta_timestamp.py
from app import app
import app as appmod

def test_envelope_includes_fetched_at(monkeypatch):
    monkeypatch.setattr(appmod, "get_quotes", lambda syms: ({}, "mock"))
    with appmod._rl_lock:
        appmod._rl_hits.clear()
    r = app.test_client().get("/api/quotes?syms=AAPL")
    meta = r.get_json()["meta"]
    assert "fetched_at" in meta
    assert "T" in meta["fetched_at"]  # ISO-8601
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && ./.venv/Scripts/python.exe -m pytest tests/test_meta_timestamp.py -v`
Expected: FAIL — `fetched_at` not in meta.

- [ ] **Step 3: Add `fetched_at` to the envelope**

Find `def envelope(` in `backend/app.py`. Add the timestamp to the `meta` dict it builds:

```python
import datetime as _dt  # add at top of app.py if not present
# inside envelope(), where meta is constructed:
        "fetched_at": _dt.datetime.now(_dt.timezone.utc).isoformat(),
```

(Match the existing `meta` construction; keep `source` and `stale` as-is.)

- [ ] **Step 4: Surface it in the frontend types + client**

In `frontend/src/api/types.ts`, add to `Envelope<T>.meta`: `fetched_at: string`. In `frontend/src/api/client.ts`, add `fetchedAt: env.meta.fetched_at` to the `Result<T>` returned by `get`/`send`, and add `fetchedAt: string` to the `Result<T>` interface.

- [ ] **Step 5: Render the timestamp (quotes + F&G)**

Add a small helper in `frontend/src/lib/format.ts`:

```typescript
export function asOf(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return 'as of ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
```

Store the latest quotes `fetchedAt` in the store when `pollQuotes` resolves (add `quotesFetchedAt: string` to the store state, set it in `pollQuotes`). Render `asOf(quotesFetchedAt)` in `KeyStats.tsx` near the panel title (small `COLORS.tx3` text). In `MarketViews.tsx` where the Fear & Greed value renders, capture the `/api/fng` call's `fetchedAt` and render `asOf(...)` beside it.

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd backend && ./.venv/Scripts/python.exe -m pytest tests/test_meta_timestamp.py -v`
Expected: PASS.
Run: `cd frontend && npm run build`
Expected: success.

- [ ] **Step 7: Commit**

```bash
git add backend/app.py frontend/src/api/types.ts frontend/src/api/client.ts frontend/src/lib/format.ts frontend/src/components/KeyStats.tsx frontend/src/views/MarketViews.tsx frontend/src/state/store.ts
git commit -m "feat: add fetched_at meta + 'as of' timestamps for quotes and Fear & Greed (BUG-013/017)"
```

---

### Task 9: Anonymous-state Compare polish (BUG-011)

**Files:**
- Modify: the Compare panel component (find with `grep -rn "No tickers to compare" frontend/src`)
- Test: extend that component's test or add `frontend/src/components/Compare.test.tsx`

**Interfaces:**
- Consumes: `isAuthed` selector + `openAuth('signup')`.
- Produces: the Compare panel, when empty, explains how to add tickers (authed) or prompts sign-in (anon) instead of a bare "No tickers to compare".

- [ ] **Step 1: Find the component and write the failing test**

Run `grep -rn "No tickers to compare" frontend/src` to locate the file (call it `Compare.tsx`). Write:

```tsx
// frontend/src/components/Compare.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from '../state/store'
import { Compare } from './Compare'   // adjust path/name to the real file

describe('Compare empty state', () => {
  beforeEach(() => useStore.setState({ currentUser: null } as any))
  it('prompts sign-in when anonymous', () => {
    render(<Compare />)
    expect(screen.getByText(/sign in|create an account/i)).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm run test -- Compare`
Expected: FAIL — only "No tickers to compare" text present.

- [ ] **Step 3: Improve the empty state**

In the Compare component, replace the bare "No tickers to compare" empty state with a conditional:

```tsx
{compareSyms.length === 0 && (
  isAuthed(useStore.getState())
    ? <p style={{ fontSize: '12.5px', color: COLORS.tx3 }}>Add tickers with the “⊕ Compare” button on any chart to compare them here.</p>
    : <button onClick={() => openAuth('signup')} style={{ /* accent button style, match existing CTAs */ }}>Sign in to compare tickers</button>
)}
```

(Use the component's existing `useStore` selectors for `isAuthed`/`openAuth`; match the accent-button style used elsewhere, e.g. the Settings sign-in CTA.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npm run test -- Compare`
Expected: PASS.
Run: `cd frontend && npm run build`
Expected: success.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/Compare.tsx frontend/src/components/Compare.test.tsx
git commit -m "fix(compare): helpful empty state + sign-in prompt for anon users (BUG-011)"
```

---

### Task 10: Railway cron services + deploy config

**Files:**
- Modify: `Procfile` (document the worker process commands; Railway uses per-service start commands, but keep Procfile authoritative)
- Create: `docs/ops/cron-setup.md`
- Modify: `CHANGELOG.md`, `VERSION`, `frontend/package.json`

**Interfaces:**
- Consumes: `backend/jobs.py` from Task 5.
- Produces: deploy documentation + version bump. (Railway cron services are configured in the Railway dashboard / API, not in repo code — this task documents and verifies, it does not write infra-as-code.)

- [ ] **Step 1: Document the cron setup**

Create `docs/ops/cron-setup.md` with:

```markdown
# Cron jobs (Railway)

Two scheduled jobs run the alert + digest engine. They share the web service's
Docker image and DATABASE_URL/FINNHUB_API_KEY/RESEND_API_KEY/MAIL_FROM env.

## Create in Railway (per job)
1. New service → "Empty service" in the SAME project (so it inherits the shared
   Postgres + variables via reference variables).
2. Set the service's **Start Command**:
   - Alerts (every 5 min):   `python backend/jobs.py check-alerts`
   - Weekly digest (Mon 13:00 UTC): `python backend/jobs.py weekly-digest`
3. Set the service's **Cron Schedule** (Railway → service → Settings → Cron):
   - Alerts:   `*/5 * * * *`
   - Digest:   `0 13 * * 1`
4. Ensure the service references the same variables as the web service
   (DATABASE_URL, FINNHUB_API_KEY, RESEND_API_KEY, MAIL_FROM).

## Verify
- Trigger once manually (Railway → service → Deploy / Run) and check logs for
  `alerts fired: N` / `digests sent: N`.
- Locally: `cd backend && python jobs.py check-alerts` (uses local DATABASE_URL).
```

- [ ] **Step 2: Add the worker lines to the Procfile (documentation/authority)**

Append to `Procfile`:

```
alerts: python backend/jobs.py check-alerts
digest: python backend/jobs.py weekly-digest
```

- [ ] **Step 3: Local smoke test of the entrypoint**

Run: `cd backend && ./.venv/Scripts/python.exe jobs.py check-alerts`
Expected: exits 0, logs `alerts fired: 0` (no armed alerts locally, or sends if seeded). No traceback.

- [ ] **Step 4: Roll version + changelog**

Set `VERSION` to `1.5.0`; bump `frontend/package.json` version to `1.5.0`. Add a `## [1.5.0]` CHANGELOG entry summarizing: email price alerts, weekly digest, alert arming UI, news-link fix, as-of timestamps, Compare polish.

- [ ] **Step 5: Commit**

```bash
git add Procfile docs/ops/cron-setup.md CHANGELOG.md VERSION frontend/package.json
git commit -m "chore(ops): cron setup docs + worker procs; roll v1.5.0"
```

---

### Task 11: Launch-gate setup guide (Resend domain + Google OAuth)

**Files:**
- Create: `docs/ops/launch-gates.md`

**Interfaces:**
- Consumes: existing env var names: `RESEND_API_KEY`, `MAIL_FROM`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APP_BASE_URL`.
- Produces: a checklist the owner follows in the Resend + Google Cloud dashboards. (No code — these are human-only external steps.)

- [ ] **Step 1: Write the guide**

Create `docs/ops/launch-gates.md` documenting, with exact steps:

1. **Resend domain verification** — add `tickertracker.info` (or chosen sending domain) in Resend → Domains; add the printed DKIM/SPF/DMARC DNS records at the domain registrar; wait for "Verified"; set Railway `MAIL_FROM` to `alerts@<verified-domain>` (or similar). Until verified, email only delivers to the account owner (sandbox).
2. **Google OAuth** — Google Cloud Console → APIs & Services → Credentials → OAuth client (Web); authorized redirect URI = `https://tickertracker.info/api/auth/google/callback` (confirm the exact callback path from `backend/auth/google.py`); copy Client ID/Secret into Railway `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`; confirm `APP_BASE_URL=https://tickertracker.info`.
3. **Rotate** the secrets that were pasted in chat (Finnhub key, Railway tokens, Resend key) and update Railway variables.

Before writing the callback path in step 2, verify it: `grep -rn "callback\|redirect_uri\|/google" backend/auth/google.py`.

- [ ] **Step 2: Commit**

```bash
git add docs/ops/launch-gates.md
git commit -m "docs(ops): launch-gate setup guide (Resend domain, Google OAuth, secret rotation)"
```

---

## Final Verification (after all tasks)

- [ ] `cd backend && ./.venv/Scripts/python.exe -m pytest -q` — all green (≈ 87 + new ~17).
- [ ] `cd frontend && npm run build && npm run test` — build clean, vitest green.
- [ ] Deploy web service (v1.5.0) to Railway and confirm `/api/health` 200 + `/api/news?sym=AAPL` items all have non-API `url`s + `/api/quotes` meta has `fetched_at`.
- [ ] Create the two Railway cron services per `docs/ops/cron-setup.md`; manually trigger `check-alerts` and confirm logs.
- [ ] Hand the owner `docs/ops/launch-gates.md`.
