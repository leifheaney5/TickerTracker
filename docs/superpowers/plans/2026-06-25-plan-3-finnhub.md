# Plan 3 — Finnhub: Real News, Sentiment & Analyst Ratings

> **For agentic workers:** REQUIRED SUB-SKILL: subagent-driven-development or executing-plans. Steps use `- [ ]`.

**Goal:** Add `/api/news` (per-symbol + market, with sentiment pills) and `/api/ratings/<sym>` (consensus, buy→sell distribution, 12-mo price-target range) backed by Finnhub's free tier, degrading to deterministic mock when `FINNHUB_API_KEY` is unset or the call fails.

**Architecture:** `providers/finnhub.py` wraps Finnhub HTTP; it raises if no key or on error. `services/news.py` and `services/ratings.py` compose provider + cache + mock fallback (same shape as Plan 1 services). Mock generators `mock_news`/`mock_ratings` added to `mock.py`. Routes added to `app.py`.

**Tech Stack:** requests, Finnhub REST, pytest + responses.

## Global Constraints

- `FINNHUB_API_KEY` env var. Absent → provider raises → mock fallback. The app and tests run keyless.
- News item shape: `{source, datetime, sentiment, headline, url, symbol}`; sentiment ∈ {"Bullish","Bearish","Neutral"}.
- Ratings shape: `{consensus, distribution:{strongBuy,buy,hold,sell,strongSell}, target:{low,high,mean,current}}`.
- Cache TTL: news 900s, ratings 21600s. Envelope as before.

---

### Task 1: Mock news & ratings generators

**Files:** Modify `backend/mock.py`; Create `backend/tests/test_mock_news_ratings.py`.

**Interfaces:**
- `mock_news(sym: str | None) -> list[dict]` (sym None = market news).
- `mock_ratings(sym: str) -> dict`.

- [ ] **Step 1: Failing test** (`backend/tests/test_mock_news_ratings.py`):
```python
from mock import mock_news, mock_ratings


def test_mock_news_shape():
    items = mock_news("AAPL")
    assert len(items) >= 3
    for it in items:
        assert set(("source", "datetime", "sentiment", "headline", "url", "symbol")) <= set(it)
        assert it["sentiment"] in {"Bullish", "Bearish", "Neutral"}


def test_mock_news_deterministic():
    assert mock_news("AAPL") == mock_news("AAPL")


def test_mock_ratings_shape():
    r = mock_ratings("AAPL")
    d = r["distribution"]
    assert set(("strongBuy", "buy", "hold", "sell", "strongSell")) == set(d)
    t = r["target"]
    assert t["low"] <= t["mean"] <= t["high"]
    assert r["consensus"] in {"Strong Buy", "Buy", "Hold", "Sell", "Strong Sell"}
```

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement** — append to `backend/mock.py`:
```python
_SOURCES = ["Reuters", "Bloomberg", "CNBC", "WSJ", "MarketWatch", "Barron's"]
_SENTI = ["Bullish", "Bearish", "Neutral"]
_HEADLINES = [
    "{s} beats quarterly estimates on strong demand",
    "Analysts raise {s} price target ahead of earnings",
    "{s} unveils new product line, shares react",
    "Regulators eye {s} amid sector scrutiny",
    "{s} expands operations into new markets",
    "Market volatility weighs on {s} outlook",
]


def mock_news(sym=None) -> list:
    key = sym or "MARKET"
    r = rng(fnv1a("NEWS_" + key) + 13)
    out = []
    for i in range(6):
        label = sym or "the market"
        out.append({
            "source": _SOURCES[int(r() * len(_SOURCES)) % len(_SOURCES)],
            "datetime": f"{1 + int(r() * 11)}h ago",
            "sentiment": _SENTI[int(r() * 3) % 3],
            "headline": _HEADLINES[i % len(_HEADLINES)].format(s=label),
            "url": "https://example.com/news/" + key.lower() + str(i),
            "symbol": sym or "MKT",
        })
    return out


def mock_ratings(sym: str) -> dict:
    r = rng(fnv1a("RATE_" + sym) + 17)
    dist = {"strongBuy": int(2 + r() * 18), "buy": int(2 + r() * 16),
            "hold": int(1 + r() * 12), "sell": int(r() * 5),
            "strongSell": int(r() * 3)}
    price = mock_quote(sym)["price"]
    low = round(price * (0.8 + r() * 0.1), 2)
    high = round(price * (1.1 + r() * 0.3), 2)
    mean = round((low + high) / 2, 2)
    score = (dist["strongBuy"] * 1 + dist["buy"] * 2 + dist["hold"] * 3
             + dist["sell"] * 4 + dist["strongSell"] * 5) / max(1, sum(dist.values()))
    consensus = ("Strong Buy" if score < 1.6 else "Buy" if score < 2.5
                 else "Hold" if score < 3.5 else "Sell" if score < 4.5 else "Strong Sell")
    return {"consensus": consensus, "distribution": dist,
            "target": {"low": low, "high": high, "mean": mean, "current": price}}
```

- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Commit** `feat(backend): mock news & analyst-ratings generators`.

---

### Task 2: Finnhub provider + news/ratings services

**Files:** Create `backend/providers/finnhub.py`, `backend/services/news.py`, `backend/services/ratings.py`, `backend/tests/test_news_ratings_service.py`.

**Interfaces:**
- `providers.finnhub.fetch_news(sym|None) -> list[dict]` (news item shape; raises w/o key or on error).
- `providers.finnhub.fetch_ratings(sym) -> dict` (ratings shape; raises).
- `services.news.get_news(sym=None) -> (list, source)`; `services.ratings.get_ratings(sym) -> (dict, source)`.

- [ ] **Step 1: Failing test** (`backend/tests/test_news_ratings_service.py`):
```python
import services.news as news
import services.ratings as ratings
import cache


def test_news_fallback_to_mock(monkeypatch):
    cache.clear()
    monkeypatch.setattr(news, "fetch_news", lambda sym: (_ for _ in ()).throw(RuntimeError("no key")))
    items, source = news.get_news("AAPL")
    assert items and source == "mock"


def test_news_uses_provider(monkeypatch):
    cache.clear()
    sample = [{"source": "Reuters", "datetime": "1h ago", "sentiment": "Bullish",
               "headline": "x", "url": "u", "symbol": "AAPL"}]
    monkeypatch.setattr(news, "fetch_news", lambda sym: sample)
    items, source = news.get_news("AAPL")
    assert items == sample and source == "finnhub"


def test_ratings_fallback_to_mock(monkeypatch):
    cache.clear()
    monkeypatch.setattr(ratings, "fetch_ratings", lambda sym: (_ for _ in ()).throw(RuntimeError("no key")))
    data, source = ratings.get_ratings("AAPL")
    assert source == "mock" and data["target"]["low"] <= data["target"]["high"]
```

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement**

`backend/providers/finnhub.py`:
```python
import os
import datetime as dt
import requests

_BASE = "https://finnhub.io/api/v1"


def _key():
    k = os.environ.get("FINNHUB_API_KEY")
    if not k:
        raise RuntimeError("FINNHUB_API_KEY not set")
    return k


def _ago(ts):
    try:
        delta = dt.datetime.now(dt.timezone.utc) - dt.datetime.fromtimestamp(ts, dt.timezone.utc)
        h = int(delta.total_seconds() // 3600)
        return f"{h}h ago" if h >= 1 else f"{int(delta.total_seconds() // 60)}m ago"
    except Exception:
        return "recently"


def _sentiment(article):
    # Finnhub free news has no sentiment; derive a light heuristic from headline.
    head = (article.get("headline") or "").lower()
    bull = any(w in head for w in ("beat", "surge", "soar", "raise", "record", "jump", "rally"))
    bear = any(w in head for w in ("miss", "fall", "drop", "cut", "probe", "lawsuit", "slump"))
    return "Bullish" if bull and not bear else "Bearish" if bear and not bull else "Neutral"


def fetch_news(sym=None) -> list:
    key = _key()
    if sym:
        today = dt.date.today()
        frm = (today - dt.timedelta(days=7)).isoformat()
        r = requests.get(f"{_BASE}/company-news",
                         params={"symbol": sym, "from": frm, "to": today.isoformat(), "token": key},
                         timeout=10)
    else:
        r = requests.get(f"{_BASE}/news", params={"category": "general", "token": key}, timeout=10)
    r.raise_for_status()
    rows = r.json()[:12]
    return [{
        "source": a.get("source", "—"),
        "datetime": _ago(a.get("datetime", 0)),
        "sentiment": _sentiment(a),
        "headline": a.get("headline", ""),
        "url": a.get("url", ""),
        "symbol": sym or "MKT",
    } for a in rows if a.get("headline")]


def fetch_ratings(sym: str) -> dict:
    key = _key()
    rec = requests.get(f"{_BASE}/stock/recommendation",
                       params={"symbol": sym, "token": key}, timeout=10)
    rec.raise_for_status()
    recs = rec.json()
    if not recs:
        raise RuntimeError(f"no recommendations for {sym}")
    latest = recs[0]
    dist = {"strongBuy": latest.get("strongBuy", 0), "buy": latest.get("buy", 0),
            "hold": latest.get("hold", 0), "sell": latest.get("sell", 0),
            "strongSell": latest.get("strongSell", 0)}
    pt = requests.get(f"{_BASE}/stock/price-target",
                      params={"symbol": sym, "token": key}, timeout=10)
    target = {"low": 0, "high": 0, "mean": 0, "current": 0}
    if pt.ok:
        j = pt.json()
        target = {"low": j.get("targetLow", 0), "high": j.get("targetHigh", 0),
                  "mean": j.get("targetMean", 0), "current": j.get("lastPrice", 0)}
    score = (dist["strongBuy"] + dist["buy"] * 2 + dist["hold"] * 3
             + dist["sell"] * 4 + dist["strongSell"] * 5) / max(1, sum(dist.values()))
    consensus = ("Strong Buy" if score < 1.6 else "Buy" if score < 2.5
                 else "Hold" if score < 3.5 else "Sell" if score < 4.5 else "Strong Sell")
    return {"consensus": consensus, "distribution": dist, "target": target}
```

`backend/services/news.py`:
```python
import logging
import cache
from mock import mock_news
from providers.finnhub import fetch_news

logger = logging.getLogger(__name__)


def get_news(sym=None):
    key = f"news:{sym or 'MARKET'}"
    try:
        val, _ = cache.cached(key, 900, lambda: fetch_news(sym))
        return val, "finnhub"
    except Exception as e:
        logger.warning("news fallback to mock for %s: %s", sym, e)
        return mock_news(sym), "mock"
```

`backend/services/ratings.py`:
```python
import logging
import cache
from mock import mock_ratings
from providers.finnhub import fetch_ratings

logger = logging.getLogger(__name__)


def get_ratings(sym):
    try:
        val, _ = cache.cached(f"ratings:{sym}", 21600, lambda: fetch_ratings(sym))
        return val, "finnhub"
    except Exception as e:
        logger.warning("ratings fallback to mock for %s: %s", sym, e)
        return mock_ratings(sym), "mock"
```

- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Commit** `feat(backend): finnhub provider + news/ratings services with mock fallback`.

---

### Task 3: News & ratings routes

**Files:** Modify `backend/app.py`; Create `backend/tests/test_news_routes.py`.

**Interfaces:**
- `GET /api/news?sym=AAPL` or `GET /api/news?market=1` → news list.
- `GET /api/ratings/<sym>` → ratings dict.

- [ ] **Step 1: Failing test** (`backend/tests/test_news_routes.py`):
```python
from app import app
import cache


def test_news_route_symbol(monkeypatch):
    cache.clear()
    import services.news as news
    monkeypatch.setattr(news, "fetch_news", lambda sym: (_ for _ in ()).throw(RuntimeError("no key")))
    r = app.test_client().get("/api/news?sym=AAPL")
    assert r.status_code == 200 and r.get_json()["data"]


def test_news_route_market(monkeypatch):
    cache.clear()
    import services.news as news
    monkeypatch.setattr(news, "fetch_news", lambda sym: (_ for _ in ()).throw(RuntimeError("no key")))
    r = app.test_client().get("/api/news?market=1")
    assert r.status_code == 200 and r.get_json()["data"]


def test_ratings_route(monkeypatch):
    cache.clear()
    import services.ratings as ratings
    monkeypatch.setattr(ratings, "fetch_ratings", lambda sym: (_ for _ in ()).throw(RuntimeError("no key")))
    r = app.test_client().get("/api/ratings/AAPL")
    d = r.get_json()["data"]
    assert d["target"]["low"] <= d["target"]["high"]


def test_ratings_invalid_symbol():
    assert app.test_client().get("/api/ratings/TOO_LONG_SYMBOL_X").status_code == 400
```

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement** — add to `backend/app.py` (after fng route):
```python
from services.news import get_news
from services.ratings import get_ratings


@app.route("/api/news")
def news_route():
    sym = request.args.get("sym")
    if sym:
        sym = sym.upper()
        if not valid_symbol(sym):
            return envelope({"error": "invalid symbol"}), 400
    data, source = get_news(sym)  # sym None → market news
    return envelope(data, source=source)


@app.route("/api/ratings/<sym>")
def ratings_route(sym):
    sym = sym.upper()
    if not valid_symbol(sym):
        return envelope({"error": "invalid symbol"}), 400
    data, source = get_ratings(sym)
    return envelope(data, source=source)
```

- [ ] **Step 4: Run full suite → PASS.**
- [ ] **Step 5: Commit** `feat(backend): news & analyst-ratings routes (finnhub + mock fallback)`.

---

## Milestone

`/api/news` and `/api/ratings/<sym>` serve real Finnhub data when
`FINNHUB_API_KEY` is set, deterministic mock otherwise. Full backend suite green.

## Self-Review

- **Spec coverage:** §3 `/api/news`, `/api/ratings` ✓; Finnhub as the one keyed provider ✓; mock fallback ✓.
- **Placeholder scan:** none.
- **Type consistency:** news item keys and ratings keys identical across mock, provider, service, route, tests. `valid_symbol` reused from app.
