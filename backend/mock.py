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
