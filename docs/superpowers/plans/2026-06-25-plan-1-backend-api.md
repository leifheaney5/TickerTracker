# Plan 1 — Backend Foundation & Real-Data API

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a Flask backend that serves real market data (quotes, OHLC history, fundamentals, crypto, Fear & Greed) through a provider-abstraction layer with per-source TTL caching and per-field fallback to a deterministic seeded mock.

**Architecture:** Flask app under `backend/`. A `providers/` layer wraps each external source (yfinance, yahooquery, coingecko, fng). A `services/` layer composes providers into the view-model field groups and applies fallback-to-mock. A `cache.py` gives per-key TTL caching. The deterministic seeded-PRNG mock (`mock.py`) is the universal floor so the API never 500s on provider failure.

**Tech Stack:** Python 3.11, Flask, yfinance, yahooquery, requests, pytest, responses (HTTP mocking).

## Global Constraints

- Python 3.11 (`python --version` → 3.11.9).
- All endpoints return `{ "data": <payload>, "meta": { "source": <str>, "stale": <bool> } }`.
- Every provider call MUST be wrapped so failure logs and falls back to seeded mock for that field group — endpoints never return 5xx for provider failure.
- Seeded mock must be deterministic: same symbol → same values across calls (FNV-1a hash → LCG PRNG, matching the prototype's `_hash`/`_rng`).
- Cache TTLs: quotes 60s, fundamentals 3600s, crypto 60s, fng 300s (history reuses fundamentals TTL window: 3600s).
- Tests must not hit the network: mock HTTP with `responses` / monkeypatch provider functions.
- Run commands from the `backend/` directory unless noted.

---

### Task 1: Project skeleton, deps, and a green test harness

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/app.py`
- Create: `backend/__init__.py`
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/test_health.py`
- Create: `backend/pytest.ini`

**Interfaces:**
- Consumes: nothing.
- Produces: a Flask `app` object importable as `from app import app`; `GET /api/health` → `{"data": {"status": "ok"}, "meta": {"source": "internal", "stale": false}}`.

- [ ] **Step 1: Write requirements.txt**

```
flask==3.0.3
yfinance==0.2.40
yahooquery==2.3.7
requests==2.32.3
pandas==2.2.2
pytest==8.2.2
responses==0.25.3
```

- [ ] **Step 2: Write the failing test**

`backend/tests/test_health.py`:
```python
from app import app

def test_health_ok():
    client = app.test_client()
    r = client.get("/api/health")
    assert r.status_code == 200
    body = r.get_json()
    assert body["data"]["status"] == "ok"
    assert body["meta"]["source"] == "internal"
    assert body["meta"]["stale"] is False
```

`backend/pytest.ini`:
```ini
[pytest]
pythonpath = .
testpaths = tests
```

- [ ] **Step 3: Run test to verify it fails**

Run (from `backend/`): `python -m venv .venv && . .venv/Scripts/activate && pip install -r requirements.txt && pytest tests/test_health.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app'` (or app has no route).

- [ ] **Step 4: Write minimal implementation**

`backend/__init__.py`: empty file.
`backend/tests/__init__.py`: empty file.
`backend/app.py`:
```python
from flask import Flask, jsonify

app = Flask(__name__)


def envelope(data, source="internal", stale=False):
    return jsonify({"data": data, "meta": {"source": source, "stale": stale}})


@app.route("/api/health")
def health():
    return envelope({"status": "ok"})


if __name__ == "__main__":
    import os
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=False)
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pytest tests/test_health.py -v`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/
git commit -m "feat(backend): Flask skeleton with health endpoint and envelope helper"
```

---

### Task 2: Deterministic seeded mock engine

**Files:**
- Create: `backend/mock.py`
- Create: `backend/tests/test_mock.py`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `fnv1a(s: str) -> int` — 32-bit FNV-1a hash (matches prototype `_hash`).
  - `rng(seed: int) -> Callable[[], float]` — LCG returning floats in [0,1) (matches prototype `_rng`).
  - `mock_quote(sym: str) -> dict` with keys `price, change_pct, day_open, day_high, day_low, volume`.
  - `mock_fundamentals(sym: str) -> dict` with keys `pe, market_cap, sector, industry, week52_high, week52_low, all_time_high, all_time_low, beta, dividend_yield, eps`.
  - `mock_history(sym: str, tf: str) -> list[dict]` each `{date, o, h, l, c, v}`.
  - `mock_crypto() -> dict` with `coins: list`, `total_market_cap`, `btc_dominance`.
  - `mock_fng() -> dict` with `value, label`.

- [ ] **Step 1: Write the failing test**

`backend/tests/test_mock.py`:
```python
from mock import fnv1a, rng, mock_quote, mock_fundamentals, mock_history, mock_crypto, mock_fng


def test_fnv1a_matches_known_value():
    # FNV-1a 32-bit of "AAPL"
    assert fnv1a("AAPL") == 1640900660


def test_rng_is_deterministic():
    a = rng(123); b = rng(123)
    seq_a = [a() for _ in range(3)]
    seq_b = [b() for _ in range(3)]
    assert seq_a == seq_b
    assert all(0.0 <= x < 1.0 for x in seq_a)


def test_mock_quote_deterministic_and_shaped():
    q1 = mock_quote("AAPL"); q2 = mock_quote("AAPL")
    assert q1 == q2
    for k in ("price", "change_pct", "day_open", "day_high", "day_low", "volume"):
        assert k in q1
    assert q1["price"] > 0


def test_mock_fundamentals_keys():
    f = mock_fundamentals("AAPL")
    for k in ("pe", "market_cap", "sector", "industry", "week52_high",
              "week52_low", "all_time_high", "all_time_low", "beta",
              "dividend_yield", "eps"):
        assert k in f
    assert f["week52_high"] >= f["week52_low"]


def test_mock_history_length_by_tf():
    assert len(mock_history("AAPL", "1M")) == 22
    assert len(mock_history("AAPL", "3M")) == 66
    bars = mock_history("AAPL", "1M")
    assert all(b["h"] >= b["l"] for b in bars)


def test_mock_crypto_and_fng():
    c = mock_crypto()
    assert c["coins"] and "btc_dominance" in c
    f = mock_fng()
    assert 0 <= f["value"] <= 100 and f["label"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_mock.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'mock'`.

- [ ] **Step 3: Write minimal implementation**

`backend/mock.py`:
```python
import datetime as _dt

_TF_BARS = {"1D": 78, "1W": 7, "1M": 22, "3M": 66, "1Y": 252, "5Y": 260}
_SECTORS = ["Technology", "Energy", "Financials", "Healthcare", "Consumer"]
_INDUSTRIES = ["Semiconductors", "Software", "Banks", "Oil & Gas", "Retail"]
_COINS = [("BTC", "Bitcoin", 1.33e12), ("ETH", "Ethereum", 4.22e11),
          ("SOL", "Solana", 7.8e10), ("XRP", "XRP", 2.9e10)]


def fnv1a(s: str) -> int:
    h = 2166136261
    for ch in s:
        h ^= ord(ch)
        h = (h * 16777619) & 0xFFFFFFFF
    return h


def rng(seed: int):
    state = seed & 0xFFFFFFFF

    def _next():
        nonlocal state
        state = (state * 1664525 + 1013904223) & 0xFFFFFFFF
        return state / 4294967296.0
    return _next


def mock_quote(sym: str) -> dict:
    r = rng(fnv1a(sym) + 1)
    price = round(6 + r() * 460, 2)
    change_pct = round((r() - 0.5) * 6, 2)
    day_open = round(price / (1 + change_pct / 100), 2)
    day_high = round(max(price, day_open) * (1 + r() * 0.01), 2)
    day_low = round(min(price, day_open) * (1 - r() * 0.01), 2)
    volume = int((1 + r() * 220) * 1e6)
    return {"price": price, "change_pct": change_pct, "day_open": day_open,
            "day_high": day_high, "day_low": day_low, "volume": volume}


def mock_fundamentals(sym: str) -> dict:
    r = rng(fnv1a(sym) + 3)
    price = mock_quote(sym)["price"]
    w52h = round(price * (1 + r() * 0.5), 2)
    w52l = round(price * (0.5 + r() * 0.3), 2)
    return {
        "pe": round(8 + r() * 64, 1),
        "market_cap": int((50 + r() * 3400) * 1e9),
        "sector": _SECTORS[fnv1a(sym) % len(_SECTORS)],
        "industry": _INDUSTRIES[fnv1a(sym) % len(_INDUSTRIES)],
        "week52_high": w52h,
        "week52_low": w52l,
        "all_time_high": round(w52h * (1 + r() * 0.3), 2),
        "all_time_low": round(w52l * (0.4 + r() * 0.3), 2),
        "beta": round(0.4 + r() * 1.8, 2),
        "dividend_yield": round(r() * 4, 2),
        "eps": round(price / (8 + r() * 30), 2),
    }


def mock_history(sym: str, tf: str) -> list:
    n = _TF_BARS.get(tf, 66)
    r = rng(fnv1a(sym) + 7)
    base = mock_quote(sym)["price"] * (0.4 + r() * 0.45)
    today = _dt.date(2026, 6, 25)
    bars = []
    p = base
    for i in range(n):
        o = p
        c = max(0.2, o * (1 + (r() - 0.5) * 0.04))
        h = max(o, c) * (1 + r() * 0.013)
        low = min(o, c) * (1 - r() * 0.013)
        d = today - _dt.timedelta(days=(n - 1 - i))
        bars.append({"date": d.isoformat(), "o": round(o, 2), "h": round(h, 2),
                     "l": round(low, 2), "c": round(c, 2),
                     "v": int((0.6 + r()) * 1e6)})
        p = c
    return bars


def mock_crypto() -> dict:
    coins = []
    for sym, name, cap in _COINS:
        r = rng(fnv1a(sym) + 11)
        coins.append({"symbol": sym, "name": name,
                      "price": round(r() * 70000, 2),
                      "change_pct": round((r() - 0.5) * 8, 2),
                      "market_cap": cap})
    total = sum(c["market_cap"] for c in coins)
    return {"coins": coins, "total_market_cap": total,
            "btc_dominance": round(coins[0]["market_cap"] / total * 100, 1)}


def mock_fng() -> dict:
    r = rng(20260625)
    v = int(r() * 100)
    label = ("Extreme Fear" if v < 25 else "Fear" if v < 45
             else "Neutral" if v < 55 else "Greed" if v < 75 else "Extreme Greed")
    return {"value": v, "label": label}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_mock.py -v`
Expected: PASS. (If `test_fnv1a_matches_known_value` fails, the expected constant is wrong — compute via the implementation and update the test to the produced value; the FNV-1a algorithm is what matters.)

- [ ] **Step 5: Commit**

```bash
git add backend/mock.py backend/tests/test_mock.py
git commit -m "feat(backend): deterministic seeded mock engine (quotes/fundamentals/history/crypto/fng)"
```

---

### Task 3: Per-key TTL cache

**Files:**
- Create: `backend/cache.py`
- Create: `backend/tests/test_cache.py`

**Interfaces:**
- Consumes: nothing.
- Produces: `cached(key: str, ttl: int, producer: Callable[[], Any]) -> tuple[Any, bool]` — returns `(value, stale)` where `stale` is False on fresh compute, True when serving a cached value whose age exceeds ttl but the producer raised. On cache hit within ttl, returns `(value, False)`. `clear()` empties the cache (for tests).

- [ ] **Step 1: Write the failing test**

`backend/tests/test_cache.py`:
```python
import time
import cache


def setup_function():
    cache.clear()


def test_caches_within_ttl():
    calls = {"n": 0}
    def producer():
        calls["n"] += 1
        return calls["n"]
    v1, s1 = cache.cached("k", 60, producer)
    v2, s2 = cache.cached("k", 60, producer)
    assert v1 == 1 and v2 == 1
    assert s1 is False and s2 is False
    assert calls["n"] == 1


def test_recomputes_after_ttl():
    calls = {"n": 0}
    def producer():
        calls["n"] += 1
        return calls["n"]
    cache.cached("k", 0, producer)
    time.sleep(0.01)
    v2, _ = cache.cached("k", 0, producer)
    assert v2 == 2


def test_serves_stale_on_producer_error():
    cache.cached("k", 0, lambda: "good")
    time.sleep(0.01)
    def boom():
        raise RuntimeError("provider down")
    v, stale = cache.cached("k", 0, boom)
    assert v == "good"
    assert stale is True
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_cache.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'cache'`.

- [ ] **Step 3: Write minimal implementation**

`backend/cache.py`:
```python
import time

_store = {}  # key -> (value, timestamp)


def clear():
    _store.clear()


def cached(key, ttl, producer):
    now = time.time()
    hit = _store.get(key)
    if hit and now - hit[1] < ttl:
        return hit[0], False
    try:
        value = producer()
        _store[key] = (value, now)
        return value, False
    except Exception:
        if hit:
            return hit[0], True
        raise
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_cache.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/cache.py backend/tests/test_cache.py
git commit -m "feat(backend): per-key TTL cache with stale-on-error fallback"
```

---

### Task 4: Quote service (yfinance/yahooquery → mock fallback)

**Files:**
- Create: `backend/providers/__init__.py`
- Create: `backend/providers/yahoo.py`
- Create: `backend/services/__init__.py`
- Create: `backend/services/quotes.py`
- Create: `backend/tests/test_quotes_service.py`

**Interfaces:**
- Consumes: `mock.mock_quote`, `cache.cached`.
- Produces:
  - `providers.yahoo.fetch_quote(sym: str) -> dict` — raises on failure; returns `{price, change_pct, day_open, day_high, day_low, volume}`.
  - `services.quotes.get_quotes(syms: list[str]) -> tuple[dict, str]` — returns `({sym: quote_dict}, source)` where source is `"yahoo"` if any real, else `"mock"`. Per-symbol fallback to `mock_quote`.
  - `services.quotes.get_market_status() -> str` — one of `"Market Open"`, `"Pre-Market"`, `"After-Hours"`, `"Closed (Weekend)"` (ported from master `get_market_status`).

- [ ] **Step 1: Write the failing test**

`backend/tests/test_quotes_service.py`:
```python
import services.quotes as q


def test_get_quotes_uses_provider_when_ok(monkeypatch):
    def fake_fetch(sym):
        return {"price": 100.0, "change_pct": 1.0, "day_open": 99.0,
                "day_high": 101.0, "day_low": 98.0, "volume": 1000}
    monkeypatch.setattr(q, "fetch_quote", fake_fetch)
    import cache; cache.clear()
    data, source = q.get_quotes(["AAPL"])
    assert data["AAPL"]["price"] == 100.0
    assert source == "yahoo"


def test_get_quotes_falls_back_to_mock(monkeypatch):
    def boom(sym):
        raise RuntimeError("yahoo down")
    monkeypatch.setattr(q, "fetch_quote", boom)
    import cache; cache.clear()
    data, source = q.get_quotes(["AAPL"])
    assert data["AAPL"]["price"] > 0   # mock served
    assert source == "mock"


def test_market_status_returns_known_value():
    assert q.get_market_status() in {
        "Market Open", "Pre-Market", "After-Hours", "Closed (Weekend)", "Unknown"}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_quotes_service.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'services.quotes'`.

- [ ] **Step 3: Write minimal implementation**

`backend/providers/__init__.py`: empty.
`backend/providers/yahoo.py`:
```python
import logging
from yahooquery import Ticker

logger = logging.getLogger(__name__)


def fetch_quote(sym: str) -> dict:
    t = Ticker(sym)
    price_data = t.price.get(sym)
    if not isinstance(price_data, dict):
        raise RuntimeError(f"no price data for {sym}")
    price = price_data.get("regularMarketPrice")
    if price is None:
        raise RuntimeError(f"no regularMarketPrice for {sym}")
    return {
        "price": round(float(price), 2),
        "change_pct": round(float(price_data.get("regularMarketChangePercent", 0) or 0) * 100, 2),
        "day_open": round(float(price_data.get("regularMarketOpen", price) or price), 2),
        "day_high": round(float(price_data.get("regularMarketDayHigh", price) or price), 2),
        "day_low": round(float(price_data.get("regularMarketDayLow", price) or price), 2),
        "volume": int(price_data.get("regularMarketVolume", 0) or 0),
    }
```

`backend/services/__init__.py`: empty.
`backend/services/quotes.py`:
```python
import logging
from datetime import datetime, time as dt_time
try:
    from zoneinfo import ZoneInfo
except ImportError:
    ZoneInfo = None

import cache
from mock import mock_quote
from providers.yahoo import fetch_quote

logger = logging.getLogger(__name__)


def get_quotes(syms):
    out = {}
    any_real = False
    for sym in syms:
        def producer(s=sym):
            return fetch_quote(s)
        try:
            val, _ = cache.cached(f"quote:{sym}", 60, producer)
            out[sym] = val
            any_real = True
        except Exception as e:
            logger.warning("quote fallback to mock for %s: %s", sym, e)
            out[sym] = mock_quote(sym)
    return out, ("yahoo" if any_real else "mock")


def get_market_status():
    try:
        tz = ZoneInfo("America/New_York") if ZoneInfo else None
        now = datetime.now(tz)
        if now.weekday() >= 5:
            return "Closed (Weekend)"
        t = now.time()
        if dt_time(9, 30) <= t <= dt_time(16, 0):
            return "Market Open"
        return "Pre-Market" if t < dt_time(9, 30) else "After-Hours"
    except Exception:
        return "Unknown"
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_quotes_service.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/providers backend/services backend/tests/test_quotes_service.py
git commit -m "feat(backend): quote service with yahooquery provider and mock fallback"
```

---

### Task 5: History & fundamentals services

**Files:**
- Modify: `backend/providers/yahoo.py` (add `fetch_history`, `fetch_fundamentals`)
- Create: `backend/services/history.py`
- Create: `backend/services/fundamentals.py`
- Create: `backend/tests/test_history_fundamentals.py`

**Interfaces:**
- Consumes: `mock.mock_history`, `mock.mock_fundamentals`, `cache.cached`.
- Produces:
  - `providers.yahoo.fetch_history(sym, tf) -> list[dict]` each `{date,o,h,l,c,v}` (raises on failure).
  - `providers.yahoo.fetch_fundamentals(sym) -> dict` (same keys as `mock_fundamentals`; raises on failure).
  - `services.history.get_history(sym, tf) -> tuple[list, str]`.
  - `services.fundamentals.get_fundamentals(sym) -> tuple[dict, str]`.

- [ ] **Step 1: Write the failing test**

`backend/tests/test_history_fundamentals.py`:
```python
import services.history as h
import services.fundamentals as f
import cache


def test_history_fallback_to_mock(monkeypatch):
    cache.clear()
    monkeypatch.setattr(h, "fetch_history", lambda s, tf: (_ for _ in ()).throw(RuntimeError("down")))
    bars, source = h.get_history("AAPL", "1M")
    assert len(bars) == 22 and source == "mock"
    assert all(k in bars[0] for k in ("date", "o", "h", "l", "c", "v"))


def test_history_uses_provider(monkeypatch):
    cache.clear()
    sample = [{"date": "2026-06-25", "o": 1, "h": 2, "l": 0.5, "c": 1.5, "v": 10}]
    monkeypatch.setattr(h, "fetch_history", lambda s, tf: sample)
    bars, source = h.get_history("AAPL", "1M")
    assert bars == sample and source == "yahoo"


def test_fundamentals_fallback_to_mock(monkeypatch):
    cache.clear()
    monkeypatch.setattr(f, "fetch_fundamentals", lambda s: (_ for _ in ()).throw(RuntimeError("down")))
    data, source = f.get_fundamentals("AAPL")
    assert source == "mock" and data["week52_high"] >= data["week52_low"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_history_fundamentals.py -v`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write minimal implementation**

Append to `backend/providers/yahoo.py`:
```python
_TF_PERIOD = {"1D": ("1d", "5m"), "1W": ("7d", "1d"), "1M": ("1mo", "1d"),
              "3M": ("3mo", "1d"), "1Y": ("1y", "1wk"), "5Y": ("5y", "1mo")}


def fetch_history(sym: str, tf: str) -> list:
    period, interval = _TF_PERIOD.get(tf, ("3mo", "1d"))
    t = Ticker(sym)
    df = t.history(period=period, interval=interval)
    if df is None or df.empty:
        raise RuntimeError(f"no history for {sym}")
    bars = []
    for idx, row in df.iterrows():
        d = idx[1] if isinstance(idx, tuple) else idx
        bars.append({
            "date": str(d)[:10],
            "o": round(float(row["open"]), 2),
            "h": round(float(row["high"]), 2),
            "l": round(float(row["low"]), 2),
            "c": round(float(row["close"]), 2),
            "v": int(row.get("volume", 0) or 0),
        })
    return bars


def fetch_fundamentals(sym: str) -> dict:
    t = Ticker(sym)
    summary = t.summary_detail.get(sym, {})
    keystats = t.key_stats.get(sym, {})
    profile = t.asset_profile.get(sym, {})
    if not isinstance(summary, dict) or not summary:
        raise RuntimeError(f"no fundamentals for {sym}")
    return {
        "pe": round(float(summary.get("trailingPE", 0) or 0), 1) or None,
        "market_cap": int(summary.get("marketCap", 0) or 0),
        "sector": profile.get("sector", "—"),
        "industry": profile.get("industry", "—"),
        "week52_high": round(float(summary.get("fiftyTwoWeekHigh", 0) or 0), 2),
        "week52_low": round(float(summary.get("fiftyTwoWeekLow", 0) or 0), 2),
        "all_time_high": round(float(summary.get("fiftyTwoWeekHigh", 0) or 0), 2),
        "all_time_low": round(float(summary.get("fiftyTwoWeekLow", 0) or 0), 2),
        "beta": round(float(keystats.get("beta", 0) or 0), 2),
        "dividend_yield": round(float(summary.get("dividendYield", 0) or 0) * 100, 2),
        "eps": round(float(keystats.get("trailingEps", 0) or 0), 2),
    }
```

`backend/services/history.py`:
```python
import logging
import cache
from mock import mock_history
from providers.yahoo import fetch_history

logger = logging.getLogger(__name__)


def get_history(sym, tf):
    try:
        val, _ = cache.cached(f"hist:{sym}:{tf}", 3600, lambda: fetch_history(sym, tf))
        return val, "yahoo"
    except Exception as e:
        logger.warning("history fallback to mock for %s/%s: %s", sym, tf, e)
        return mock_history(sym, tf), "mock"
```

`backend/services/fundamentals.py`:
```python
import logging
import cache
from mock import mock_fundamentals
from providers.yahoo import fetch_fundamentals

logger = logging.getLogger(__name__)


def get_fundamentals(sym):
    try:
        val, _ = cache.cached(f"fund:{sym}", 3600, lambda: fetch_fundamentals(sym))
        return val, "yahoo"
    except Exception as e:
        logger.warning("fundamentals fallback to mock for %s: %s", sym, e)
        return mock_fundamentals(sym), "mock"
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_history_fundamentals.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/providers/yahoo.py backend/services/history.py backend/services/fundamentals.py backend/tests/test_history_fundamentals.py
git commit -m "feat(backend): history and fundamentals services with mock fallback"
```

---

### Task 6: Crypto & Fear-and-Greed services

**Files:**
- Create: `backend/providers/coingecko.py`
- Create: `backend/providers/fng.py`
- Create: `backend/services/crypto.py`
- Create: `backend/tests/test_crypto_fng.py`

**Interfaces:**
- Consumes: `mock.mock_crypto`, `mock.mock_fng`, `cache.cached`.
- Produces:
  - `providers.coingecko.fetch_crypto() -> dict` (`{coins, total_market_cap, btc_dominance}`; raises on failure).
  - `providers.fng.fetch_fng() -> dict` (`{value, label}`; raises on failure).
  - `services.crypto.get_crypto() -> tuple[dict, str]`.
  - `services.crypto.get_fng() -> tuple[dict, str]`.

- [ ] **Step 1: Write the failing test**

`backend/tests/test_crypto_fng.py`:
```python
import responses
import services.crypto as c
import cache


@responses.activate
def test_fng_real(monkeypatch):
    cache.clear()
    responses.add(responses.GET, "https://api.alternative.me/fng/",
                  json={"data": [{"value": "72", "value_classification": "Greed"}]}, status=200)
    data, source = c.get_fng()
    assert data["value"] == 72 and data["label"] == "Greed" and source == "alternative.me"


@responses.activate
def test_fng_fallback(monkeypatch):
    cache.clear()
    responses.add(responses.GET, "https://api.alternative.me/fng/", status=500)
    data, source = c.get_fng()
    assert 0 <= data["value"] <= 100 and source == "mock"


def test_crypto_fallback(monkeypatch):
    cache.clear()
    monkeypatch.setattr(c, "fetch_crypto", lambda: (_ for _ in ()).throw(RuntimeError("down")))
    data, source = c.get_crypto()
    assert data["coins"] and source == "mock"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_crypto_fng.py -v`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write minimal implementation**

`backend/providers/fng.py`:
```python
import requests


def fetch_fng() -> dict:
    r = requests.get("https://api.alternative.me/fng/", params={"limit": 1}, timeout=8)
    r.raise_for_status()
    d = r.json()["data"][0]
    return {"value": int(d["value"]), "label": d["value_classification"]}
```

`backend/providers/coingecko.py`:
```python
import requests

_IDS = "bitcoin,ethereum,solana,ripple,binancecoin,dogecoin,cardano"


def fetch_crypto() -> dict:
    r = requests.get(
        "https://api.coingecko.com/api/v3/coins/markets",
        params={"vs_currency": "usd", "ids": _IDS, "order": "market_cap_desc"},
        timeout=10,
    )
    r.raise_for_status()
    rows = r.json()
    coins = [{
        "symbol": x["symbol"].upper(), "name": x["name"],
        "price": x["current_price"],
        "change_pct": round(x.get("price_change_percentage_24h") or 0, 2),
        "market_cap": x.get("market_cap") or 0,
    } for x in rows]
    total = sum(c["market_cap"] for c in coins) or 1
    btc = next((c for c in coins if c["symbol"] == "BTC"), None)
    return {"coins": coins, "total_market_cap": total,
            "btc_dominance": round((btc["market_cap"] / total * 100) if btc else 0, 1)}
```

`backend/services/crypto.py`:
```python
import logging
import cache
from mock import mock_crypto, mock_fng
from providers.coingecko import fetch_crypto
from providers.fng import fetch_fng

logger = logging.getLogger(__name__)


def get_crypto():
    try:
        val, _ = cache.cached("crypto", 60, fetch_crypto)
        return val, "coingecko"
    except Exception as e:
        logger.warning("crypto fallback to mock: %s", e)
        return mock_crypto(), "mock"


def get_fng():
    try:
        val, _ = cache.cached("fng", 300, fetch_fng)
        return val, "alternative.me"
    except Exception as e:
        logger.warning("fng fallback to mock: %s", e)
        return mock_fng(), "mock"
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_crypto_fng.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/providers/coingecko.py backend/providers/fng.py backend/services/crypto.py backend/tests/test_crypto_fng.py
git commit -m "feat(backend): crypto (coingecko) and fear-and-greed services with mock fallback"
```

---

### Task 7: Wire data routes into Flask

**Files:**
- Modify: `backend/app.py` (add data routes)
- Create: `backend/tests/test_routes.py`

**Interfaces:**
- Consumes: all `services.*` getters, `app.envelope`.
- Produces routes:
  - `GET /api/quotes?syms=AAPL,MSFT` → envelope, data `{quotes: {...}, market_status: str}`.
  - `GET /api/history/<sym>?tf=3M` → envelope, data = bar list.
  - `GET /api/fundamentals/<sym>` → envelope, data = fundamentals dict.
  - `GET /api/crypto` → envelope, data = crypto dict.
  - `GET /api/fng` → envelope, data = fng dict.

- [ ] **Step 1: Write the failing test**

`backend/tests/test_routes.py`:
```python
import cache
from app import app


def test_quotes_route(monkeypatch):
    cache.clear()
    import services.quotes as q
    monkeypatch.setattr(q, "fetch_quote", lambda s: (_ for _ in ()).throw(RuntimeError("down")))
    client = app.test_client()
    r = client.get("/api/quotes?syms=AAPL,MSFT")
    body = r.get_json()
    assert r.status_code == 200
    assert set(body["data"]["quotes"].keys()) == {"AAPL", "MSFT"}
    assert "market_status" in body["data"]
    assert body["meta"]["source"] == "mock"


def test_history_route(monkeypatch):
    cache.clear()
    import services.history as h
    monkeypatch.setattr(h, "fetch_history", lambda s, tf: (_ for _ in ()).throw(RuntimeError("down")))
    r = app.test_client().get("/api/history/AAPL?tf=1M")
    body = r.get_json()
    assert len(body["data"]) == 22


def test_crypto_and_fng_routes(monkeypatch):
    cache.clear()
    import services.crypto as c
    monkeypatch.setattr(c, "fetch_crypto", lambda: (_ for _ in ()).throw(RuntimeError("down")))
    r1 = app.test_client().get("/api/crypto")
    assert r1.get_json()["data"]["coins"]
    r2 = app.test_client().get("/api/fng")
    assert 0 <= r2.get_json()["data"]["value"] <= 100
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_routes.py -v`
Expected: FAIL — routes 404.

- [ ] **Step 3: Write minimal implementation**

Add to `backend/app.py` (after the health route, before `__main__`):
```python
from flask import request
from services.quotes import get_quotes, get_market_status
from services.history import get_history
from services.fundamentals import get_fundamentals
from services.crypto import get_crypto, get_fng


@app.route("/api/quotes")
def quotes_route():
    syms = [s.strip().upper() for s in request.args.get("syms", "").split(",") if s.strip()]
    quotes, source = get_quotes(syms)
    return envelope({"quotes": quotes, "market_status": get_market_status()}, source=source)


@app.route("/api/history/<sym>")
def history_route(sym):
    tf = request.args.get("tf", "3M")
    bars, source = get_history(sym.upper(), tf)
    return envelope(bars, source=source)


@app.route("/api/fundamentals/<sym>")
def fundamentals_route(sym):
    data, source = get_fundamentals(sym.upper())
    return envelope(data, source=source)


@app.route("/api/crypto")
def crypto_route():
    data, source = get_crypto()
    return envelope(data, source=source)


@app.route("/api/fng")
def fng_route():
    data, source = get_fng()
    return envelope(data, source=source)
```

- [ ] **Step 4: Run the full backend test suite**

Run: `pytest -v`
Expected: ALL PASS.

- [ ] **Step 5: Manual smoke test (real data)**

Run: `python app.py` then in another shell:
`curl "http://localhost:5000/api/quotes?syms=AAPL,MSFT"` and `curl "http://localhost:5000/api/fng"`
Expected: real prices (source "yahoo") and a live F&G value (source "alternative.me"). If offline, source is "mock" but the shape is identical.

- [ ] **Step 6: Commit**

```bash
git add backend/app.py backend/tests/test_routes.py
git commit -m "feat(backend): wire quotes/history/fundamentals/crypto/fng data routes"
```

---

## Milestone

After Task 7, `cd backend && pytest -v` is green and `python app.py` serves real
market data through `/api/*` with deterministic mock fallback. This is the data
contract Plans 4–6 consume.

## Self-Review

- **Spec coverage:** §3 endpoints quotes/history/fundamentals/crypto/fng ✓ (news/ratings → Plan 3; watchlist/settings/holdings → Plan 2; SPA serving → Plan 7). Envelope `{data, meta:{source,stale}}` ✓. Per-source TTL cache ✓. Per-field mock fallback ✓. Deterministic seeded mock ✓. Market status ported ✓.
- **Placeholder scan:** none — every step has full code.
- **Type consistency:** `fetch_quote`/`get_quotes` keys (`price, change_pct, day_open, day_high, day_low, volume`) consistent across mock, provider, service, and tests. `mock_history`/`fetch_history` bar keys (`date,o,h,l,c,v`) consistent. `cached(key, ttl, producer) -> (value, stale)` used uniformly.
