# Multiple Watchlists + Branded PNG Sharing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let premium users organize tickers into multiple named, draggable watchlists with per-list sharing (read-only link + branded PNG download); free users get one list capped at 10 active tickers.

**Architecture:** Add a `Watchlist` parent table and a `watchlist_id` FK on `WatchlistItem`; keep the existing flat `/api/watchlist` alive as a read-only deduped "union" so Dashboard/alerts/digest/sentiment are untouched. A single `allowance()` predicate encodes all free-vs-premium rules (1 list / 10 active for free; unlimited for premium); locked-ness is computed, never stored. Frontend gains a `watchlists` board (dnd-kit) and derives the old flat `watchlist` from it. PNG is rendered client-side (`html-to-image`) from a branded `<ShareCard>`.

**Tech Stack:** Flask + SQLAlchemy + Postgres/SQLite (backend); React 19 + Zustand + Vite (frontend); `@dnd-kit/core` + `@dnd-kit/sortable`, `html-to-image`, `qrcode` (new frontend deps); pytest + vitest.

## Global Constraints

- Schema changes ship via **`backend/db.py::_ensure_columns`** (idempotent, runs at every boot) AND a matching Alembic file under `backend/migrations/versions/`. `create_all` builds new tables but never ALTERs existing ones — the runtime path is `_ensure_columns`.
- Support **both SQLite and Postgres** in every raw-SQL migration step (SQLite lacks `ADD COLUMN IF NOT EXISTS`; use PRAGMA inspection, mirroring existing code in `_ensure_columns`).
- All `/api` mutating routes are **auth-scoped**: copy the existing `uid = _require_user(); if uid is None: return envelope({"error": "authentication required"}), 401` guard.
- Response shape is always the **envelope**: `envelope(data, source="db")`. Errors: `return envelope({"error": "..."}), <status>`.
- Premium gating returns **`402`** with `{"error": "free_limit"}` or `{"error": "premium_required"}`; deleting the last list returns **`409`** `{"error": "last_list"}`.
- Symbol validation uses the existing `valid_symbol()` / `_SYMBOL_RE` (`^[A-Z0-9.\-]{1,12}$`).
- **No `Co-Authored-By:` trailers** in commits (user global rule).
- Brand copy on the PNG: exactly `Made with TickerTracker · tickertracker.info`.
- Free tier: **1 list, 10 active tickers**. Active = `position 0–9` within the user's single list. Locked items are excluded from the union, quotes, alerts, digest, sentiment, dashboard.
- Work on a feature branch `feat/multiple-watchlists`, not `main`.

---

## File Structure

**Backend**
- `backend/models.py` — add `User.plan`; add `Watchlist` model; add `WatchlistItem.watchlist_id`.
- `backend/db.py` — extend `_ensure_columns` to create `watchlists`, add `watchlist_id` + `plan`, backfill default lists.
- `backend/services/premium.py` *(new)* — `is_premium(user)`, `require_premium(uid)`, `allowance(...)`.
- `backend/services/watchlists.py` *(new)* — list CRUD, item add/move/reorder, locked computation, union.
- `backend/services/store.py` — `get_watchlist()` becomes union of active items; `add_watch/update_watch/remove_watch` delegate to primary list.
- `backend/services/share.py` — per-list tokens; resolve returns list name + owner + items.
- `backend/auth/routes.py` — `_public_user` exposes `plan`.
- `backend/app.py` — new `/api/watchlists*` routes; share routes already exist (kept).
- `backend/migrations/versions/cc01_multi_watchlist.py` *(new)* — Alembic mirror.
- `backend/tests/test_premium.py`, `test_watchlists_service.py`, `test_watchlists_api.py`, `test_watchlist_migration.py` *(new)*.

**Frontend**
- `frontend/src/api/types.ts` — `Watchlist`, `WatchlistWithItems`, plan on `AuthUser`.
- `frontend/src/api/client.ts` — list/item/share methods.
- `frontend/src/state/watchlistReducers.ts` *(new)* — pure reorder/move helpers.
- `frontend/src/state/store.ts` — `watchlists` state, load, derive flat `watchlist`, actions.
- `frontend/src/views/ManageWatchlist.tsx` — board of dnd-kit list cards.
- `frontend/src/components/ShareCard.tsx` *(new)* — branded off-screen PNG source.
- `frontend/src/state/watchlistReducers.test.ts`, `ManageWatchlist` store tests *(new)*.

---

## Task 1: Premium primitive (`User.plan` + helpers)

**Files:**
- Modify: `backend/models.py:7-15` (User)
- Modify: `backend/auth/routes.py:17-19` (`_public_user`)
- Create: `backend/services/premium.py`
- Create: `backend/tests/test_premium.py`

**Interfaces:**
- Produces: `models.User.plan` (str, `'free'|'premium'`, default `'free'`); `premium.is_premium(user) -> bool`; `premium.PLAN_FREE='free'`, `premium.PLAN_PREMIUM='premium'`.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_premium.py
import os
os.environ.setdefault("DATABASE_URL", "sqlite://")
import db, models
from services import premium


def _fresh():
    models.Base.metadata.drop_all(db.engine)
    models.Base.metadata.create_all(db.engine)


def test_default_plan_is_free_and_not_premium():
    _fresh()
    with db.get_session() as s:
        u = models.User(email="a@b.com", name="A")
        s.add(u); s.commit()
        assert u.plan == "free"
        assert premium.is_premium(u) is False


def test_premium_flag_detected():
    _fresh()
    with db.get_session() as s:
        u = models.User(email="p@b.com", name="P", plan="premium")
        s.add(u); s.commit()
        assert premium.is_premium(u) is True
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_premium.py -v`
Expected: FAIL — `AttributeError: ... 'plan'` (column not defined) or ImportError for `services.premium`.

- [ ] **Step 3: Add the column and helper**

In `backend/models.py`, add to `User` (after `email_verified` line 15):

```python
    plan = Column(String, default="free")  # 'free' | 'premium'
```

Create `backend/services/premium.py`:

```python
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/test_premium.py -v`
Expected: PASS (both tests).

- [ ] **Step 5: Expose plan on the auth user serialization**

In `backend/auth/routes.py`, update `_public_user` (lines 17-19):

```python
def _public_user(u):
    return {"id": u.id, "email": u.email, "name": u.name or "",
            "email_verified": bool(u.email_verified),
            "plan": getattr(u, "plan", "free") or "free"}
```

- [ ] **Step 6: Commit**

```bash
git add backend/models.py backend/services/premium.py backend/auth/routes.py backend/tests/test_premium.py
git commit -m "feat(premium): add User.plan flag + is_premium helper; expose plan on /api/auth/me"
```

---

## Task 2: `Watchlist` model + `watchlist_id` column + runtime migration/backfill

**Files:**
- Modify: `backend/models.py` (add `Watchlist`, add `WatchlistItem.watchlist_id`)
- Modify: `backend/db.py` (`_ensure_columns`)
- Create: `backend/tests/test_watchlist_migration.py`

**Interfaces:**
- Produces: `models.Watchlist(id, user_id, name, position, share_token, created_at)`; `models.WatchlistItem.watchlist_id` (FK→watchlists.id). After `db.init_db()` on a pre-migration DB, every user with items has exactly one `Watchlist` named `"My Watchlist"` owning all their items at preserved positions, with any legacy `Settings.share_token` carried onto the list.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_watchlist_migration.py
import os
os.environ.setdefault("DATABASE_URL", "sqlite://")
from sqlalchemy import text
import db, models


def test_migration_creates_default_list_and_backfills():
    models.Base.metadata.drop_all(db.engine)
    with db.engine.begin() as c:
        c.execute(text("CREATE TABLE users (id INTEGER PRIMARY KEY, email VARCHAR, name VARCHAR, plan VARCHAR DEFAULT 'free', email_verified BOOLEAN DEFAULT 0, password_hash VARCHAR, phone VARCHAR, created_at DATETIME)"))
        c.execute(text("CREATE TABLE settings (user_id INTEGER PRIMARY KEY, share_token VARCHAR, unsub_token VARCHAR)"))
        c.execute(text("CREATE TABLE watchlist_items (id INTEGER PRIMARY KEY, user_id INTEGER, symbol VARCHAR, position INTEGER DEFAULT 0)"))
        c.execute(text("INSERT INTO users (id, email, name) VALUES (1, 'u@x.com', 'U')"))
        c.execute(text("INSERT INTO settings (user_id, share_token) VALUES (1, 'legacytoken')"))
        for i, sym in enumerate(["NVDA", "AAPL", "MSFT"]):
            c.execute(text("INSERT INTO watchlist_items (user_id, symbol, position) VALUES (1, :s, :p)"), {"s": sym, "p": i})

    db.init_db()  # should create watchlists table, add watchlist_id, backfill

    with db.get_session() as s:
        lists = s.query(models.Watchlist).filter_by(user_id=1).all()
        assert len(lists) == 1
        wl = lists[0]
        assert wl.name == "My Watchlist"
        assert wl.share_token == "legacytoken"
        items = s.query(models.WatchlistItem).filter_by(user_id=1).order_by(models.WatchlistItem.position).all()
        assert [it.symbol for it in items] == ["NVDA", "AAPL", "MSFT"]
        assert all(it.watchlist_id == wl.id for it in items)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_watchlist_migration.py -v`
Expected: FAIL — no `watchlists` table / `Watchlist` model not defined.

- [ ] **Step 3: Add the model + column**

In `backend/models.py`, add `watchlist_id` to `WatchlistItem` (after `user_id`, line 21):

```python
    watchlist_id = Column(Integer, ForeignKey("watchlists.id"), nullable=True, index=True)
```

Add a new model (place after `WatchlistItem`):

```python
class Watchlist(Base):
    __tablename__ = "watchlists"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String, nullable=False, default="My Watchlist")
    position = Column(Integer, default=0)
    share_token = Column(String, nullable=True, index=True)
    created_at = Column(DateTime, server_default=func.now())
```

- [ ] **Step 4: Add the runtime migration/backfill to `_ensure_columns`**

In `backend/db.py`, inside `_ensure_columns(conn)`, append this block at the end of the function (works for both engines; `create_all` in `init_db` already created the `watchlists` table before `_ensure_columns` runs, so we only add the column + backfill):

```python
    # ── Multiple watchlists: add watchlist_items.watchlist_id, backfill a
    # default "My Watchlist" per user, and carry legacy settings.share_token
    # onto it. Idempotent: the backfill only runs for items lacking a list.
    if _is_sqlite:
        rows = conn.execute(text("PRAGMA table_info(watchlist_items)")).fetchall()
        if "watchlist_id" not in {r[1] for r in rows}:
            conn.execute(text("ALTER TABLE watchlist_items ADD COLUMN watchlist_id INTEGER"))
        ucols = conn.execute(text("PRAGMA table_info(users)")).fetchall()
        if "plan" not in {r[1] for r in ucols}:
            conn.execute(text("ALTER TABLE users ADD COLUMN plan VARCHAR DEFAULT 'free'"))
    else:
        conn.execute(text("ALTER TABLE watchlist_items ADD COLUMN IF NOT EXISTS watchlist_id INTEGER"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS plan VARCHAR DEFAULT 'free'"))

    # Backfill: every user that has items but no list gets one default list.
    user_ids = [r[0] for r in conn.execute(text(
        "SELECT DISTINCT user_id FROM watchlist_items WHERE watchlist_id IS NULL"
    )).fetchall()]
    for uid in user_ids:
        legacy_token = conn.execute(text(
            "SELECT share_token FROM settings WHERE user_id = :u"), {"u": uid}).scalar()
        conn.execute(text(
            "INSERT INTO watchlists (user_id, name, position, share_token) "
            "VALUES (:u, 'My Watchlist', 0, :tok)"), {"u": uid, "tok": legacy_token})
        new_id = conn.execute(text(
            "SELECT id FROM watchlists WHERE user_id = :u ORDER BY id DESC LIMIT 1"),
            {"u": uid}).scalar()
        conn.execute(text(
            "UPDATE watchlist_items SET watchlist_id = :w WHERE user_id = :u AND watchlist_id IS NULL"),
            {"w": new_id, "u": uid})
```

Note: `init_db()` calls `Base.metadata.create_all(engine)` (which creates the `watchlists` table) BEFORE the `_ensure_columns` block runs, so `INSERT INTO watchlists` is valid. Confirm ordering in `db.py:130` then `db.py:141`.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/test_watchlist_migration.py -v`
Expected: PASS.

- [ ] **Step 6: Run the full backend suite (no regressions)**

Run: `cd backend && python -m pytest -q`
Expected: all prior tests still pass.

- [ ] **Step 7: Commit**

```bash
git add backend/models.py backend/db.py backend/tests/test_watchlist_migration.py
git commit -m "feat(watchlists): Watchlist model + watchlist_id column + idempotent backfill migration"
```

---

## Task 3: Watchlists service (CRUD, items, allowance, locked, union)

**Files:**
- Create: `backend/services/watchlists.py`
- Create: `backend/tests/test_watchlists_service.py`

**Interfaces:**
- Consumes: `premium.is_premium_uid`, `premium.FREE_MAX_LISTS`, `premium.FREE_MAX_ACTIVE_ITEMS`.
- Produces (all raise `PremiumRequired` / `FreeLimit` / `LastList` on violation; caller maps to HTTP):
  - `get_or_create_primary_list(uid) -> int` (list id)
  - `list_watchlists(uid) -> list[dict]` — each `{id, name, position, share_token, items:[item_dict...]}`, `item_dict` adds `locked: bool`
  - `create_watchlist(uid, name) -> dict`
  - `rename_or_move_list(uid, list_id, name=None, position=None) -> dict | None`
  - `delete_watchlist(uid, list_id) -> bool`
  - `add_item(uid, list_id, symbol, target=0, alert_price=0, alert_dir="above") -> dict`
  - `update_item(uid, list_id, symbol, **fields) -> dict | None`
  - `remove_item(uid, list_id, symbol) -> bool`
  - `active_symbols(uid) -> list[str]` — deduped union of non-locked symbols (used by `store.get_watchlist`)
  - Exceptions: `class PremiumRequired(Exception)`, `class FreeLimit(Exception)`, `class LastList(Exception)`

- [ ] **Step 1: Write the failing tests**

```python
# backend/tests/test_watchlists_service.py
import os
os.environ.setdefault("DATABASE_URL", "sqlite://")
import pytest
import db, models
from services import watchlists as wl


def _fresh_user(plan="free"):
    models.Base.metadata.drop_all(db.engine)
    models.Base.metadata.create_all(db.engine)
    with db.get_session() as s:
        u = models.User(email="u@x.com", name="U", plan=plan)
        s.add(u); s.commit()
        return u.id


def test_primary_list_created_lazily():
    uid = _fresh_user()
    lid = wl.get_or_create_primary_list(uid)
    assert isinstance(lid, int)
    # idempotent
    assert wl.get_or_create_primary_list(uid) == lid


def test_free_user_cannot_create_second_list():
    uid = _fresh_user("free")
    wl.get_or_create_primary_list(uid)
    with pytest.raises(wl.PremiumRequired):
        wl.create_watchlist(uid, "Prospective")


def test_premium_user_can_create_many_lists():
    uid = _fresh_user("premium")
    wl.get_or_create_primary_list(uid)
    a = wl.create_watchlist(uid, "Tech")
    b = wl.create_watchlist(uid, "Crypto")
    assert a["name"] == "Tech" and b["name"] == "Crypto"
    assert len(wl.list_watchlists(uid)) == 3


def test_free_user_capped_at_10_active_items():
    uid = _fresh_user("free")
    lid = wl.get_or_create_primary_list(uid)
    for i in range(10):
        wl.add_item(uid, lid, f"AA{i}")
    with pytest.raises(wl.FreeLimit):
        wl.add_item(uid, lid, "OVER")


def test_locked_flag_and_active_symbols_exclude_overflow():
    uid = _fresh_user("premium")  # create 12 then downgrade to test locking
    lid = wl.get_or_create_primary_list(uid)
    for i in range(12):
        wl.add_item(uid, lid, f"S{i}")
    with db.get_session() as s:
        s.get(models.User, uid).plan = "free"; s.commit()
    lists = wl.list_watchlists(uid)
    items = lists[0]["items"]
    assert sum(1 for it in items if it["locked"]) == 2
    assert len(wl.active_symbols(uid)) == 10


def test_cannot_delete_last_list():
    uid = _fresh_user("premium")
    wl.get_or_create_primary_list(uid)
    with pytest.raises(wl.LastList):
        only = wl.list_watchlists(uid)[0]
        wl.delete_watchlist(uid, only["id"])


def test_move_item_between_lists():
    uid = _fresh_user("premium")
    a = wl.get_or_create_primary_list(uid)
    b = wl.create_watchlist(uid, "B")["id"]
    wl.add_item(uid, a, "NVDA")
    moved = wl.update_item(uid, a, "NVDA", watchlist_id=b)
    assert moved["watchlist_id"] == b
    assert "NVDA" not in [i["symbol"] for i in wl.list_watchlists(uid)[0]["items"] if wl.list_watchlists(uid)[0]["id"] == a]
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_watchlists_service.py -v`
Expected: FAIL — `services.watchlists` missing.

- [ ] **Step 3: Implement the service**

Create `backend/services/watchlists.py`:

```python
"""List-aware watchlist service. All free-vs-premium enforcement lives here so
routes stay thin. Locked-ness (free overflow beyond 10 active) is computed."""
import db
import models
from services import premium


class PremiumRequired(Exception):
    pass


class FreeLimit(Exception):
    pass


class LastList(Exception):
    pass


def _item_dict(it, locked=False):
    return {"symbol": it.symbol, "position": it.position, "target": it.target,
            "alert_price": it.alert_price, "alert_dir": it.alert_dir,
            "alert_active": bool(it.alert_active), "watchlist_id": it.watchlist_id,
            "locked": locked}


def get_or_create_primary_list(uid: int) -> int:
    with db.get_session() as s:
        wl = (s.query(models.Watchlist).filter_by(user_id=uid)
              .order_by(models.Watchlist.position, models.Watchlist.id).first())
        if wl is None:
            wl = models.Watchlist(user_id=uid, name="My Watchlist", position=0)
            s.add(wl); s.commit()
        return wl.id


def _ordered_lists(s, uid):
    return (s.query(models.Watchlist).filter_by(user_id=uid)
            .order_by(models.Watchlist.position, models.Watchlist.id).all())


def list_watchlists(uid: int) -> list[dict]:
    get_or_create_primary_list(uid)
    premium_user = premium.is_premium_uid(uid)
    out = []
    with db.get_session() as s:
        for wl in _ordered_lists(s, uid):
            items = (s.query(models.WatchlistItem)
                     .filter_by(user_id=uid, watchlist_id=wl.id)
                     .order_by(models.WatchlistItem.position).all())
            dicts = []
            for idx, it in enumerate(items):
                locked = (not premium_user) and idx >= premium.FREE_MAX_ACTIVE_ITEMS
                dicts.append(_item_dict(it, locked=locked))
            out.append({"id": wl.id, "name": wl.name, "position": wl.position,
                        "share_token": wl.share_token, "items": dicts})
    return out


def create_watchlist(uid: int, name: str) -> dict:
    if not premium.is_premium_uid(uid):
        # free users are limited to FREE_MAX_LISTS
        with db.get_session() as s:
            count = s.query(models.Watchlist).filter_by(user_id=uid).count()
        if count >= premium.FREE_MAX_LISTS:
            raise PremiumRequired()
    with db.get_session() as s:
        pos = s.query(models.Watchlist).filter_by(user_id=uid).count()
        wl = models.Watchlist(user_id=uid, name=(name or "Untitled").strip()[:60], position=pos)
        s.add(wl); s.commit()
        return {"id": wl.id, "name": wl.name, "position": wl.position,
                "share_token": wl.share_token, "items": []}


def _owned(s, uid, list_id):
    return s.query(models.Watchlist).filter_by(id=list_id, user_id=uid).first()


def rename_or_move_list(uid, list_id, name=None, position=None):
    with db.get_session() as s:
        wl = _owned(s, uid, list_id)
        if not wl:
            return None
        if name is not None:
            wl.name = name.strip()[:60] or wl.name
        if position is not None:
            wl.position = int(position)
        s.commit()
        return {"id": wl.id, "name": wl.name, "position": wl.position,
                "share_token": wl.share_token}


def delete_watchlist(uid, list_id) -> bool:
    with db.get_session() as s:
        if s.query(models.Watchlist).filter_by(user_id=uid).count() <= 1:
            raise LastList()
        wl = _owned(s, uid, list_id)
        if not wl:
            return False
        s.query(models.WatchlistItem).filter_by(user_id=uid, watchlist_id=list_id).delete()
        s.delete(wl); s.commit()
        return True


def add_item(uid, list_id, symbol, target=0, alert_price=0, alert_dir="above") -> dict:
    symbol = symbol.upper()
    with db.get_session() as s:
        wl = _owned(s, uid, list_id)
        if not wl:
            raise ValueError("list not found")
        existing = s.query(models.WatchlistItem).filter_by(
            user_id=uid, watchlist_id=list_id, symbol=symbol).first()
        if existing:
            existing.target = target
            existing.alert_price = alert_price
            existing.alert_dir = alert_dir
            s.commit()
            return _item_dict(existing)
        # Free cap: count ACTIVE items in this user's single list.
        if not premium.is_premium_uid(uid):
            count = s.query(models.WatchlistItem).filter_by(user_id=uid, watchlist_id=list_id).count()
            if count >= premium.FREE_MAX_ACTIVE_ITEMS:
                raise FreeLimit()
        pos = s.query(models.WatchlistItem).filter_by(user_id=uid, watchlist_id=list_id).count()
        it = models.WatchlistItem(user_id=uid, watchlist_id=list_id, symbol=symbol,
                                  position=pos, target=target, alert_price=alert_price,
                                  alert_dir=alert_dir)
        s.add(it); s.commit()
        return _item_dict(it)


def update_item(uid, list_id, symbol, **fields):
    symbol = symbol.upper()
    allowed = {"target", "alert_price", "alert_dir", "alert_active", "position", "watchlist_id"}
    with db.get_session() as s:
        it = s.query(models.WatchlistItem).filter_by(
            user_id=uid, watchlist_id=list_id, symbol=symbol).first()
        if not it:
            return None
        for k, v in fields.items():
            if k in allowed and v is not None:
                if k == "watchlist_id" and not _owned(s, uid, int(v)):
                    continue  # never move into a list you don't own
                setattr(it, k, v)
        s.commit()
        return _item_dict(it)


def remove_item(uid, list_id, symbol) -> bool:
    symbol = symbol.upper()
    with db.get_session() as s:
        it = s.query(models.WatchlistItem).filter_by(
            user_id=uid, watchlist_id=list_id, symbol=symbol).first()
        if not it:
            return False
        s.delete(it); s.commit()
        return True


def active_symbols(uid: int) -> list[str]:
    """Deduped union of non-locked symbols across all the user's lists."""
    seen, out = set(), []
    for lst in list_watchlists(uid):
        for it in lst["items"]:
            if it["locked"]:
                continue
            if it["symbol"] not in seen:
                seen.add(it["symbol"]); out.append(it["symbol"])
    return out
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_watchlists_service.py -v`
Expected: PASS (all).

- [ ] **Step 5: Commit**

```bash
git add backend/services/watchlists.py backend/tests/test_watchlists_service.py
git commit -m "feat(watchlists): list-aware service with allowance, locking, union, move"
```

---

## Task 4: Refactor `store.py` to delegate to lists + union

**Files:**
- Modify: `backend/services/store.py:6-62` (watchlist functions)
- Create: `backend/tests/test_store_union.py`

**Interfaces:**
- Consumes: `watchlists.active_symbols`, `watchlists.get_or_create_primary_list`, `watchlists.add_item`, `watchlists.update_item`, `watchlists.remove_item`.
- Produces (unchanged signatures): `get_watchlist() -> list[dict]` now returns active union (deduped, ordered); `add_watch/update_watch/remove_watch` operate on the primary list. Each dict keeps the original keys (`symbol, position, target, alert_price, alert_dir, alert_active`).

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_store_union.py
import os
os.environ.setdefault("DATABASE_URL", "sqlite://")
from unittest.mock import patch
import db, models
from services import store, watchlists


def _fresh_user(plan="premium"):
    models.Base.metadata.drop_all(db.engine)
    models.Base.metadata.create_all(db.engine)
    with db.get_session() as s:
        u = models.User(email="u@x.com", name="U", plan=plan)
        s.add(u); s.commit()
        return u.id


def test_get_watchlist_returns_union_excluding_locked():
    uid = _fresh_user("free")
    lid = watchlists.get_or_create_primary_list(uid)
    for i in range(12):
        with db.get_session() as s:
            s.add(models.WatchlistItem(user_id=uid, watchlist_id=lid, symbol=f"S{i}", position=i)); s.commit()
    with patch("services.store.current_user_id", return_value=uid):
        syms = [w["symbol"] for w in store.get_watchlist()]
    assert len(syms) == 10  # locked overflow excluded
    assert "S10" not in syms


def test_add_watch_targets_primary_list():
    uid = _fresh_user("premium")
    with patch("services.store.current_user_id", return_value=uid):
        store.add_watch("NVDA", target=200)
        syms = [w["symbol"] for w in store.get_watchlist()]
    assert "NVDA" in syms
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_store_union.py -v`
Expected: FAIL — old `get_watchlist` ignores lists / locking.

- [ ] **Step 3: Refactor the store functions**

In `backend/services/store.py`, replace the four watchlist functions (lines 6-62) with delegations. Keep `_wl_dict` for shape but source from the service:

```python
from services import watchlists as _wl


def get_watchlist():
    uid = current_user_id()
    # Active union across all lists (deduped, ordered). Locked overflow excluded.
    rows = []
    for lst in _wl.list_watchlists(uid):
        for it in lst["items"]:
            if not it["locked"]:
                rows.append(it)
    # de-dupe by symbol, renumber position for the flat consumer
    seen, out = set(), []
    for i, it in enumerate(rows):
        if it["symbol"] in seen:
            continue
        seen.add(it["symbol"])
        out.append({"symbol": it["symbol"], "position": len(out), "target": it["target"],
                    "alert_price": it["alert_price"], "alert_dir": it["alert_dir"],
                    "alert_active": bool(it["alert_active"])})
    return out


def add_watch(symbol, target=0, alert_price=0, alert_dir="above"):
    uid = current_user_id()
    lid = _wl.get_or_create_primary_list(uid)
    it = _wl.add_item(uid, lid, symbol, target=target, alert_price=alert_price, alert_dir=alert_dir)
    return {"symbol": it["symbol"], "position": it["position"], "target": it["target"],
            "alert_price": it["alert_price"], "alert_dir": it["alert_dir"],
            "alert_active": bool(it["alert_active"])}


def update_watch(symbol, **fields):
    uid = current_user_id()
    lid = _wl.get_or_create_primary_list(uid)
    it = _wl.update_item(uid, lid, symbol, **fields)
    if it is None:
        return None
    return {"symbol": it["symbol"], "position": it["position"], "target": it["target"],
            "alert_price": it["alert_price"], "alert_dir": it["alert_dir"],
            "alert_active": bool(it["alert_active"])}


def remove_watch(symbol):
    uid = current_user_id()
    lid = _wl.get_or_create_primary_list(uid)
    return _wl.remove_item(uid, lid, symbol)
```

Keep the existing `_wl_dict` import/helper only if still referenced; otherwise remove it to avoid a dead function. (Holdings/settings functions below are unchanged.)

Note: `add_watch` raises `FreeLimit`/`PremiumRequired` from the service. The `/api/watchlist` POST route (Task 6) must catch these and map to 402.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_store_union.py tests/test_store.py tests/test_store_routes.py -v`
Expected: PASS. Fix any old store test that assumed flat behavior by updating it to create a primary list first.

- [ ] **Step 5: Verify alerts/digest still read the union**

Run: `cd backend && python -m pytest tests/test_alerts_service.py tests/test_alert_api.py -q`
Expected: PASS (they consume `get_watchlist`/symbols which now exclude locked items — desired).

- [ ] **Step 6: Commit**

```bash
git add backend/services/store.py backend/tests/test_store_union.py
git commit -m "refactor(store): watchlist functions delegate to list service; get_watchlist returns active union"
```

---

## Task 5: Per-list sharing

**Files:**
- Modify: `backend/services/share.py`
- Modify: `backend/tests/test_share.py`

**Interfaces:**
- Produces: `create_share(user_id, list_id=None) -> str` (token for that list; default = primary list); `resolve_share(token) -> {owner_name, list_name, items:[{symbol}]} | None`. Legacy `Settings.share_token` carried onto the primary list in Task 2 still resolves (it now lives on the list row).

- [ ] **Step 1: Write/adjust the failing test**

```python
# add to backend/tests/test_share.py
import os
os.environ.setdefault("DATABASE_URL", "sqlite://")
import db, models
from services import share, watchlists


def _fresh_premium():
    models.Base.metadata.drop_all(db.engine)
    models.Base.metadata.create_all(db.engine)
    with db.get_session() as s:
        u = models.User(email="o@x.com", name="Owner", plan="premium")
        s.add(u); s.commit()
        return u.id


def test_per_list_share_resolves_with_name():
    uid = _fresh_premium()
    a = watchlists.get_or_create_primary_list(uid)
    watchlists.rename_or_move_list(uid, a, name="Tech Only")
    watchlists.add_item(uid, a, "NVDA")
    token = share.create_share(uid, a)
    res = share.resolve_share(token)
    assert res["owner_name"] == "Owner"
    assert res["list_name"] == "Tech Only"
    assert [i["symbol"] for i in res["items"]] == ["NVDA"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_share.py::test_per_list_share_resolves_with_name -v`
Expected: FAIL — `create_share` takes only `user_id`; `list_name` missing.

- [ ] **Step 3: Rewrite `share.py`**

```python
"""Share service: per-list read-only shareable tokens + PNG-source data."""
import secrets
import db
import models
from services import watchlists


def create_share(user_id: int, list_id: int | None = None) -> str:
    if list_id is None:
        list_id = watchlists.get_or_create_primary_list(user_id)
    with db.get_session() as s:
        wl = s.query(models.Watchlist).filter_by(id=list_id, user_id=user_id).first()
        if wl is None:
            wl = s.query(models.Watchlist).filter_by(user_id=user_id).first()
        if not wl.share_token:
            wl.share_token = secrets.token_urlsafe(12)
        s.commit()
        return wl.share_token


def resolve_share(token: str) -> dict | None:
    with db.get_session() as s:
        wl = s.query(models.Watchlist).filter_by(share_token=token).first()
        if not wl:
            return None
        user = s.get(models.User, wl.user_id)
        items = (s.query(models.WatchlistItem)
                 .filter_by(user_id=wl.user_id, watchlist_id=wl.id)
                 .order_by(models.WatchlistItem.position).all())
        owner_name = (user.name if user else "") or "A Ticker Tracker user"
        return {"owner_name": owner_name, "list_name": wl.name,
                "items": [{"symbol": w.symbol} for w in items]}
```

Remove the old `_seed_user_with_watchlist` helper; update any test that imported it to use `watchlists` helpers instead.

- [ ] **Step 4: Run share tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_share.py -v`
Expected: PASS. Adjust legacy assertions (no `list_name` previously) to include it.

- [ ] **Step 5: Commit**

```bash
git add backend/services/share.py backend/tests/test_share.py
git commit -m "feat(share): per-list share tokens; resolve returns list name"
```

---

## Task 6: API routes for watchlists + plan/402 wiring

**Files:**
- Modify: `backend/app.py` (add routes; wrap `/api/watchlist` POST for 402; pass list_id to share)
- Create: `backend/tests/test_watchlists_api.py`

**Interfaces:**
- Consumes: `services.watchlists` (all functions + exceptions), `services.share.create_share(uid, list_id)`.
- Produces routes: `GET/POST /api/watchlists`, `PATCH/DELETE /api/watchlists/<int:list_id>`, `POST /api/watchlists/<int:list_id>/items`, `PATCH/DELETE /api/watchlists/<int:list_id>/items/<sym>`, `POST /api/watchlists/<int:list_id>/share`.

- [ ] **Step 1: Write the failing tests**

```python
# backend/tests/test_watchlists_api.py
import os
os.environ.setdefault("DATABASE_URL", "sqlite://")
import json
import pytest
import db, models
from app import app


@pytest.fixture
def client():
    models.Base.metadata.drop_all(db.engine)
    models.Base.metadata.create_all(db.engine)
    with db.get_session() as s:
        for email, plan in [("free@x.com", "free"), ("prem@x.com", "premium")]:
            s.add(models.User(email=email, name=email.split("@")[0], plan=plan, email_verified=True))
        s.commit()
    app.config["TESTING"] = True
    return app.test_client()


def _login(client, email):
    with db.get_session() as s:
        uid = s.query(models.User).filter_by(email=email).first().id
    with client.session_transaction() as sess:
        sess["_user_id"] = str(uid)
    return uid


def test_free_user_blocked_creating_second_list(client):
    _login(client, "free@x.com")
    client.get("/api/watchlists")  # lazily creates primary
    r = client.post("/api/watchlists", json={"name": "Prospective"})
    assert r.status_code == 402
    assert r.get_json()["data"]["error"] == "premium_required"


def test_premium_user_creates_list(client):
    _login(client, "prem@x.com")
    client.get("/api/watchlists")
    r = client.post("/api/watchlists", json={"name": "Tech Only"})
    assert r.status_code == 200
    assert r.get_json()["data"]["name"] == "Tech Only"


def test_free_user_11th_item_blocked(client):
    _login(client, "free@x.com")
    lid = client.get("/api/watchlists").get_json()["data"][0]["id"]
    for i in range(10):
        assert client.post(f"/api/watchlists/{lid}/items", json={"symbol": f"AA{i}"}).status_code == 200
    r = client.post(f"/api/watchlists/{lid}/items", json={"symbol": "OVER"})
    assert r.status_code == 402
    assert r.get_json()["data"]["error"] == "free_limit"


def test_cannot_delete_last_list(client):
    _login(client, "prem@x.com")
    lid = client.get("/api/watchlists").get_json()["data"][0]["id"]
    r = client.delete(f"/api/watchlists/{lid}")
    assert r.status_code == 409
    assert r.get_json()["data"]["error"] == "last_list"


def test_auth_scoping_other_users_list(client):
    _login(client, "prem@x.com")
    lid = client.get("/api/watchlists").get_json()["data"][0]["id"]
    _login(client, "free@x.com")  # switch user
    r = client.patch(f"/api/watchlists/{lid}", json={"name": "hax"})
    assert r.status_code in (403, 404)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_watchlists_api.py -v`
Expected: FAIL — routes don't exist (404).

- [ ] **Step 3: Add routes to `app.py`**

Add this import near the other service imports (around line 235):

```python
from services import watchlists as _wls
```

Add these routes (place after the existing `/api/watchlist/<sym>` DELETE route, before settings):

```python
@app.route("/api/watchlists", methods=["GET"])
def watchlists_get():
    uid = _require_user()
    if uid is None:
        return envelope({"error": "authentication required"}), 401
    return envelope(_wls.list_watchlists(uid), source="db")


@app.route("/api/watchlists", methods=["POST"])
def watchlists_post():
    uid = _require_user()
    if uid is None:
        return envelope({"error": "authentication required"}), 401
    b = request.get_json(force=True) or {}
    name = (b.get("name") or "").strip() or "Untitled"
    try:
        return envelope(_wls.create_watchlist(uid, name), source="db")
    except _wls.PremiumRequired:
        return envelope({"error": "premium_required"}), 402


@app.route("/api/watchlists/<int:list_id>", methods=["PATCH"])
def watchlists_patch(list_id):
    uid = _require_user()
    if uid is None:
        return envelope({"error": "authentication required"}), 401
    b = request.get_json(force=True) or {}
    res = _wls.rename_or_move_list(uid, list_id, name=b.get("name"), position=b.get("position"))
    if res is None:
        return envelope({"error": "not found"}), 404
    return envelope(res, source="db")


@app.route("/api/watchlists/<int:list_id>", methods=["DELETE"])
def watchlists_delete(list_id):
    uid = _require_user()
    if uid is None:
        return envelope({"error": "authentication required"}), 401
    try:
        return envelope({"deleted": _wls.delete_watchlist(uid, list_id)}, source="db")
    except _wls.LastList:
        return envelope({"error": "last_list"}), 409


@app.route("/api/watchlists/<int:list_id>/items", methods=["POST"])
def watchlist_item_post(list_id):
    uid = _require_user()
    if uid is None:
        return envelope({"error": "authentication required"}), 401
    b = request.get_json(force=True) or {}
    sym = (b.get("symbol") or "").upper()
    if not valid_symbol(sym):
        return envelope({"error": "invalid symbol"}), 400
    try:
        item = _wls.add_item(uid, list_id, sym,
                             target=float(b.get("target", 0) or 0),
                             alert_price=float(b.get("alert_price", 0) or 0),
                             alert_dir=b.get("alert_dir", "above"))
        return envelope(item, source="db")
    except _wls.FreeLimit:
        return envelope({"error": "free_limit"}), 402
    except ValueError:
        return envelope({"error": "not found"}), 404


@app.route("/api/watchlists/<int:list_id>/items/<sym>", methods=["PATCH"])
def watchlist_item_patch(list_id, sym):
    uid = _require_user()
    if uid is None:
        return envelope({"error": "authentication required"}), 401
    b = request.get_json(force=True) or {}
    allowed = {"target", "alert_price", "alert_dir", "alert_active", "position", "watchlist_id"}
    fields = {k: v for k, v in b.items() if k in allowed}
    item = _wls.update_item(uid, list_id, sym.upper(), **fields)
    if item is None:
        return envelope({"error": "not found"}), 404
    return envelope(item, source="db")


@app.route("/api/watchlists/<int:list_id>/items/<sym>", methods=["DELETE"])
def watchlist_item_delete(list_id, sym):
    uid = _require_user()
    if uid is None:
        return envelope({"error": "authentication required"}), 401
    return envelope({"removed": _wls.remove_item(uid, list_id, sym.upper())}, source="db")


@app.route("/api/watchlists/<int:list_id>/share", methods=["POST"])
def watchlist_list_share(list_id):
    uid = _require_user()
    if uid is None:
        return envelope({"error": "authentication required"}), 401
    return envelope({"token": create_share(uid, list_id)}, source="db")
```

Also wrap the existing `/api/watchlist` POST (`watchlist_post`, lines 247-258) so the legacy route maps `FreeLimit` to 402:

```python
    try:
        item = add_watch(sym, target=float(b.get("target", 0) or 0),
                         alert_price=float(b.get("alert_price", 0) or 0),
                         alert_dir=b.get("alert_dir", "above"))
    except _wls.FreeLimit:
        return envelope({"error": "free_limit"}), 402
    return envelope(item, source="db")
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_watchlists_api.py -v`
Expected: PASS (all 5).

- [ ] **Step 5: Full backend suite**

Run: `cd backend && python -m pytest -q`
Expected: green.

- [ ] **Step 6: Commit**

```bash
git add backend/app.py backend/tests/test_watchlists_api.py
git commit -m "feat(api): /api/watchlists CRUD + items + per-list share; 402/409 gating"
```

---

## Task 7: Alembic mirror + frontend deps + types

**Files:**
- Create: `backend/migrations/versions/cc01_multi_watchlist.py`
- Modify: `frontend/package.json` (deps)
- Modify: `frontend/src/api/types.ts`

**Interfaces:**
- Produces (TS): `Watchlist`, `WatchlistWithItems`, `WatchlistItemFull`; `AuthUser.plan`.

- [ ] **Step 1: Create the Alembic migration (mirror of the runtime backfill)**

Look at an existing migration first: `backend/migrations/versions/aa01_alert_state.py` for the revision/style. Create `backend/migrations/versions/cc01_multi_watchlist.py`:

```python
"""multi watchlist: watchlists table + watchlist_id + user.plan

Revision ID: cc01_multi_watchlist
Revises: <current head>
"""
from alembic import op
import sqlalchemy as sa

revision = "cc01_multi_watchlist"
# Set down_revision to the value printed by `cd backend && alembic heads`
# (the existing latest revision id) before this migration is run in CI.
down_revision = "REPLACE_WITH_ALEMBIC_HEADS_OUTPUT"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "watchlists",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("name", sa.String, nullable=False, server_default="My Watchlist"),
        sa.Column("position", sa.Integer, server_default="0"),
        sa.Column("share_token", sa.String, nullable=True, index=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )
    op.add_column("watchlist_items", sa.Column("watchlist_id", sa.Integer, sa.ForeignKey("watchlists.id"), nullable=True))
    op.add_column("users", sa.Column("plan", sa.String, server_default="free"))
    # data backfill is handled idempotently at runtime by db._ensure_columns.


def downgrade():
    op.drop_column("watchlist_items", "watchlist_id")
    op.drop_column("users", "plan")
    op.drop_table("watchlists")
```

Set `down_revision` to the output of `cd backend && alembic heads` before this is ever run in CI. (Runtime `_ensure_columns` is the live path; Alembic is the audit trail.)

- [ ] **Step 2: Install frontend deps**

Run:
```bash
cd frontend && npm install @dnd-kit/core@^6 @dnd-kit/sortable@^8 html-to-image@^1 qrcode@^1 && npm install -D @types/qrcode
```
Expected: `package.json` dependencies updated; lockfile changes.

- [ ] **Step 3: Add the TS types**

In `frontend/src/api/types.ts`, extend `AuthUser` and add list types:

```typescript
export interface AuthUser { id: number; email: string; name: string; email_verified: boolean; plan: 'free' | 'premium' }

export interface WatchlistItemFull extends WatchlistItem {
  watchlist_id: number
  locked: boolean
}

export interface WatchlistWithItems {
  id: number
  name: string
  position: number
  share_token: string | null
  items: WatchlistItemFull[]
}
```

- [ ] **Step 4: Type-check**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: no errors (types compile; `plan` now required on `AuthUser` — fix any literal `AuthUser` objects in tests by adding `plan: 'free'`).

- [ ] **Step 5: Commit**

```bash
git add backend/migrations/versions/cc01_multi_watchlist.py frontend/package.json frontend/package-lock.json frontend/src/api/types.ts
git commit -m "chore: alembic mirror + dnd-kit/html-to-image/qrcode deps + list types"
```

---

## Task 8: API client methods

**Files:**
- Modify: `frontend/src/api/client.ts`

**Interfaces:**
- Consumes: `WatchlistWithItems`, `WatchlistItemFull` from types.
- Produces: `api.getWatchlists`, `api.createWatchlist`, `api.patchWatchlist`, `api.deleteWatchlist`, `api.addListItem`, `api.patchListItem`, `api.removeListItem`, `api.shareList`.

- [ ] **Step 1: Add methods**

In `frontend/src/api/client.ts`, import the new types and add to the `api` object:

```typescript
  getWatchlists: () => get<WatchlistWithItems[]>('/api/watchlists'),
  createWatchlist: (name: string) =>
    send<WatchlistWithItems>('/api/watchlists', 'POST', { name }),
  patchWatchlist: (id: number, b: { name?: string; position?: number }) =>
    send<{ id: number; name: string; position: number }>(`/api/watchlists/${id}`, 'PATCH', b),
  deleteWatchlist: (id: number) =>
    send<{ deleted: boolean }>(`/api/watchlists/${id}`, 'DELETE'),
  addListItem: (id: number, b: { symbol: string; target?: number }) =>
    send<WatchlistItemFull>(`/api/watchlists/${id}/items`, 'POST', b),
  patchListItem: (id: number, sym: string, b: Partial<WatchlistItemFull>) =>
    send<WatchlistItemFull>(`/api/watchlists/${id}/items/${encodeURIComponent(sym)}`, 'PATCH', b),
  removeListItem: (id: number, sym: string) =>
    send<{ removed: boolean }>(`/api/watchlists/${id}/items/${encodeURIComponent(sym)}`, 'DELETE'),
  shareList: (id: number) =>
    send<{ token: string }>(`/api/watchlists/${id}/share`, 'POST'),
```

Add `WatchlistWithItems, WatchlistItemFull` to the import block at the top (lines 5-9).

Note: `send`/`get` throw on non-2xx. For 402 handling, callers in the store must catch and read the status from the thrown `Error` message (format `${path} → ${status}`). Add a tiny helper in the store (Task 9) that parses the trailing status code.

- [ ] **Step 2: Type-check**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/api/client.ts
git commit -m "feat(api-client): watchlists list/item/share methods"
```

---

## Task 9: Pure reducers (reorder list / move item) + tests

**Files:**
- Create: `frontend/src/state/watchlistReducers.ts`
- Create: `frontend/src/state/watchlistReducers.test.ts`

**Interfaces:**
- Produces:
  - `reorderLists(lists: WatchlistWithItems[], activeId: number, overId: number): WatchlistWithItems[]`
  - `moveItem(lists, symbol, fromListId, toListId, toIndex): WatchlistWithItems[]`
  - `reorderWithinList(lists, listId, fromIndex, toIndex): WatchlistWithItems[]`
  - `flattenActive(lists): WatchlistItem[]` — deduped active union for the legacy flat `watchlist`.

- [ ] **Step 1: Write the failing tests**

```typescript
// frontend/src/state/watchlistReducers.test.ts
import { describe, it, expect } from 'vitest'
import { reorderLists, moveItem, reorderWithinList, flattenActive } from './watchlistReducers'
import type { WatchlistWithItems } from '../api/types'

const mk = (id: number, name: string, syms: string[], locked: string[] = []): WatchlistWithItems => ({
  id, name, position: id, share_token: null,
  items: syms.map((symbol, i) => ({
    symbol, position: i, target: 0, alert_price: 0, alert_dir: 'above', alert_active: false,
    watchlist_id: id, locked: locked.includes(symbol),
  })),
})

describe('watchlistReducers', () => {
  it('reorders list cards', () => {
    const lists = [mk(1, 'A', []), mk(2, 'B', []), mk(3, 'C', [])]
    const out = reorderLists(lists, 3, 1) // move C before A
    expect(out.map((l) => l.id)).toEqual([3, 1, 2])
  })

  it('moves an item between lists', () => {
    const lists = [mk(1, 'A', ['NVDA', 'AAPL']), mk(2, 'B', ['MSFT'])]
    const out = moveItem(lists, 'NVDA', 1, 2, 0)
    expect(out[0].items.map((i) => i.symbol)).toEqual(['AAPL'])
    expect(out[1].items.map((i) => i.symbol)).toEqual(['NVDA', 'MSFT'])
    expect(out[1].items[0].watchlist_id).toBe(2)
  })

  it('reorders within a list', () => {
    const lists = [mk(1, 'A', ['NVDA', 'AAPL', 'MSFT'])]
    const out = reorderWithinList(lists, 1, 0, 2)
    expect(out[0].items.map((i) => i.symbol)).toEqual(['AAPL', 'MSFT', 'NVDA'])
  })

  it('flattens active union excluding locked + dupes', () => {
    const lists = [mk(1, 'A', ['NVDA', 'AAPL'], ['AAPL']), mk(2, 'B', ['NVDA', 'MSFT'])]
    expect(flattenActive(lists).map((i) => i.symbol)).toEqual(['NVDA', 'MSFT'])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/state/watchlistReducers.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement the reducers**

Create `frontend/src/state/watchlistReducers.ts`:

```typescript
import type { WatchlistWithItems, WatchlistItem } from '../api/types'

function renumber(items: WatchlistWithItems['items']) {
  return items.map((it, i) => ({ ...it, position: i }))
}

export function reorderLists(lists: WatchlistWithItems[], activeId: number, overId: number): WatchlistWithItems[] {
  const from = lists.findIndex((l) => l.id === activeId)
  const to = lists.findIndex((l) => l.id === overId)
  if (from === -1 || to === -1 || from === to) return lists
  const next = lists.slice()
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next.map((l, i) => ({ ...l, position: i }))
}

export function moveItem(
  lists: WatchlistWithItems[], symbol: string, fromListId: number, toListId: number, toIndex: number,
): WatchlistWithItems[] {
  const src = lists.find((l) => l.id === fromListId)
  const dst = lists.find((l) => l.id === toListId)
  if (!src || !dst) return lists
  const item = src.items.find((i) => i.symbol === symbol)
  if (!item) return lists
  return lists.map((l) => {
    if (l.id === fromListId && fromListId !== toListId) {
      return { ...l, items: renumber(l.items.filter((i) => i.symbol !== symbol)) }
    }
    if (l.id === toListId) {
      const without = l.items.filter((i) => i.symbol !== symbol)
      const moved = { ...item, watchlist_id: toListId }
      const clamped = Math.max(0, Math.min(toIndex, without.length))
      without.splice(clamped, 0, moved)
      return { ...l, items: renumber(without) }
    }
    return l
  })
}

export function reorderWithinList(
  lists: WatchlistWithItems[], listId: number, fromIndex: number, toIndex: number,
): WatchlistWithItems[] {
  return lists.map((l) => {
    if (l.id !== listId) return l
    const items = l.items.slice()
    const [moved] = items.splice(fromIndex, 1)
    items.splice(toIndex, 0, moved)
    return { ...l, items: renumber(items) }
  })
}

export function flattenActive(lists: WatchlistWithItems[]): WatchlistItem[] {
  const seen = new Set<string>()
  const out: WatchlistItem[] = []
  for (const l of lists) {
    for (const it of l.items) {
      if (it.locked || seen.has(it.symbol)) continue
      seen.add(it.symbol)
      out.push({
        symbol: it.symbol, position: out.length, target: it.target,
        alert_price: it.alert_price, alert_dir: it.alert_dir, alert_active: it.alert_active,
      })
    }
  }
  return out
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/state/watchlistReducers.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/state/watchlistReducers.ts frontend/src/state/watchlistReducers.test.ts
git commit -m "feat(fe): pure watchlist reorder/move/flatten reducers + tests"
```

---

## Task 10: Store — `watchlists` state, load, derive flat list, actions

**Files:**
- Modify: `frontend/src/state/store.ts`
- Create: `frontend/src/state/watchlists.store.test.ts`

**Interfaces:**
- Consumes: reducers from Task 9, `api.*` from Task 8.
- Produces store additions: `watchlists: WatchlistWithItems[]`; `loadWatchlists()`; `createList(name)`, `deleteList(id)`, `renameList(id,name)`, `reorderListCards(activeId,overId)`, `moveTicker(sym,from,to,index)`, `reorderTicker(listId,from,to)`, `addToList(listId,sym)`, `removeFromList(listId,sym)`; `lastLimitError: 'free_limit' | 'premium_required' | null`. `loadWatchlists` sets `watchlist = flattenActive(watchlists)` so legacy consumers keep working.

- [ ] **Step 1: Write the failing test**

```typescript
// frontend/src/state/watchlists.store.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../api/client', () => ({
  api: {
    getWatchlists: vi.fn(async () => ({ data: [
      { id: 1, name: 'My Watchlist', position: 0, share_token: null, items: [
        { symbol: 'NVDA', position: 0, target: 0, alert_price: 0, alert_dir: 'above', alert_active: false, watchlist_id: 1, locked: false },
        { symbol: 'AAPL', position: 1, target: 0, alert_price: 0, alert_dir: 'above', alert_active: false, watchlist_id: 1, locked: true },
      ] },
    ], source: 'db', stale: false, fetchedAt: '' })),
  },
}))

import { useStore } from './store'

describe('store.loadWatchlists', () => {
  beforeEach(() => { useStore.setState({ watchlists: [], watchlist: [] }) })

  it('loads lists and derives flat active watchlist', async () => {
    await useStore.getState().loadWatchlists()
    expect(useStore.getState().watchlists.length).toBe(1)
    // locked AAPL excluded from flat watchlist
    expect(useStore.getState().watchlist.map((w) => w.symbol)).toEqual(['NVDA'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/state/watchlists.store.test.ts`
Expected: FAIL — `loadWatchlists` undefined.

- [ ] **Step 3: Extend the store**

In `frontend/src/state/store.ts`:

Add imports:
```typescript
import type { WatchlistWithItems } from '../api/types'
import { reorderLists, moveItem, reorderWithinList, flattenActive } from './watchlistReducers'
```

Add to `StoreState` interface (near `watchlist`):
```typescript
  watchlists: WatchlistWithItems[]
  lastLimitError: 'free_limit' | 'premium_required' | null
  loadWatchlists: () => Promise<void>
  createList: (name: string) => Promise<boolean>
  renameList: (id: number, name: string) => Promise<void>
  deleteList: (id: number) => Promise<void>
  reorderListCards: (activeId: number, overId: number) => Promise<void>
  moveTicker: (sym: string, fromId: number, toId: number, toIndex: number) => Promise<void>
  reorderTicker: (listId: number, fromIndex: number, toIndex: number) => Promise<void>
  addToList: (listId: number, sym: string) => Promise<boolean>
  removeFromList: (listId: number, sym: string) => Promise<void>
  clearLimitError: () => void
```

Add to the initial state object: `watchlists: [], lastLimitError: null,`

Add a status parser near the top of the file (module scope):
```typescript
function errStatus(e: unknown): number | null {
  const m = String((e as Error)?.message || '').match(/→\s*(\d+)/)
  return m ? Number(m[1]) : null
}
```

Add the actions inside the store creator:
```typescript
  loadWatchlists: async () => {
    try {
      const { data } = await api.getWatchlists()
      set({ watchlists: data, watchlist: flattenActive(data) })
    } catch { /* offline: keep existing */ }
  },
  createList: async (name) => {
    try {
      await api.createWatchlist(name)
      await get().loadWatchlists()
      return true
    } catch (e) {
      if (errStatus(e) === 402) set({ lastLimitError: 'premium_required' })
      return false
    }
  },
  renameList: async (id, name) => {
    set((st) => ({ watchlists: st.watchlists.map((l) => (l.id === id ? { ...l, name } : l)) }))
    try { await api.patchWatchlist(id, { name }) } catch { /* keep optimistic */ }
  },
  deleteList: async (id) => {
    try {
      await api.deleteWatchlist(id)
      await get().loadWatchlists()
    } catch { /* last_list 409: surface via reload (button disabled in UI) */ }
  },
  reorderListCards: async (activeId, overId) => {
    const next = reorderLists(get().watchlists, activeId, overId)
    set({ watchlists: next })
    const list = next.find((l) => l.id === activeId)
    if (list) { try { await api.patchWatchlist(activeId, { position: list.position }) } catch { await get().loadWatchlists() } }
  },
  moveTicker: async (sym, fromId, toId, toIndex) => {
    const prev = get().watchlists
    const next = moveItem(prev, sym, fromId, toId, toIndex)
    set({ watchlists: next, watchlist: flattenActive(next) })
    try {
      await api.patchListItem(fromId, sym, { watchlist_id: toId, position: toIndex })
    } catch { set({ watchlists: prev, watchlist: flattenActive(prev) }) }
  },
  reorderTicker: async (listId, fromIndex, toIndex) => {
    const prev = get().watchlists
    const next = reorderWithinList(prev, listId, fromIndex, toIndex)
    set({ watchlists: next, watchlist: flattenActive(next) })
    const item = next.find((l) => l.id === listId)?.items[toIndex]
    if (item) { try { await api.patchListItem(listId, item.symbol, { position: toIndex }) } catch { set({ watchlists: prev }) } }
  },
  addToList: async (listId, sym) => {
    try {
      await api.addListItem(listId, { symbol: sym })
      await get().loadWatchlists()
      return true
    } catch (e) {
      if (errStatus(e) === 402) set({ lastLimitError: 'free_limit' })
      return false
    }
  },
  removeFromList: async (listId, sym) => {
    set((st) => ({ watchlists: st.watchlists.map((l) => (l.id === listId ? { ...l, items: l.items.filter((i) => i.symbol !== sym) } : l)) }))
    try { await api.removeListItem(listId, sym) } catch { /* ignore */ }
    set((st) => ({ watchlist: flattenActive(st.watchlists) }))
  },
  clearLimitError: () => set({ lastLimitError: null }),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/state/watchlists.store.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire load on auth + view open**

In `App.tsx` (or wherever `loadWatchlist` is called on mount/login), also call `loadWatchlists()`. Search: `grep -n "loadWatchlist" frontend/src/App.tsx` and add a sibling `loadWatchlists()` call in the same effect/login flow. Also call it in the `login` action alongside `loadWatchlist()` (store.ts:162).

- [ ] **Step 6: Run full FE test suite**

Run: `cd frontend && npx vitest run`
Expected: green (fix any `AuthUser` literals missing `plan` in existing tests).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/state/store.ts frontend/src/state/watchlists.store.test.ts frontend/src/App.tsx
git commit -m "feat(fe-store): watchlists state, load, derive flat list, CRUD/move actions"
```

---

## Task 11: ManageWatchlist board UI (dnd-kit)

**Files:**
- Modify: `frontend/src/views/ManageWatchlist.tsx` (rewrite the authed body as a board)

**Interfaces:**
- Consumes: store `watchlists`, `createList`, `renameList`, `deleteList`, `reorderListCards`, `moveTicker`, `reorderTicker`, `addToList`, `removeFromList`, `lastLimitError`, `clearLimitError`; `currentUser.plan`.

This task is UI-heavy; it has no unit test (covered by reducer/store tests). Verify manually in Step 4.

- [ ] **Step 1: Build the board**

Rewrite the authed return of `ManageWatchlist.tsx` to render a `DndContext` with: (a) a `SortableContext` of list-card components keyed by list id, and (b) inside each card, a nested `SortableContext` of ticker rows keyed by `${listId}:${symbol}`. Keep the existing per-row UI (price/%, inline target, alert toggle, remove) from the current file — reuse those cells verbatim. Use:

```tsx
import { DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors, closestCorners, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
```

Key behaviors:
- `onDragEnd`: if both ids are list-card ids → `reorderListCards(activeId, overId)`. If both are ticker ids in the same list → `reorderTicker(listId, from, to)`. If ticker dragged over a different list → `moveTicker(sym, fromId, toId, toIndex)`. Encode the type in the sortable id (prefix `list:` vs `item:`), parse in the handler.
- Sensors: `useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))` — distance constraint keeps row-clicks (open ticker) working.
- Each list card header: name (double-click → inline `<input>` → `renameList`), ticker count, and a `⋯` menu with **Rename**, **Share** (opens the share menu from Task 12), **Delete** (disabled when `watchlists.length <= 1`; calls `deleteList`).
- A drag handle (`⠿`, `cursor: grab`) on each card and each row; the rest of the row keeps its click-to-open behavior.
- `+ New list` button: if `currentUser.plan !== 'premium'` and `watchlists.length >= 1`, render it as a locked/upgrade affordance (lock icon + tooltip "Upgrade for unlimited lists") that sets `lastLimitError = 'premium_required'` on click instead of creating. Otherwise calls `createList('New list')`.
- Locked rows (`item.locked`): render dimmed (`opacity: .5`) with a 🔒 and an "Upgrade to unlock" pill; not draggable.

Reuse the existing card/grid styles (`card`, the grid `gridTemplateColumns`) and tokens already in the file.

- [ ] **Step 2: Type-check + lint**

Run: `cd frontend && npx tsc -b --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 3: Build**

Run: `cd frontend && npm run build`
Expected: build succeeds.

- [ ] **Step 4: Manual verification (dev server)**

Run backend + `cd frontend && npm run dev`. As a premium-flagged user (set `plan='premium'` in DB): create a 2nd list, drag a ticker between lists, reorder list cards, rename, delete (last-list delete disabled). As a free user: confirm `+ New list` shows the upgrade affordance and the 11th ticker is blocked with a nudge.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/views/ManageWatchlist.tsx
git commit -m "feat(fe): multi-watchlist board with dnd-kit reorder + cross-list ticker drag"
```

---

## Task 12: Branded ShareCard + PNG download

**Files:**
- Create: `frontend/src/components/ShareCard.tsx`
- Modify: `frontend/src/views/ManageWatchlist.tsx` (share menu: Copy link + Download image)

**Interfaces:**
- Consumes: `toPng` from `html-to-image`, `QRCode.toDataURL` from `qrcode`, `Logo`, list items + quotes from store.
- Produces: `<ShareCard ref={...} list={WatchlistWithItems} qrDataUrl={string} />` (off-screen, fixed 1080×1350); a `downloadListPng(list)` flow.

- [ ] **Step 1: Build `ShareCard`**

Create `frontend/src/components/ShareCard.tsx` — an off-screen, fixed-size (1080×1350) branded card: gradient header with `Logo` + "Ticker Tracker", the list name, ticker rows (logo, symbol, name, price, %), the QR image (bottom-left), and the exact footer `Made with TickerTracker · tickertracker.info`. Use inline styles and the design tokens already used across the app. Accept `forwardRef<HTMLDivElement>` so the parent can snapshot it. Use absolute positioning off-screen: `position: 'fixed', left: -99999, top: 0`.

```tsx
import { forwardRef } from 'react'
import { Logo } from './Logo'
import { money, pct } from '../lib/format'
import { UNIVERSE } from '../data/universe'
import { FONT_SANS, FONT_MONO } from '../theme/tokens'
import type { WatchlistWithItems } from '../api/types'

interface Props {
  list: WatchlistWithItems
  qrDataUrl: string
  quote: (sym: string) => { price: number; pct: number }
}

export const ShareCard = forwardRef<HTMLDivElement, Props>(function ShareCard({ list, qrDataUrl, quote }, ref) {
  const items = list.items.filter((i) => !i.locked).slice(0, 18)
  return (
    <div ref={ref} style={{ position: 'fixed', left: -99999, top: 0, width: 1080, height: 1350, background: 'linear-gradient(160deg,#0b1220,#101a2e)', color: '#fff', fontFamily: FONT_SANS, padding: 64, boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
        <Logo symbol="NVDA" size={56} />
        <span style={{ fontSize: 40, fontWeight: 900, letterSpacing: '-.02em' }}>Ticker Tracker</span>
      </div>
      <span style={{ fontSize: 56, fontWeight: 800, marginBottom: 6 }}>{list.name}</span>
      <span style={{ fontSize: 22, opacity: .7, marginBottom: 28 }}>{items.length} tickers</span>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map((it) => {
          const q = quote(it.symbol)
          const up = q.pct >= 0
          return (
            <div key={it.symbol} style={{ display: 'flex', alignItems: 'center', gap: 18, background: 'rgba(255,255,255,.05)', borderRadius: 16, padding: '14px 22px' }}>
              <Logo symbol={it.symbol} size={40} />
              <span style={{ fontSize: 30, fontWeight: 800, width: 150 }}>{it.symbol}</span>
              <span style={{ flex: 1, fontSize: 22, opacity: .65, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{UNIVERSE[it.symbol]?.name || ''}</span>
              <span style={{ fontFamily: FONT_MONO, fontSize: 28 }}>{money(q.price)}</span>
              <span style={{ fontFamily: FONT_MONO, fontSize: 24, width: 120, textAlign: 'right', color: up ? '#3ddc97' : '#ff6b6b' }}>{pct(q.pct)}</span>
            </div>
          )
        })}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginTop: 24 }}>
        {qrDataUrl && <img src={qrDataUrl} width={120} height={120} alt="" style={{ borderRadius: 12, background: '#fff', padding: 8 }} />}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 26, fontWeight: 800 }}>Made with TickerTracker · tickertracker.info</span>
          <span style={{ fontSize: 20, opacity: .6 }}>Scan to view this watchlist live</span>
        </div>
      </div>
    </div>
  )
})
```

- [ ] **Step 2: Wire the download flow in ManageWatchlist**

Add a share menu (per list ⋯ → Share) with two actions:
- **Copy link** — `await api.shareList(list.id)` → copy `${location.origin}/s/${token}` (mirrors existing `handleShare`).
- **Download image** — mint/fetch the token, `const qr = await QRCode.toDataURL(`${location.origin}/s/${token}`)`, render `<ShareCard>` for that list into a ref, then:

```tsx
import { toPng } from 'html-to-image'
// ...
const dataUrl = await toPng(cardRef.current!, { pixelRatio: 2, cacheBust: true })
const a = document.createElement('a')
a.href = dataUrl
a.download = `${list.name.replace(/\s+/g, '-').toLowerCase()}-watchlist.png`
a.click()
```

The `quote` prop passes `(sym) => ({ price: price(sym), pct: chg(sym) })` from the store selectors already imported in this view.

- [ ] **Step 3: Build + type-check**

Run: `cd frontend && npx tsc -b --noEmit && npm run build`
Expected: success.

- [ ] **Step 4: Manual verification**

In dev, click ⋯ → Download image on a list → a branded PNG downloads showing the logo, tickers with live prices, the QR code, and the `Made with TickerTracker · tickertracker.info` footer. Scan the QR → opens the shared list.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ShareCard.tsx frontend/src/views/ManageWatchlist.tsx
git commit -m "feat(fe): branded ShareCard PNG export (html-to-image + QR) per list"
```

---

## Task 13: Free-tier nudges + SharedWatchlist list name + finalize

**Files:**
- Modify: `frontend/src/views/ManageWatchlist.tsx` (upgrade nudge banner)
- Modify: `frontend/src/views/SharedWatchlist.tsx` (show `list_name`)
- Modify: `frontend/src/api/types.ts` (`SharedWatchlistResponse.list_name`)
- Modify: `CHANGELOG.md`, `frontend/package.json` + `backend` version markers

**Interfaces:**
- Consumes: `lastLimitError`, `clearLimitError`.

- [ ] **Step 1: Add `list_name` to the shared response type + view**

In `types.ts`:
```typescript
export interface SharedWatchlistResponse {
  owner_name: string
  list_name?: string
  items: SharedWatchlistItem[]
}
```
In `SharedWatchlist.tsx`, change the header (line ~76) to prefer the list name:
```tsx
{data.list_name ? data.list_name : `${data.owner_name}'s Watchlist`}
```
and keep an "by {owner_name}" subline.

- [ ] **Step 2: Add the upgrade nudge**

In `ManageWatchlist.tsx`, when `lastLimitError` is set, render a dismissible banner: `free_limit` → "Free watchlists hold 10 tickers. Upgrade for unlimited." ; `premium_required` → "Multiple watchlists are a premium feature. Upgrade to create more." with an "Upgrade" button (placeholder → links to a `#pricing` anchor for now, since Stripe is cycle C) and a dismiss `✕` calling `clearLimitError()`.

- [ ] **Step 3: Version bump + changelog**

Bump `frontend/package.json` version (minor, e.g. `1.13.1` → `1.14.0`). Add a `CHANGELOG.md` entry under a new `## [1.14.0]` heading describing multiple watchlists, per-list sharing, branded PNG export, and free/premium gating.

- [ ] **Step 4: Full verification**

Run:
```bash
cd backend && python -m pytest -q
cd ../frontend && npx vitest run && npx tsc -b --noEmit && npm run build
```
Expected: backend green, frontend tests green, type-check clean, build succeeds.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/views/ManageWatchlist.tsx frontend/src/views/SharedWatchlist.tsx frontend/src/api/types.ts CHANGELOG.md frontend/package.json
git commit -m "feat: free-tier upgrade nudges + shared list name; v1.14.0"
```

---

## Done criteria

- Free user: exactly 1 list, blocked at 11th active ticker (402), `+ New list` is an upgrade affordance.
- Premium user: unlimited lists, drag list cards, drag tickers between lists, rename/delete (last-list delete blocked), per-list Copy link + branded PNG download.
- Existing users' single watchlist preserved post-migration; Dashboard/alerts/digest/sentiment unaffected (consume the active union).
- All backend + frontend tests green; type-check + build clean.
