# Crypto Watchlist + Expandable Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users keep a personal crypto watchlist (with price-target alerts) and expand the Crypto Map to browse the top 25/50/100 coins.

**Architecture:** Reuse the existing `WatchlistItem` table via a new `kind` discriminator column (`"stock"` | `"crypto"`); crypto rows store the CoinGecko id in `symbol` plus a cached `coin_name`. The CoinGecko provider fetches a user-selectable top-N (union any watchlisted ids outside top-N in the same request). The existing email-alert engine is extended to partition due items by kind and price crypto via CoinGecko.

**Tech Stack:** Flask + SQLAlchemy + Postgres/SQLite (backend), `requests` + `responses` (provider/tests), React + Zustand + Vitest (frontend), pytest (backend tests).

## Global Constraints

- Version bump: **v1.14.0** (minor). Update `CHANGELOG.md` and `frontend/package.json`.
- Response envelope: every Flask route returns `envelope(data, source=...)` → `{data, meta:{source,stale,fetched_at}}`.
- Auth: persisted watchlist writes require a session; `_require_user()` returns 401 when absent. Anonymous browsing of top-N must keep working.
- Crypto coin id validation: `^[a-z0-9-]{1,64}$` (CoinGecko ids are lowercase/digits/hyphen).
- `limit` is server-validated to the set `{25, 50, 100}`, default `50`. Bad values fall back to `50` (do not 400).
- Keep commits small and modular (one task = one commit). Do NOT add `Co-Authored-By` trailers.
- Tests must not hit the network: backend uses the `responses` library or monkeypatch; frontend mocks `api`.

---

### Task 1: Add `kind` + `coin_name` to the watchlist model & store

**Files:**
- Modify: `backend/models.py:18-29` (WatchlistItem)
- Modify: `backend/db.py:59-108` (`_ensure_columns`)
- Modify: `backend/services/store.py:6-36` (`_wl_dict`, `add_watch`)
- Test: `backend/tests/test_store_kind.py` (create)

**Interfaces:**
- Produces: `WatchlistItem.kind: str` (default `"stock"`), `WatchlistItem.coin_name: str` (default `""`). `add_watch(symbol, target=0, alert_price=0, alert_dir="above", kind="stock", coin_name="")` → dict including `"kind"` and `"coin_name"`. `_wl_dict(w)` includes `kind`, `coin_name`. Crypto rows are NOT upper-cased.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_store_kind.py
import db
import models
import services.store as store
from auth import current_user_id


def _mk_user(s):
    u = models.User(email="kind@t.co", name="t", email_verified=True)
    s.add(u); s.flush()
    return u.id


def test_add_crypto_watch_preserves_id_case_and_kind(monkeypatch):
    db.Base.metadata.create_all(db.engine)
    with db.get_session() as s:
        uid = _mk_user(s); s.commit()
    monkeypatch.setattr(store, "current_user_id", lambda: uid)
    item = store.add_watch("solana", kind="crypto", coin_name="Solana", target=200)
    assert item["symbol"] == "solana"      # NOT upper-cased for crypto
    assert item["kind"] == "crypto"
    assert item["coin_name"] == "Solana"
    rows = store.get_watchlist()
    assert any(r["symbol"] == "solana" and r["kind"] == "crypto" for r in rows)


def test_add_stock_watch_still_upper_cases():
    # stock path unchanged: symbol upper-cased, kind defaults to "stock"
    import db as _db
    _db.Base.metadata.create_all(_db.engine)
    with _db.get_session() as s:
        u = models.User(email="kind2@t.co", name="t", email_verified=True)
        s.add(u); s.flush(); uid = u.id; s.commit()
    store.current_user_id = lambda: uid  # simple override
    item = store.add_watch("nvda")
    assert item["symbol"] == "NVDA" and item["kind"] == "stock"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_store_kind.py -v`
Expected: FAIL — `add_watch() got an unexpected keyword argument 'kind'` (and `kind` missing from dict).

- [ ] **Step 3: Implement the model columns**

In `backend/models.py`, add to `WatchlistItem` (after `alert_last_fired_at`, before `created_at`):

```python
    kind = Column(String, default="stock")            # "stock" | "crypto"
    coin_name = Column(String, default="")            # cached display name (crypto)
```

- [ ] **Step 4: Implement the idempotent migration**

In `backend/db.py`, inside `_ensure_columns`, in the **sqlite** branch add after the `alert_last_fired_at` block:

```python
        if "kind" not in existing:
            conn.execute(text(
                "ALTER TABLE watchlist_items ADD COLUMN kind VARCHAR DEFAULT 'stock'"
            ))
        if "coin_name" not in existing:
            conn.execute(text(
                "ALTER TABLE watchlist_items ADD COLUMN coin_name VARCHAR DEFAULT ''"
            ))
```

and in the **postgres** `else` branch add after the `alert_last_fired_at` ALTER:

```python
        conn.execute(text(
            "ALTER TABLE watchlist_items "
            "ADD COLUMN IF NOT EXISTS kind VARCHAR DEFAULT 'stock'"
        ))
        conn.execute(text(
            "ALTER TABLE watchlist_items "
            "ADD COLUMN IF NOT EXISTS coin_name VARCHAR DEFAULT ''"
        ))
```

- [ ] **Step 5: Implement the store changes**

In `backend/services/store.py`, replace `_wl_dict` and `add_watch`:

```python
def _wl_dict(w):
    return {"symbol": w.symbol, "position": w.position, "target": w.target,
            "alert_price": w.alert_price, "alert_dir": w.alert_dir,
            "alert_active": bool(w.alert_active),
            "kind": w.kind or "stock", "coin_name": w.coin_name or ""}


def add_watch(symbol, target=0, alert_price=0, alert_dir="above",
              kind="stock", coin_name=""):
    uid = current_user_id()
    # Stock tickers are case-insensitive (store upper). CoinGecko ids are
    # lowercase-hyphen and case-sensitive — keep them verbatim.
    symbol = symbol.upper() if kind == "stock" else symbol
    with db.get_session() as s:
        existing = s.query(models.WatchlistItem).filter_by(user_id=uid, symbol=symbol).first()
        if existing:
            existing.target = target
            existing.alert_price = alert_price
            existing.alert_dir = alert_dir
            existing.kind = kind
            existing.coin_name = coin_name or existing.coin_name
            s.commit()
            return _wl_dict(existing)
        count = s.query(models.WatchlistItem).filter_by(user_id=uid).count()
        item = models.WatchlistItem(user_id=uid, symbol=symbol, position=count,
                                    target=target, alert_price=alert_price,
                                    alert_dir=alert_dir, kind=kind, coin_name=coin_name)
        s.add(item)
        s.commit()
        return _wl_dict(item)
```

Also update `update_watch`/`remove_watch` symbol-casing so crypto ids still match: change the `symbol = symbol.upper()` line in BOTH functions to:

```python
        # Match either a stock ticker (stored upper) or a crypto id (stored as-is).
        item = (s.query(models.WatchlistItem).filter_by(user_id=uid, symbol=symbol).first()
                or s.query(models.WatchlistItem).filter_by(user_id=uid, symbol=symbol.upper()).first())
```

(Remove the now-redundant `symbol = symbol.upper()` line in `update_watch` and `remove_watch`, and replace their existing `item = ...first()` query with the two-way lookup above.)

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_store_kind.py -v`
Expected: PASS (2 passed).

- [ ] **Step 7: Commit**

```bash
git add backend/models.py backend/db.py backend/services/store.py backend/tests/test_store_kind.py
git commit -m "feat(crypto): add kind+coin_name to watchlist model & store"
```

---

### Task 2: CoinGecko provider — top-N, search, prices, limit-aware mock

**Files:**
- Modify: `backend/providers/coingecko.py` (full rewrite)
- Modify: `backend/mock.py:82-92` (`mock_crypto`)
- Test: `backend/tests/test_coingecko.py` (create)

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `fetch_crypto(limit=50, extra_ids=()) -> dict` → `{"coins": [{id, symbol, name, price, change_pct, market_cap}], "total_market_cap": int, "btc_dominance": float}`.
  - `search_coins(query) -> list[dict]` → `[{"id","symbol","name"}]` (≤10).
  - `fetch_prices(ids) -> dict` → `{id: {"price": float, "change_pct": float}}`.
  - `mock_crypto(limit=7, extra_ids=()) -> dict` (same shape; each coin has an `id`).

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_coingecko.py
import responses
import providers.coingecko as cg

_MARKETS = "https://api.coingecko.com/api/v3/coins/markets"
_SEARCH = "https://api.coingecko.com/api/v3/search"


def _row(cid, sym, name, price, chg, cap):
    return {"id": cid, "symbol": sym, "name": name, "current_price": price,
            "price_change_percentage_24h": chg, "market_cap": cap}


@responses.activate
def test_fetch_crypto_limit_and_shape():
    responses.add(responses.GET, _MARKETS, json=[
        _row("bitcoin", "btc", "Bitcoin", 60000, 1.5, 1_200_000_000_000),
        _row("ethereum", "eth", "Ethereum", 3000, -2.1, 400_000_000_000),
    ], status=200)
    out = cg.fetch_crypto(limit=50)
    assert out["coins"][0]["id"] == "bitcoin"
    assert out["coins"][0]["symbol"] == "BTC"        # upper-cased ticker
    assert out["total_market_cap"] == 1_600_000_000_000
    assert out["btc_dominance"] == 75.0
    # per_page forwarded
    assert "per_page=50" in responses.calls[0].request.url


@responses.activate
def test_search_coins_shape():
    responses.add(responses.GET, _SEARCH, json={"coins": [
        {"id": "solana", "symbol": "sol", "name": "Solana", "market_cap_rank": 5},
    ]}, status=200)
    hits = cg.search_coins("sol")
    assert hits[0] == {"id": "solana", "symbol": "SOL", "name": "Solana"}


@responses.activate
def test_fetch_prices_keyed_by_id():
    responses.add(responses.GET, _MARKETS, json=[
        _row("solana", "sol", "Solana", 150.0, 4.0, 7_000_000_000),
    ], status=200)
    prices = cg.fetch_prices(["solana"])
    assert prices["solana"]["price"] == 150.0
    assert prices["solana"]["change_pct"] == 4.0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_coingecko.py -v`
Expected: FAIL — `module 'providers.coingecko' has no attribute 'search_coins'` / `fetch_crypto() got an unexpected keyword argument 'limit'`.

- [ ] **Step 3: Implement the provider**

Replace the entire contents of `backend/providers/coingecko.py`:

```python
import requests

_BASE = "https://api.coingecko.com/api/v3"


def _coin(x):
    return {
        "id": x["id"],
        "symbol": x["symbol"].upper(),
        "name": x["name"],
        "price": x.get("current_price") or 0,
        "change_pct": round(x.get("price_change_percentage_24h") or 0, 2),
        "market_cap": x.get("market_cap") or 0,
    }


def fetch_crypto(limit: int = 50, extra_ids=()) -> dict:
    params = {"vs_currency": "usd", "order": "market_cap_desc",
              "per_page": limit, "page": 1}
    # Union any watchlisted coins outside the top-N into the same request.
    extra = [i for i in extra_ids if i]
    if extra:
        params["ids"] = ",".join(sorted(set(extra)))
        # When ids is set CoinGecko ignores per_page paging semantics; ask for
        # both by widening per_page so the top-N still come back.
        params["per_page"] = max(limit, len(extra) + limit)
    r = requests.get(f"{_BASE}/coins/markets", params=params, timeout=10)
    r.raise_for_status()
    rows = r.json()
    coins = [_coin(x) for x in rows]
    total = sum(c["market_cap"] for c in coins) or 1
    btc = next((c for c in coins if c["symbol"] == "BTC"), None)
    return {"coins": coins, "total_market_cap": total,
            "btc_dominance": round((btc["market_cap"] / total * 100) if btc else 0, 1)}


def search_coins(query: str) -> list:
    r = requests.get(f"{_BASE}/search", params={"query": query}, timeout=10)
    r.raise_for_status()
    coins = r.json().get("coins", [])[:10]
    return [{"id": c["id"], "symbol": (c.get("symbol") or "").upper(),
             "name": c.get("name", "")} for c in coins]


def fetch_prices(ids) -> dict:
    ids = [i for i in ids if i]
    if not ids:
        return {}
    r = requests.get(f"{_BASE}/coins/markets",
                     params={"vs_currency": "usd", "ids": ",".join(ids),
                             "per_page": len(ids), "page": 1},
                     timeout=10)
    r.raise_for_status()
    return {x["id"]: {"price": x.get("current_price") or 0,
                      "change_pct": round(x.get("price_change_percentage_24h") or 0, 2)}
            for x in r.json()}
```

- [ ] **Step 4: Make the mock limit-aware**

In `backend/mock.py`, replace `mock_crypto` (lines ~82-92) with:

```python
def mock_crypto(limit: int = 7, extra_ids=()) -> dict:
    # Deterministic synthetic coins with descending caps, padded to `limit`.
    base = [("bitcoin", "BTC", "Bitcoin", 1.33e12),
            ("ethereum", "ETH", "Ethereum", 4.22e11),
            ("solana", "SOL", "Solana", 7.8e10),
            ("ripple", "XRP", "XRP", 2.9e10),
            ("binancecoin", "BNB", "BNB", 8.5e10),
            ("dogecoin", "DOGE", "Dogecoin", 1.8e10),
            ("cardano", "ADA", "Cardano", 1.2e10)]
    coins = []
    for i in range(max(limit, len(base))):
        if i < len(base):
            cid, sym, name, cap = base[i]
        else:
            cid = f"coin-{i}"; sym = f"C{i}"; name = f"Coin {i}"
            cap = max(5e7, 1e10 / (i + 1))
        r = rng(fnv1a(sym) + 11)
        coins.append({"id": cid, "symbol": sym, "name": name,
                      "price": round(r() * 70000, 2),
                      "change_pct": round((r() - 0.5) * 8, 2),
                      "market_cap": cap})
        if i + 1 >= limit:
            break
    total = sum(c["market_cap"] for c in coins)
    return {"coins": coins, "total_market_cap": total,
            "btc_dominance": round(coins[0]["market_cap"] / total * 100, 1)}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_coingecko.py -v`
Expected: PASS (3 passed).

- [ ] **Step 6: Commit**

```bash
git add backend/providers/coingecko.py backend/mock.py backend/tests/test_coingecko.py
git commit -m "feat(crypto): coingecko top-N, search, prices + limit-aware mock"
```

---

### Task 3: Service layer — limit/search/prices with caching & fallback

**Files:**
- Modify: `backend/services/crypto.py` (full rewrite)
- Test: `backend/tests/test_crypto_service.py` (create)

**Interfaces:**
- Consumes: `fetch_crypto(limit, extra_ids)`, `search_coins(q)`, `fetch_prices(ids)`, `mock_crypto(limit, extra_ids)`.
- Produces:
  - `get_crypto(limit=50, extra_ids=()) -> (dict, source)`.
  - `get_crypto_search(q) -> (list, source)`.
  - `get_crypto_prices(ids) -> dict` (no source; `{}` on failure).

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_crypto_service.py
import services.crypto as c
import cache


def test_get_crypto_limit_passthrough(monkeypatch):
    cache.clear()
    seen = {}
    def fake(limit=50, extra_ids=()):
        seen["limit"] = limit; seen["extra"] = tuple(extra_ids)
        return {"coins": [{"id": "bitcoin"}], "total_market_cap": 1, "btc_dominance": 1}
    monkeypatch.setattr(c, "fetch_crypto", fake)
    data, source = c.get_crypto(limit=100, extra_ids=["solana"])
    assert source == "coingecko" and seen["limit"] == 100 and seen["extra"] == ("solana",)


def test_get_crypto_fallback_to_mock(monkeypatch):
    cache.clear()
    monkeypatch.setattr(c, "fetch_crypto",
                        lambda limit=50, extra_ids=(): (_ for _ in ()).throw(RuntimeError("down")))
    data, source = c.get_crypto(limit=25)
    assert data["coins"] and len(data["coins"]) == 25 and source == "mock"


def test_get_crypto_search_fallback(monkeypatch):
    cache.clear()
    monkeypatch.setattr(c, "search_coins",
                        lambda q: (_ for _ in ()).throw(RuntimeError("down")))
    hits, source = c.get_crypto_search("btc")
    assert hits == [] and source == "mock"


def test_get_crypto_prices_empty_on_error(monkeypatch):
    monkeypatch.setattr(c, "fetch_prices",
                        lambda ids: (_ for _ in ()).throw(RuntimeError("down")))
    assert c.get_crypto_prices(["solana"]) == {}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_crypto_service.py -v`
Expected: FAIL — `get_crypto() got an unexpected keyword argument 'limit'` / no `get_crypto_search`.

- [ ] **Step 3: Implement the service**

Replace `backend/services/crypto.py`:

```python
import logging
import cache
from mock import mock_crypto, mock_fng
from providers.coingecko import fetch_crypto, search_coins, fetch_prices
from providers.fng import fetch_fng

logger = logging.getLogger(__name__)


def get_crypto(limit=50, extra_ids=()):
    extra = tuple(sorted(set(i for i in extra_ids if i)))
    key = f"crypto:{limit}:{','.join(extra)}"
    try:
        val, _ = cache.cached(key, 60, lambda: fetch_crypto(limit, extra))
        return val, "coingecko"
    except Exception as e:
        logger.warning("crypto fallback to mock: %s", e)
        return mock_crypto(limit, extra), "mock"


def get_crypto_search(q):
    key = f"crypto_search:{q.lower()}"
    try:
        val, _ = cache.cached(key, 300, lambda: search_coins(q))
        return val, "coingecko"
    except Exception as e:
        logger.warning("crypto search fallback: %s", e)
        return [], "mock"


def get_crypto_prices(ids):
    try:
        return fetch_prices(ids)
    except Exception as e:
        logger.warning("crypto prices failed: %s", e)
        return {}


def get_fng():
    try:
        val, _ = cache.cached("fng", 300, lambda: fetch_fng())
        return val, "alternative.me"
    except Exception as e:
        logger.warning("fng fallback to mock: %s", e)
        return mock_fng(), "mock"
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_crypto_service.py tests/test_crypto_fng.py -v`
Expected: PASS (existing `test_crypto_fallback` still passes — `get_crypto()` default args unchanged).

- [ ] **Step 5: Commit**

```bash
git add backend/services/crypto.py backend/tests/test_crypto_service.py
git commit -m "feat(crypto): service layer for limit/search/prices with fallback"
```

---

### Task 4: API routes — limit + watch params, search, crypto watchlist POST

**Files:**
- Modify: `backend/app.py:173-176` (`/api/crypto`), add `/api/crypto/search`
- Modify: `backend/app.py:247-258` (`watchlist_post`)
- Add: `valid_coin_id` helper near `valid_symbol` (`backend/app.py:113`)
- Test: `backend/tests/test_crypto_routes.py` (create)

**Interfaces:**
- Consumes: `get_crypto(limit, extra_ids)`, `get_crypto_search(q)`, `add_watch(..., kind, coin_name)`.
- Produces:
  - `GET /api/crypto?limit=50&watch=solana,cardano` → envelope.
  - `GET /api/crypto/search?q=sol` → envelope (list).
  - `POST /api/watchlist` accepts `{symbol, kind, coin_name, target, alert_price, alert_dir}`; crypto validated by `valid_coin_id`.
  - `valid_coin_id(s) -> bool`.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_crypto_routes.py
import app as appmod


def test_valid_coin_id():
    assert appmod.valid_coin_id("solana")
    assert appmod.valid_coin_id("shiba-inu")
    assert not appmod.valid_coin_id("Sol Ana")
    assert not appmod.valid_coin_id("")
    assert not appmod.valid_coin_id("../etc")
    assert not appmod.valid_coin_id("x" * 65)


def test_crypto_route_limit_validation(monkeypatch):
    seen = {}
    monkeypatch.setattr(appmod, "get_crypto",
                        lambda limit=50, extra_ids=(): (seen.update(limit=limit, extra=tuple(extra_ids)) or ({"coins": []}, "coingecko")))
    client = appmod.app.test_client()
    client.get("/api/crypto?limit=100&watch=solana,bad id")
    assert seen["limit"] == 100
    assert seen["extra"] == ("solana",)            # invalid id filtered out
    client.get("/api/crypto?limit=7")              # not in {25,50,100}
    assert seen["limit"] == 50                      # falls back to default


def test_crypto_search_route(monkeypatch):
    monkeypatch.setattr(appmod, "get_crypto_search",
                        lambda q: ([{"id": "solana", "symbol": "SOL", "name": "Solana"}], "coingecko"))
    client = appmod.app.test_client()
    r = client.get("/api/crypto/search?q=sol")
    assert r.status_code == 200
    assert r.get_json()["data"][0]["id"] == "solana"
    # too-short query returns empty, no provider call
    r2 = client.get("/api/crypto/search?q=")
    assert r2.get_json()["data"] == []
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_crypto_routes.py -v`
Expected: FAIL — `module 'app' has no attribute 'valid_coin_id'`.

- [ ] **Step 3: Add `valid_coin_id`**

In `backend/app.py`, after `valid_symbol` (line ~114) add:

```python
import re as _re_coin
_COIN_ID_RE = _re_coin.compile(r"^[a-z0-9-]{1,64}$")


def valid_coin_id(s: str) -> bool:
    return bool(_COIN_ID_RE.match(s or ""))
```

- [ ] **Step 4: Update `get_crypto` import & `/api/crypto` route**

In `backend/app.py`, change the import line `from services.crypto import get_crypto, get_fng` to:

```python
from services.crypto import get_crypto, get_fng, get_crypto_search
```

Replace the `/api/crypto` route (lines ~173-176):

```python
_CRYPTO_LIMITS = {25, 50, 100}


@app.route("/api/crypto")
def crypto_route():
    try:
        limit = int(request.args.get("limit", 50))
    except (TypeError, ValueError):
        limit = 50
    if limit not in _CRYPTO_LIMITS:
        limit = 50
    raw = request.args.get("watch", "")
    watch = [i.strip() for i in raw.split(",") if i.strip()]
    watch = [i for i in watch if valid_coin_id(i)][:50]
    data, source = get_crypto(limit=limit, extra_ids=watch)
    return envelope(data, source=source)


@app.route("/api/crypto/search")
def crypto_search_route():
    q = (request.args.get("q", "") or "").strip()
    if len(q) < 2:
        return envelope([], source="internal")
    data, source = get_crypto_search(q)
    return envelope(data, source=source)
```

- [ ] **Step 5: Update `watchlist_post` to accept `kind`**

Replace `watchlist_post` (lines ~247-258):

```python
@app.route("/api/watchlist", methods=["POST"])
def watchlist_post():
    if _require_user() is None:
        return envelope({"error": "authentication required"}), 401
    b = request.get_json(force=True) or {}
    kind = b.get("kind", "stock")
    if kind == "crypto":
        sym = (b.get("symbol") or "").strip().lower()
        if not valid_coin_id(sym):
            return envelope({"error": "invalid coin id"}), 400
    else:
        sym = (b.get("symbol") or "").upper()
        if not valid_symbol(sym):
            return envelope({"error": "invalid symbol"}), 400
    item = add_watch(sym, target=float(b.get("target", 0) or 0),
                     alert_price=float(b.get("alert_price", 0) or 0),
                     alert_dir=b.get("alert_dir", "above"),
                     kind=kind, coin_name=(b.get("coin_name") or "")[:64])
    return envelope(item, source="db")
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_crypto_routes.py -v`
Expected: PASS (3 passed).

- [ ] **Step 7: Commit**

```bash
git add backend/app.py backend/tests/test_crypto_routes.py
git commit -m "feat(crypto): /api/crypto limit+watch params, search route, crypto watchlist POST"
```

---

### Task 5: Alert engine — fire price targets/alerts for crypto coins

**Files:**
- Modify: `backend/services/alerts.py:111-146` (`check_alerts`); price-format helper
- Test: `backend/tests/test_crypto_alerts.py` (create)

**Interfaces:**
- Consumes: `WatchlistItem.kind`, `get_crypto_prices(ids)` from `services.crypto`, existing `get_quotes`.
- Produces: `check_alerts` fires for crypto rows; crypto pricing isolated from network in tests via `crypto_price_fn` param.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_crypto_alerts.py
import db
import models
import services.alerts as alerts


def _seed(email, symbol, kind, target):
    with db.get_session() as s:
        u = models.User(email=email, name="t", email_verified=True)
        s.add(u); s.flush()
        s.add(models.Settings(user_id=u.id, alert_notifs=True))
        s.add(models.WatchlistItem(user_id=u.id, symbol=symbol, kind=kind, target=target))
        s.commit()


def test_crypto_target_fires(monkeypatch):
    db.Base.metadata.create_all(db.engine)
    _seed("c1@t.co", "solana", "crypto", target=100)
    sent = []
    fired = alerts.check_alerts(
        crypto_price_fn=lambda ids: {"solana": {"price": 150.0, "change_pct": 5}},
        quote_fn=lambda syms: ({}, "test"),
        send_fn=lambda to, subj, html: sent.append((to, subj)) or True)
    assert fired == 1 and sent and "solana" in sent[0][1]


def test_crypto_below_target_does_not_fire(monkeypatch):
    db.Base.metadata.create_all(db.engine)
    _seed("c2@t.co", "cardano", "crypto", target=500)
    fired = alerts.check_alerts(
        crypto_price_fn=lambda ids: {"cardano": {"price": 1.2, "change_pct": -1}},
        quote_fn=lambda syms: ({}, "test"),
        send_fn=lambda to, subj, html: True)
    assert fired == 0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_crypto_alerts.py -v`
Expected: FAIL — `check_alerts() got an unexpected keyword argument 'crypto_price_fn'`.

- [ ] **Step 3: Implement crypto pricing in `check_alerts`**

In `backend/services/alerts.py`, replace `check_alerts` (lines ~111-146):

```python
def check_alerts(now=None, quote_fn=None, send_fn=None, crypto_price_fn=None) -> int:
    now = now or dt.datetime.utcnow()
    quote_fn = quote_fn or get_quotes
    send_fn = send_fn or _send
    if crypto_price_fn is None:
        from services.crypto import get_crypto_prices
        crypto_price_fn = get_crypto_prices
    fired = 0
    with db.get_session() as s:
        due = due_alerts(s, now=now)
        if not due:
            return 0
        stock = [w for w in due if (w.kind or "stock") != "crypto"]
        crypto = [w for w in due if (w.kind or "stock") == "crypto"]
        prices = {}
        if stock:
            quotes, _ = quote_fn(sorted({w.symbol for w in stock}))
            prices.update({sym: q["price"] for sym, q in quotes.items()})
        if crypto:
            cp = crypto_price_fn(sorted({w.symbol for w in crypto}))
            prices.update({cid: p["price"] for cid, p in cp.items()})
        for w in due:
            price = prices.get(w.symbol)
            if price is None:
                continue
            hit = _evaluate(w, price)
            if not hit:
                continue
            level, direction, kind = hit
            user = s.get(models.User, w.user_id)
            settings = s.get(models.Settings, w.user_id)
            if not user or not user.email:
                continue
            if settings is not None and not settings.alert_notifs:
                continue
            label = "price target" if kind == "target" else "alert price"
            display = w.coin_name or w.symbol
            ok = send_fn(user.email,
                         f"{display} hit your {label}",
                         _alert_email_html(display, price, level, direction, kind))
            if ok:
                s.add(models.AlertLog(user_id=w.user_id, symbol=w.symbol, price=price))
                w.alert_last_fired_at = now
                fired += 1
        s.commit()
    return fired
```

- [ ] **Step 4: Make the email price-format precision-aware**

In `backend/services/alerts.py`, in `_alert_email_html`, add a helper at the top of the function and use it for the three `${...:,.2f}` price interpolations (the big price, the "Current" row; keep `level` formatting consistent):

```python
    def _fmt(v):
        # Sub-$1 coins need more precision than 2dp.
        if v >= 1:
            return f"${v:,.2f}"
        return f"${v:,.4f}"
```

Then replace `${price:,.2f}` → `{_fmt(price)}`, `${level:,.2f}` → `{_fmt(level)}`, and the preheader `${price:,.2f}` → `{_fmt(price)}`. (Leave the `diff_pct` percentage as-is.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_crypto_alerts.py backend/tests/test_routes.py -v` (adjust path; run the alerts test plus the existing suite for regressions: `cd backend && python -m pytest -q`)
Expected: PASS — new crypto alert tests pass and the existing alert tests still pass.

- [ ] **Step 6: Commit**

```bash
git add backend/services/alerts.py backend/tests/test_crypto_alerts.py
git commit -m "feat(crypto): fire watchlist price targets/alerts for crypto coins"
```

---

### Task 6: Frontend types & API client

**Files:**
- Modify: `frontend/src/api/types.ts:46-58,82-91` (Coin, CryptoResponse, WatchlistItem; add CryptoSearchResult)
- Modify: `frontend/src/api/client.ts:44,49-55` (crypto, cryptoSearch, addWatch)
- Test: covered by store test in Task 7 (no standalone test).

**Interfaces:**
- Produces:
  - `Coin` gains `id: string`.
  - `WatchlistItem` gains `kind: 'stock' | 'crypto'`, `coin_name?: string`.
  - `CryptoSearchResult { id: string; symbol: string; name: string }`.
  - `api.crypto(limit?: number, watchIds?: string[])`, `api.cryptoSearch(q: string)`.
  - `api.addWatch` body accepts `kind?` and `coin_name?`.

- [ ] **Step 1: Update types**

In `frontend/src/api/types.ts`, add `id: string` to `Coin`:

```typescript
export interface Coin {
  id: string
  symbol: string
  name: string
  price: number
  change_pct: number
  market_cap: number
}
```

Add after `CryptoResponse`:

```typescript
export interface CryptoSearchResult {
  id: string
  symbol: string
  name: string
}
```

Extend `WatchlistItem`:

```typescript
export interface WatchlistItem {
  symbol: string
  position: number
  target: number
  alert_price: number
  alert_dir: AlertDir
  alert_active: boolean
  kind: 'stock' | 'crypto'
  coin_name?: string
}
```

- [ ] **Step 2: Update the API client**

In `frontend/src/api/client.ts`, add `CryptoSearchResult` to the type import. Replace the `crypto:` line and `addWatch`:

```typescript
  crypto: (limit?: number, watchIds?: string[]) => {
    const p = new URLSearchParams()
    if (limit) p.set('limit', String(limit))
    if (watchIds && watchIds.length) p.set('watch', watchIds.join(','))
    const qs = p.toString()
    return get<CryptoResponse>(`/api/crypto${qs ? `?${qs}` : ''}`)
  },
  cryptoSearch: (q: string) =>
    get<CryptoSearchResult[]>(`/api/crypto/search?q=${encodeURIComponent(q)}`),
```

```typescript
  addWatch: (b: { symbol: string; target?: number; alert_price?: number; alert_dir?: string; kind?: string; coin_name?: string }) =>
    send<WatchlistItem>('/api/watchlist', 'POST', b),
```

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS (no type errors). Existing `loadCrypto` call `api.crypto()` still compiles (args optional).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/api/types.ts frontend/src/api/client.ts
git commit -m "feat(crypto): frontend types & client for limit/search/crypto-watch"
```

---

### Task 7: Store — cryptoLimit, cryptoWatch, add/remove crypto watch

**Files:**
- Modify: `frontend/src/state/store.ts` (state, actions, `loadCrypto`)
- Test: `frontend/src/state/store.crypto.test.ts` (create)

**Interfaces:**
- Consumes: `api.crypto(limit, watchIds)`, `api.addWatch`, `api.removeWatch`, `api.getWatchlist`.
- Produces:
  - `cryptoLimit: 25 | 50 | 100` (default 50); `setCryptoLimit(n)` (sets + reloads crypto).
  - `loadCrypto()` passes `cryptoLimit` and current crypto watch ids.
  - `cryptoWatchIds(): string[]` selector (watchlist filtered to `kind==='crypto'`).
  - `addCryptoWatch(coin: {id; symbol; name})`, `removeCryptoWatch(id: string)`.

- [ ] **Step 1: Write the failing test**

```typescript
// frontend/src/state/store.crypto.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useStore } from './store'
import { api } from '../api/client'

vi.mock('../api/client', () => ({
  api: {
    crypto: vi.fn(async () => ({ data: { coins: [], total_market_cap: 0, btc_dominance: 0 }, source: 't', stale: false, fetchedAt: '' })),
    addWatch: vi.fn(async () => ({ data: {}, source: 't', stale: false, fetchedAt: '' })),
    removeWatch: vi.fn(async () => ({ data: { removed: true }, source: 't', stale: false, fetchedAt: '' })),
    getWatchlist: vi.fn(async () => ({ data: [], source: 't', stale: false, fetchedAt: '' })),
  },
}))

describe('crypto watchlist store', () => {
  beforeEach(() => {
    useStore.setState({ cryptoLimit: 50, watchlist: [], crypto: null })
    vi.clearAllMocks()
  })

  it('setCryptoLimit updates limit and reloads crypto with it', async () => {
    await useStore.getState().setCryptoLimit(100)
    expect(useStore.getState().cryptoLimit).toBe(100)
    expect(api.crypto).toHaveBeenCalledWith(100, [])
  })

  it('addCryptoWatch posts with kind:crypto and coin_name', async () => {
    await useStore.getState().addCryptoWatch({ id: 'solana', symbol: 'SOL', name: 'Solana' })
    expect(api.addWatch).toHaveBeenCalledWith(
      expect.objectContaining({ symbol: 'solana', kind: 'crypto', coin_name: 'Solana' }))
  })

  it('cryptoWatchIds filters by kind', () => {
    useStore.setState({ watchlist: [
      { symbol: 'NVDA', position: 0, target: 0, alert_price: 0, alert_dir: 'above', alert_active: false, kind: 'stock' },
      { symbol: 'solana', position: 1, target: 0, alert_price: 0, alert_dir: 'above', alert_active: false, kind: 'crypto', coin_name: 'Solana' },
    ] })
    expect(useStore.getState().cryptoWatchIds()).toEqual(['solana'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/state/store.crypto.test.ts`
Expected: FAIL — `setCryptoLimit is not a function` / `cryptoWatchIds is not a function`.

- [ ] **Step 3: Add state, selector, and actions to the store**

In `frontend/src/state/store.ts`:

Add `CryptoSearchResult` is not needed here. Add to the `StoreState` interface (near `crypto`/`fng`):

```typescript
  cryptoLimit: 25 | 50 | 100
  setCryptoLimit: (n: 25 | 50 | 100) => Promise<void>
  cryptoWatchIds: () => string[]
  addCryptoWatch: (coin: { id: string; symbol: string; name: string }) => Promise<void>
  removeCryptoWatch: (id: string) => Promise<void>
```

Add the initial value in the store body (near `crypto: null`):

```typescript
  cryptoLimit: 50,
```

Replace `loadCrypto`:

```typescript
  loadCrypto: async () => {
    try {
      const { data } = await api.crypto(get().cryptoLimit, get().cryptoWatchIds())
      set({ crypto: data })
    } catch { /* leave null */ }
  },
```

Add the new actions/selector (after `loadCrypto`):

```typescript
  setCryptoLimit: async (n) => {
    set({ cryptoLimit: n })
    await get().loadCrypto()
  },

  cryptoWatchIds: () =>
    get().watchlist.filter((w) => w.kind === 'crypto').map((w) => w.symbol),

  addCryptoWatch: async (coin) => {
    try {
      await api.addWatch({ symbol: coin.id, kind: 'crypto', coin_name: coin.name })
      const { data } = await api.getWatchlist()
      set({ watchlist: data })
      await get().loadCrypto()   // surface a newly-added off-top-N coin
    } catch { /* ignore offline */ }
  },

  removeCryptoWatch: async (id) => {
    try {
      await api.removeWatch(id)
      set((st) => ({ watchlist: st.watchlist.filter((w) => w.symbol !== id) }))
    } catch { /* ignore */ }
  },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/state/store.crypto.test.ts`
Expected: PASS (3 passed).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/state/store.ts frontend/src/state/store.crypto.test.ts
git commit -m "feat(crypto): store cryptoLimit + crypto watchlist add/remove"
```

---

### Task 8: Treemap highlight support

**Files:**
- Modify: `frontend/src/charts/Treemap.tsx:58-85`
- Test: `frontend/src/charts/Treemap.highlight.test.tsx` (create)

**Interfaces:**
- Produces: `Treemap` accepts optional `highlight?: Set<string>`; highlighted tiles render a 2px white inset stroke.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/charts/Treemap.highlight.test.tsx
import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Treemap } from './Treemap'

describe('Treemap highlight', () => {
  it('renders a highlight stroke on watchlisted tiles', () => {
    const { container } = render(
      <Treemap width={200} height={200}
        items={[{ sym: 'BTC', value: 10, chg: 1 }, { sym: 'ETH', value: 5, chg: -1 }]}
        highlight={new Set(['BTC'])} />)
    const stroked = container.querySelectorAll('rect[stroke="#fff"]')
    expect(stroked.length).toBe(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/charts/Treemap.highlight.test.tsx`
Expected: FAIL — no `rect[stroke="#fff"]` (prop ignored).

- [ ] **Step 3: Implement the highlight prop**

In `frontend/src/charts/Treemap.tsx`, extend `TreemapProps` and the `rect`:

```tsx
interface TreemapProps {
  items: TreemapItem[]
  width: number
  height: number
  onTileClick?: (sym: string) => void
  highlight?: Set<string>
}

export function Treemap({ items, width, height, onTileClick, highlight }: TreemapProps) {
```

Replace the `<rect ... />` line with:

```tsx
            <rect x={t.x} y={t.y} width={Math.max(0, t.w - 1)} height={Math.max(0, t.h - 1)}
              fill={heatColor(t.chg)}
              stroke={highlight?.has(t.sym) ? '#fff' : undefined}
              strokeWidth={highlight?.has(t.sym) ? 2 : undefined} />
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/charts/Treemap.highlight.test.tsx`
Expected: PASS (1 passed).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/charts/Treemap.tsx frontend/src/charts/Treemap.highlight.test.tsx
git commit -m "feat(crypto): Treemap highlight prop for watchlisted coins"
```

---

### Task 9: Crypto view — N-selector, star column, My Coins, search

**Files:**
- Modify: `frontend/src/views/Crypto.tsx` (full rewrite of the body)
- Test: `frontend/src/views/Crypto.test.tsx` (create)

**Interfaces:**
- Consumes: store `cryptoLimit`, `setCryptoLimit`, `cryptoWatchIds`, `addCryptoWatch`, `removeCryptoWatch`, `crypto`, `currentUser`, `openAuth`; `api.cryptoSearch`; `Treemap` `highlight`.
- Produces: UI only.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/views/Crypto.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Crypto } from './Crypto'
import { useStore } from '../state/store'

vi.mock('../api/client', () => ({
  api: { cryptoSearch: vi.fn(async () => ({ data: [], source: 't', stale: false, fetchedAt: '' })) },
}))

describe('Crypto view', () => {
  beforeEach(() => {
    useStore.setState({
      cryptoLimit: 50,
      crypto: { coins: [
        { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', price: 60000, change_pct: 1, market_cap: 1e12 },
      ], total_market_cap: 1e12, btc_dominance: 50 },
      fng: { value: 55, label: 'Greed' },
      watchlist: [], currentUser: { id: 1, email: 'a@b.co', name: 'A' } as never,
    })
  })

  it('renders the 25/50/100 selector and reflects current limit', () => {
    render(<Crypto />)
    expect(screen.getByRole('button', { name: '100' })).toBeTruthy()
  })

  it('clicking the star toggles the coin into the crypto watchlist', () => {
    const add = vi.spyOn(useStore.getState(), 'addCryptoWatch')
    render(<Crypto />)
    fireEvent.click(screen.getByLabelText('Watch Bitcoin'))
    expect(add).toHaveBeenCalled()
  })
})
```

(If `vitest` lacks jsdom matchers, assert via `screen.getByText`/`container.querySelector` instead of `toBeTruthy` chains — match the existing test style in `frontend/src/`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/views/Crypto.test.tsx`
Expected: FAIL — no `100` button / no `Watch Bitcoin` control.

- [ ] **Step 3: Implement the view**

Rewrite `frontend/src/views/Crypto.tsx`. Keep the existing header + stat cards (Task does not change them except "COINS TRACKED" uses `cryptoLimit`). Add, in order:

1. **N-selector** in the map card header (beside the legend):

```tsx
const cryptoLimit = useStore((s) => s.cryptoLimit)
const setCryptoLimit = useStore((s) => s.setCryptoLimit)
// ...
<div style={{ display: 'flex', gap: 4 }}>
  {[25, 50, 100].map((n) => (
    <button key={n} onClick={() => setCryptoLimit(n as 25 | 50 | 100)}
      style={{ padding: '3px 9px', borderRadius: 7, fontSize: '11px', fontWeight: 600, cursor: 'pointer',
        border: '1px solid var(--line)',
        background: cryptoLimit === n ? 'var(--accent)' : 'transparent',
        color: cryptoLimit === n ? '#fff' : 'var(--tx3)' }}>{n}</button>
  ))}
</div>
```

2. **Treemap highlight**: build `const watchSet = new Set(useStore((s)=>s.cryptoWatchIds)())` (call the selector) and pass `highlight={watchSet}` to `<Treemap>`.

3. **"My Coins" card** above the main table — render rows for `crypto.coins` whose `id` is in the watch set (so they show live price/24h), with a filled star to remove. Empty state: "Star a coin below to start tracking."

4. **Star column** as the first table column. Star button:

```tsx
const watch = useStore((s) => s.cryptoWatchIds)()
const addCryptoWatch = useStore((s) => s.addCryptoWatch)
const removeCryptoWatch = useStore((s) => s.removeCryptoWatch)
const currentUser = useStore((s) => s.currentUser)
const openAuth = useStore((s) => s.openAuth)

function toggleStar(c: Coin) {
  if (!currentUser) { openAuth('login'); return }
  if (watch.includes(c.id)) removeCryptoWatch(c.id)
  else addCryptoWatch({ id: c.id, symbol: c.symbol, name: c.name })
}
// in each row, leading cell:
<button aria-label={`Watch ${c.name}`} onClick={() => toggleStar(c)}
  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16,
    color: watch.includes(c.id) ? 'var(--warn)' : 'var(--tx3)' }}>
  {watch.includes(c.id) ? '★' : '☆'}
</button>
```

5. **Search box** ("+ Add coin") above the table — debounced 300ms calls `api.cryptoSearch(q)`; render a dropdown of `{id,symbol,name}`; selecting calls `addCryptoWatch` then clears. Use a `useEffect` + `setTimeout` debounce and local `useState` for query/results. Guard: only call when `q.trim().length >= 2`.

Import `Coin` and `CryptoSearchResult` from `../api/types` and `api` from `../api/client`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/views/Crypto.test.tsx`
Expected: PASS (2 passed).

- [ ] **Step 5: Typecheck + full frontend test run**

Run: `cd frontend && npx tsc --noEmit && npx vitest run`
Expected: PASS — no type errors, all suites green.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/views/Crypto.tsx frontend/src/views/Crypto.test.tsx
git commit -m "feat(crypto): expandable map N-selector, star column, My Coins, coin search"
```

---

### Task 10: Version bump + CHANGELOG

**Files:**
- Modify: `frontend/package.json` (version → `1.14.0`)
- Modify: `CHANGELOG.md` (new entry)

- [ ] **Step 1: Bump the version**

In `frontend/package.json`, set `"version": "1.14.0"`.

- [ ] **Step 2: Add the CHANGELOG entry**

Add a `## [1.14.0] - 2026-06-27` section at the top of `CHANGELOG.md` summarizing: crypto watchlist (star-to-track + coin search), expandable Crypto Map (top 25/50/100), crypto price-target alerts via the existing email engine. Match the existing CHANGELOG entry format.

- [ ] **Step 3: Run the full test suites**

Run: `cd backend && python -m pytest -q` and `cd frontend && npx vitest run`
Expected: PASS — both suites green.

- [ ] **Step 4: Commit**

```bash
git add CHANGELOG.md frontend/package.json
git commit -m "chore(release): v1.14.0 — crypto watchlist + expandable map"
```

---

## Self-Review Notes

- **Spec coverage:** data model (`kind`/`coin_name`) → T1; top-N + extra_ids union + search + prices → T2/T3; routes + validation → T4; crypto alerts → T5; FE types/client → T6; store → T7; treemap highlight → T8; N-selector/star/My Coins/search → T9; versioning → T10. All spec sections covered.
- **Anonymous browsing** preserved: `/api/crypto` requires no auth; only stars/search-add gate on `currentUser` (T9) / `_require_user` (T4).
- **Type consistency:** `add_watch(..., kind, coin_name)` (T1) matches route call (T4) and `_wl_dict` keys match FE `WatchlistItem` (T6). `cryptoWatchIds()` defined T7, consumed T9. `Treemap.highlight: Set<string>` defined T8, consumed T9. `crypto_price_fn` defined & used T5.
- **No network in tests:** backend uses `responses`/monkeypatch; frontend mocks `api`.
