import os
import datetime as dt
import requests

_BASE = "https://finnhub.io/api/v1"


def _key():
    k = os.environ.get("FINNHUB_API_KEY")
    if not k:
        raise RuntimeError("FINNHUB_API_KEY not set")
    return k


def fetch_quote(sym: str) -> dict:
    """One fast Finnhub /quote call. Returns the standard quote shape, or raises."""
    key = _key()
    r = requests.get(f"{_BASE}/quote", params={"symbol": sym, "token": key}, timeout=8)
    r.raise_for_status()
    j = r.json()
    price = j.get("c")
    # Finnhub returns c=0 for unknown/invalid symbols.
    if not price:
        raise RuntimeError(f"no Finnhub quote for {sym}")
    return {
        "price": round(float(price), 2),
        "change_pct": round(float(j.get("dp") or 0), 2),
        "day_open": round(float(j.get("o") or price), 2),
        "day_high": round(float(j.get("h") or price), 2),
        "day_low": round(float(j.get("l") or price), 2),
        "prev_close": round(float(j.get("pc") or price), 2),
        "volume": 0,  # Finnhub /quote doesn't include volume; filled by fundamentals elsewhere
    }


def search_symbols(query: str) -> list:
    """Symbol search across the market (not a fixed universe). Returns a list of
    {symbol, description, type}. Raises without a key."""
    key = _key()
    r = requests.get(f"{_BASE}/search", params={"q": query, "token": key}, timeout=8)
    r.raise_for_status()
    rows = r.json().get("result", []) or []
    out = []
    for x in rows:
        sym = x.get("symbol", "")
        if not sym:
            continue
        out.append({
            "symbol": sym,
            "description": x.get("description", ""),
            "type": x.get("type", ""),
        })
    return out[:20]


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


def fetch_earnings(frm: str, to: str) -> list:
    """Fetch the Finnhub earnings calendar for the given date window.

    Returns a list of dicts with keys: symbol, date, hour, epsEstimate.
    Rows without a symbol are skipped.
    """
    key = _key()
    r = requests.get(f"{_BASE}/calendar/earnings",
                     params={"from": frm, "to": to, "token": key}, timeout=10)
    r.raise_for_status()
    rows = r.json().get("earningsCalendar", []) or []
    out = []
    for x in rows:
        sym = x.get("symbol", "")
        if not sym:
            continue
        out.append({
            "symbol": sym,
            "date": x.get("date", ""),
            "hour": x.get("hour", ""),
            "epsEstimate": x.get("epsEstimate"),
        })
    return out


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
