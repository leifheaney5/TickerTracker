# Plan 2 — Postgres Persistence & Watchlist/Settings/Holdings API

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add a SQLAlchemy data layer (Postgres in prod, SQLite for dev/tests via `DATABASE_URL`) with a seeded singleton user, and CRUD endpoints for watchlist, settings, and holdings — multi-user-ready (every table carries `user_id`).

**Architecture:** `db.py` builds the engine/session from `DATABASE_URL` (default SQLite file). `models.py` defines `User, WatchlistItem, Holding, AlertLog, Settings, CustomSymbol`. `auth.py` exposes `current_user_id()` (returns the singleton id=1 today). Services in `services/store.py` do CRUD; routes in `app.py` expose them. Tables auto-create on startup; Alembic is configured for prod migrations.

**Tech Stack:** SQLAlchemy 2.x, Flask, pytest. SQLite for tests (in-memory via `DATABASE_URL=sqlite://`), Postgres (psycopg) for Railway.

## Global Constraints

- `DATABASE_URL` selects backend; default `sqlite:///ticker.db`. Tests set `DATABASE_URL=sqlite://` (in-memory) before importing `db`.
- Every user-owned row carries `user_id` (FK → users.id). `current_user_id()` returns 1.
- Envelope `{data, meta:{source, stale}}` for all routes; persistence routes use `source="db"`.
- On startup the app ensures tables exist and a singleton user (id=1) + its Settings row exist (idempotent seed).
- Tests must isolate DB state: use a fresh in-memory engine per test module via a fixture that recreates tables.

---

### Task 1: DB engine, models, and seed

**Files:**
- Modify: `backend/requirements.txt` (add `SQLAlchemy==2.0.31`, `psycopg[binary]==3.2.1`, `alembic==1.13.2`)
- Create: `backend/db.py`
- Create: `backend/models.py`
- Create: `backend/auth.py`
- Create: `backend/tests/conftest.py`
- Create: `backend/tests/test_models.py`

**Interfaces:**
- Produces:
  - `db.engine`, `db.SessionLocal`, `db.Base`, `db.init_db()` (create tables + seed singleton), `db.get_session()` (contextmanager).
  - `models.User, WatchlistItem, Holding, AlertLog, Settings, CustomSymbol`.
  - `auth.current_user_id() -> int` (returns 1).

- [ ] **Step 1: Add deps** — append to `backend/requirements.txt`:
```
SQLAlchemy==2.0.31
psycopg[binary]==3.2.1
alembic==1.13.2
```
Run: `.\.venv\Scripts\python.exe -m pip install -r requirements.txt -q`

- [ ] **Step 2: Write the failing test**

`backend/tests/conftest.py`:
```python
import os
os.environ["DATABASE_URL"] = "sqlite://"  # in-memory, before db import
import pytest


@pytest.fixture(autouse=True)
def fresh_db():
    import db
    db.Base.metadata.drop_all(db.engine)
    db.init_db()
    yield
```

`backend/tests/test_models.py`:
```python
import db
import models
from auth import current_user_id


def test_singleton_user_seeded():
    with db.get_session() as s:
        u = s.get(models.User, 1)
        assert u is not None
        settings = s.get(models.Settings, 1)
        assert settings is not None
    assert current_user_id() == 1


def test_watchlist_item_roundtrip():
    with db.get_session() as s:
        s.add(models.WatchlistItem(user_id=1, symbol="AAPL", position=0, target=230.0))
        s.commit()
    with db.get_session() as s:
        items = s.query(models.WatchlistItem).filter_by(user_id=1).all()
        assert len(items) == 1 and items[0].symbol == "AAPL"
```

- [ ] **Step 3: Run to verify fail** — `pytest tests/test_models.py -v` → FAIL (no `db`).

- [ ] **Step 4: Implement**

`backend/db.py`:
```python
import os
from contextlib import contextmanager
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///ticker.db")
# Railway provides postgres:// ; SQLAlchemy needs postgresql://
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

_connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
# in-memory sqlite needs a shared static pool to persist across connections
_kw = {}
if DATABASE_URL == "sqlite://":
    from sqlalchemy.pool import StaticPool
    _kw = {"poolclass": StaticPool}

engine = create_engine(DATABASE_URL, connect_args=_connect_args, **_kw)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)
Base = declarative_base()


@contextmanager
def get_session():
    s = SessionLocal()
    try:
        yield s
    finally:
        s.close()


def init_db():
    import models  # noqa: F401  (register models on Base)
    Base.metadata.create_all(engine)
    with get_session() as s:
        if s.get(models.User, 1) is None:
            s.add(models.User(id=1, email="you@example.com", name="Jordan Doe",
                              phone="+1 (555) 012-3344"))
            s.commit()
        if s.get(models.Settings, 1) is None:
            s.add(models.Settings(user_id=1))
            s.commit()
```

`backend/models.py`:
```python
from sqlalchemy import (Column, Integer, String, Float, Boolean, DateTime,
                        ForeignKey, func)
from db import Base


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    email = Column(String, nullable=False)
    name = Column(String, default="")
    phone = Column(String, default="")
    created_at = Column(DateTime, server_default=func.now())


class WatchlistItem(Base):
    __tablename__ = "watchlist_items"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    symbol = Column(String, nullable=False)
    position = Column(Integer, default=0)
    target = Column(Float, default=0.0)
    alert_price = Column(Float, default=0.0)
    alert_dir = Column(String, default="above")
    created_at = Column(DateTime, server_default=func.now())


class Holding(Base):
    __tablename__ = "holdings"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    symbol = Column(String, nullable=False)
    shares = Column(Float, default=0.0)
    avg_cost = Column(Float, default=0.0)


class AlertLog(Base):
    __tablename__ = "alert_log"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    symbol = Column(String, nullable=False)
    price = Column(Float, default=0.0)
    triggered_at = Column(DateTime, server_default=func.now())


class Settings(Base):
    __tablename__ = "settings"
    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    broker_connected = Column(Boolean, default=False)
    broker_name = Column(String, default="")
    live_updates = Column(Boolean, default=True)
    alert_notifs = Column(Boolean, default=True)
    news_digest = Column(Boolean, default=False)
    hide_balances = Column(Boolean, default=False)
    currency = Column(String, default="USD")


class CustomSymbol(Base):
    __tablename__ = "custom_symbols"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    symbol = Column(String, nullable=False)
    name = Column(String, default="")
    sector = Column(String, default="—")
    group = Column(String, default="Tech")
    exch = Column(String, default="—")
```

`backend/auth.py`:
```python
def current_user_id() -> int:
    return 1
```

- [ ] **Step 5: Run to verify pass** — `pytest tests/test_models.py -v` → PASS.

- [ ] **Step 6: Commit**
```bash
git add backend/requirements.txt backend/db.py backend/models.py backend/auth.py backend/tests/conftest.py backend/tests/test_models.py
git commit -m "feat(backend): SQLAlchemy models, engine, singleton-user seed"
```

---

### Task 2: Store service (watchlist/settings/holdings CRUD)

**Files:**
- Create: `backend/services/store.py`
- Create: `backend/tests/test_store.py`

**Interfaces:**
- Produces (all operate on `current_user_id()`):
  - `get_watchlist() -> list[dict]` each `{symbol, position, target, alert_price, alert_dir}` ordered by position.
  - `add_watch(symbol, target=0, alert_price=0, alert_dir="above") -> dict` (upsert by symbol; appends position).
  - `update_watch(symbol, **fields) -> dict | None`.
  - `remove_watch(symbol) -> bool`.
  - `get_settings() -> dict`, `update_settings(**fields) -> dict`.
  - `get_holdings() -> list[dict]`, `set_holding(symbol, shares, avg_cost) -> dict`, `remove_holding(symbol) -> bool`.

- [ ] **Step 1: Write the failing test**

`backend/tests/test_store.py`:
```python
import services.store as store


def test_add_and_get_watchlist():
    store.add_watch("AAPL", target=230)
    store.add_watch("MSFT")
    wl = store.get_watchlist()
    assert [w["symbol"] for w in wl] == ["AAPL", "MSFT"]
    assert wl[0]["target"] == 230
    assert wl[0]["position"] == 0 and wl[1]["position"] == 1


def test_add_watch_upsert():
    store.add_watch("AAPL", target=230)
    store.add_watch("AAPL", target=999)
    wl = store.get_watchlist()
    assert len(wl) == 1 and wl[0]["target"] == 999


def test_update_and_remove_watch():
    store.add_watch("AAPL")
    store.update_watch("AAPL", alert_price=300, alert_dir="below")
    assert store.get_watchlist()[0]["alert_price"] == 300
    assert store.remove_watch("AAPL") is True
    assert store.get_watchlist() == []


def test_settings_roundtrip():
    s = store.get_settings()
    assert s["live_updates"] is True
    store.update_settings(hide_balances=True, broker_name="Demo")
    s2 = store.get_settings()
    assert s2["hide_balances"] is True and s2["broker_name"] == "Demo"


def test_holdings_roundtrip():
    store.set_holding("AAPL", 10, 180)
    store.set_holding("AAPL", 12, 185)  # upsert
    h = store.get_holdings()
    assert len(h) == 1 and h[0]["shares"] == 12
    assert store.remove_holding("AAPL") is True
```

- [ ] **Step 2: Run to verify fail** — `pytest tests/test_store.py -v` → FAIL.

- [ ] **Step 3: Implement**

`backend/services/store.py`:
```python
import db
import models
from auth import current_user_id


def _wl_dict(w):
    return {"symbol": w.symbol, "position": w.position, "target": w.target,
            "alert_price": w.alert_price, "alert_dir": w.alert_dir}


def get_watchlist():
    uid = current_user_id()
    with db.get_session() as s:
        rows = (s.query(models.WatchlistItem)
                .filter_by(user_id=uid).order_by(models.WatchlistItem.position).all())
        return [_wl_dict(w) for w in rows]


def add_watch(symbol, target=0, alert_price=0, alert_dir="above"):
    uid = current_user_id()
    symbol = symbol.upper()
    with db.get_session() as s:
        existing = s.query(models.WatchlistItem).filter_by(user_id=uid, symbol=symbol).first()
        if existing:
            existing.target = target
            existing.alert_price = alert_price
            existing.alert_dir = alert_dir
            s.commit()
            return _wl_dict(existing)
        count = s.query(models.WatchlistItem).filter_by(user_id=uid).count()
        item = models.WatchlistItem(user_id=uid, symbol=symbol, position=count,
                                    target=target, alert_price=alert_price, alert_dir=alert_dir)
        s.add(item)
        s.commit()
        return _wl_dict(item)


def update_watch(symbol, **fields):
    uid = current_user_id()
    symbol = symbol.upper()
    with db.get_session() as s:
        item = s.query(models.WatchlistItem).filter_by(user_id=uid, symbol=symbol).first()
        if not item:
            return None
        for k, v in fields.items():
            if hasattr(item, k) and v is not None:
                setattr(item, k, v)
        s.commit()
        return _wl_dict(item)


def remove_watch(symbol):
    uid = current_user_id()
    symbol = symbol.upper()
    with db.get_session() as s:
        item = s.query(models.WatchlistItem).filter_by(user_id=uid, symbol=symbol).first()
        if not item:
            return False
        s.delete(item)
        s.commit()
        return True


def get_settings():
    uid = current_user_id()
    with db.get_session() as s:
        st = s.get(models.Settings, uid)
        return {"broker_connected": st.broker_connected, "broker_name": st.broker_name,
                "live_updates": st.live_updates, "alert_notifs": st.alert_notifs,
                "news_digest": st.news_digest, "hide_balances": st.hide_balances,
                "currency": st.currency}


def update_settings(**fields):
    uid = current_user_id()
    with db.get_session() as s:
        st = s.get(models.Settings, uid)
        for k, v in fields.items():
            if hasattr(st, k) and v is not None:
                setattr(st, k, v)
        s.commit()
    return get_settings()


def _h_dict(h):
    return {"symbol": h.symbol, "shares": h.shares, "avg_cost": h.avg_cost}


def get_holdings():
    uid = current_user_id()
    with db.get_session() as s:
        return [_h_dict(h) for h in s.query(models.Holding).filter_by(user_id=uid).all()]


def set_holding(symbol, shares, avg_cost):
    uid = current_user_id()
    symbol = symbol.upper()
    with db.get_session() as s:
        h = s.query(models.Holding).filter_by(user_id=uid, symbol=symbol).first()
        if h:
            h.shares = shares
            h.avg_cost = avg_cost
        else:
            h = models.Holding(user_id=uid, symbol=symbol, shares=shares, avg_cost=avg_cost)
            s.add(h)
        s.commit()
        return _h_dict(h)


def remove_holding(symbol):
    uid = current_user_id()
    symbol = symbol.upper()
    with db.get_session() as s:
        h = s.query(models.Holding).filter_by(user_id=uid, symbol=symbol).first()
        if not h:
            return False
        s.delete(h)
        s.commit()
        return True
```

- [ ] **Step 4: Run to verify pass** — `pytest tests/test_store.py -v` → PASS.

- [ ] **Step 5: Commit**
```bash
git add backend/services/store.py backend/tests/test_store.py
git commit -m "feat(backend): watchlist/settings/holdings CRUD store service"
```

---

### Task 3: Persistence routes + startup init

**Files:**
- Modify: `backend/app.py` (call `db.init_db()` at import; add routes)
- Create: `backend/tests/test_store_routes.py`

**Interfaces:**
- Routes (all `source="db"`):
  - `GET /api/watchlist` → list
  - `POST /api/watchlist` body `{symbol, target?, alert_price?, alert_dir?}` → item
  - `PATCH /api/watchlist/<sym>` body fields → item (404 if missing)
  - `DELETE /api/watchlist/<sym>` → `{removed: bool}`
  - `GET /api/settings` / `PATCH /api/settings`
  - `GET /api/holdings` / `POST /api/holdings` `{symbol, shares, avg_cost}` / `DELETE /api/holdings/<sym>`

- [ ] **Step 1: Write the failing test**

`backend/tests/test_store_routes.py`:
```python
from app import app


def test_watchlist_crud_via_api():
    client = app.test_client()
    r = client.post("/api/watchlist", json={"symbol": "AAPL", "target": 230})
    assert r.status_code == 200 and r.get_json()["data"]["symbol"] == "AAPL"
    r = client.get("/api/watchlist")
    assert r.get_json()["data"][0]["symbol"] == "AAPL"
    r = client.patch("/api/watchlist/AAPL", json={"alert_price": 300})
    assert r.get_json()["data"]["alert_price"] == 300
    r = client.delete("/api/watchlist/AAPL")
    assert r.get_json()["data"]["removed"] is True


def test_settings_via_api():
    client = app.test_client()
    r = client.patch("/api/settings", json={"hide_balances": True})
    assert r.get_json()["data"]["hide_balances"] is True
    assert client.get("/api/settings").get_json()["meta"]["source"] == "db"


def test_holdings_via_api():
    client = app.test_client()
    client.post("/api/holdings", json={"symbol": "AAPL", "shares": 10, "avg_cost": 180})
    assert client.get("/api/holdings").get_json()["data"][0]["shares"] == 10
    assert client.delete("/api/holdings/AAPL").get_json()["data"]["removed"] is True
```

- [ ] **Step 2: Run to verify fail** — `pytest tests/test_store_routes.py -v` → FAIL (routes 404).

- [ ] **Step 3: Implement** — add to `backend/app.py` after the existing imports/health route:
```python
import db as _db
_db.init_db()

from services.store import (get_watchlist, add_watch, update_watch, remove_watch,
                            get_settings, update_settings,
                            get_holdings, set_holding, remove_holding)


@app.route("/api/watchlist", methods=["GET"])
def watchlist_get():
    return envelope(get_watchlist(), source="db")


@app.route("/api/watchlist", methods=["POST"])
def watchlist_post():
    b = request.get_json(force=True) or {}
    item = add_watch(b["symbol"], target=float(b.get("target", 0) or 0),
                     alert_price=float(b.get("alert_price", 0) or 0),
                     alert_dir=b.get("alert_dir", "above"))
    return envelope(item, source="db")


@app.route("/api/watchlist/<sym>", methods=["PATCH"])
def watchlist_patch(sym):
    b = request.get_json(force=True) or {}
    item = update_watch(sym, **b)
    if item is None:
        return envelope({"error": "not found"}, source="db"), 404
    return envelope(item, source="db")


@app.route("/api/watchlist/<sym>", methods=["DELETE"])
def watchlist_delete(sym):
    return envelope({"removed": remove_watch(sym)}, source="db")


@app.route("/api/settings", methods=["GET"])
def settings_get():
    return envelope(get_settings(), source="db")


@app.route("/api/settings", methods=["PATCH"])
def settings_patch():
    b = request.get_json(force=True) or {}
    return envelope(update_settings(**b), source="db")


@app.route("/api/holdings", methods=["GET"])
def holdings_get():
    return envelope(get_holdings(), source="db")


@app.route("/api/holdings", methods=["POST"])
def holdings_post():
    b = request.get_json(force=True) or {}
    return envelope(set_holding(b["symbol"], float(b.get("shares", 0) or 0),
                                float(b.get("avg_cost", 0) or 0)), source="db")


@app.route("/api/holdings/<sym>", methods=["DELETE"])
def holdings_delete(sym):
    return envelope({"removed": remove_holding(sym)}, source="db")
```

- [ ] **Step 4: Run the full suite** — `pytest -v` → ALL PASS.

- [ ] **Step 5: Commit**
```bash
git add backend/app.py backend/tests/test_store_routes.py
git commit -m "feat(backend): watchlist/settings/holdings routes + startup db init"
```

---

### Task 4: Alembic config for production migrations

**Files:**
- Create: `backend/alembic.ini`
- Create: `backend/migrations/env.py`
- Create: `backend/migrations/script.py.mako`
- Create: `backend/migrations/versions/.gitkeep`

**Interfaces:** none (tooling). Produces a working `alembic revision --autogenerate` / `alembic upgrade head` setup pointed at `DATABASE_URL` and `db.Base.metadata`.

- [ ] **Step 1: Create alembic.ini** (`backend/alembic.ini`):
```ini
[alembic]
script_location = migrations
prepend_sys_path = .
sqlalchemy.url =

[loggers]
keys = root
[handlers]
keys = console
[formatters]
keys = generic
[logger_root]
level = WARN
handlers = console
[handler_console]
class = StreamHandler
args = (sys.stderr,)
formatter = generic
[formatter_generic]
format = %(levelname)-5.5s [%(name)s] %(message)s
```

- [ ] **Step 2: Create migrations/env.py**:
```python
from logging.config import fileConfig
from alembic import context
import db
import models  # noqa: F401  register metadata

config = context.config
if config.config_file_name:
    fileConfig(config.config_file_name)
target_metadata = db.Base.metadata


def run_migrations_offline():
    context.configure(url=str(db.engine.url), target_metadata=target_metadata,
                      literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    with db.engine.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

- [ ] **Step 3: Create migrations/script.py.mako**:
```mako
"""${message}

Revision ID: ${up_revision}
Revises: ${down_revision | comma,n}
Create Date: ${create_date}
"""
from alembic import op
import sqlalchemy as sa
${imports if imports else ""}

revision = ${repr(up_revision)}
down_revision = ${repr(down_revision)}
branch_labels = ${repr(branch_labels)}
depends_on = ${repr(depends_on)}


def upgrade():
    ${upgrades if upgrades else "pass"}


def downgrade():
    ${downgrades if downgrades else "pass"}
```

- [ ] **Step 4: Generate the initial migration**

Run (from `backend/`, with a file-based DB so autogenerate has a target):
`$env:DATABASE_URL="sqlite:///alembic_tmp.db"; .\.venv\Scripts\alembic.exe revision --autogenerate -m "initial schema"`
Expected: a versions/*.py created with all six tables. Then `alembic upgrade head` succeeds. Delete `alembic_tmp.db` afterward.

- [ ] **Step 5: Commit**
```bash
git add backend/alembic.ini backend/migrations
git commit -m "chore(backend): alembic migrations config + initial schema revision"
```

---

## Milestone

`cd backend && pytest -v` green; the API now persists watchlist/settings/holdings
to a DB (SQLite locally, Postgres via `DATABASE_URL` on Railway). Alembic ready
for prod migrations.

## Self-Review

- **Spec coverage:** §5 schema (users, watchlist_items, holdings, alert_log, settings, custom_symbols) ✓. §3 watchlist/settings/holdings endpoints ✓. Multi-user-ready via `user_id` + `current_user_id()` ✓. Alembic ✓. `DATABASE_URL` Postgres/SQLite ✓.
- **Placeholder scan:** none.
- **Type consistency:** `_wl_dict` keys (`symbol, position, target, alert_price, alert_dir`) match store API + routes + tests. `get_settings` keys match Settings columns. `current_user_id()` used uniformly.
- **Note:** `alert_log` and `custom_symbols` tables are created now; their write paths are exercised in Plan 6 (alerts) — table existence is the Plan-2 deliverable.
