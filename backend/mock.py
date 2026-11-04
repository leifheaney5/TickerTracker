import datetime as _dt

_TF_BARS = {"1D": 78, "1W": 7, "1M": 22, "3M": 66, "1Y": 252, "5Y": 260}
_SECTORS = ["Technology", "Energy", "Financials", "Healthcare", "Consumer"]
_INDUSTRIES = ["Semiconductors", "Software", "Banks", "Oil & Gas", "Retail"]

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
    prev_close = round(price / (1 + change_pct / 100), 2)
    day_open = round(prev_close * (1 + (r() - 0.5) * 0.01), 2)
    day_high = round(max(price, day_open) * (1 + r() * 0.01), 2)
    day_low = round(min(price, day_open) * (1 - r() * 0.01), 2)
    volume = int((1 + r() * 220) * 1e6)
    return {"price": price, "change_pct": change_pct, "day_open": day_open,
            "day_high": day_high, "day_low": day_low, "prev_close": prev_close,
            "volume": volume}


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
        "website": "",
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


def mock_dividends(sym: str) -> list:
    """Deterministic mock dividend events for offline/test mode.

    Only a handful of well-known dividend payers have realistic entries; all
    others get an empty list so the "no dividends" path is also covered.
    NOTE: these are clearly mock values for testing — not real historical data.
    """
    _KNOWN = {
        # symbol: [(ex_date, pay_date, amount), ...]
        "AAPL": [
            ("2024-02-09", "2024-02-15", 0.24),
            ("2024-05-10", "2024-05-16", 0.25),
            ("2024-08-12", "2024-08-15", 0.25),
            ("2024-11-08", "2024-11-14", 0.25),
            ("2025-02-07", "2025-02-13", 0.25),
            ("2025-05-09", "2025-05-15", 0.26),
        ],
        "JNJ": [
            ("2024-02-20", "2024-03-05", 1.19),
            ("2024-05-21", "2024-06-04", 1.19),
            ("2024-08-20", "2024-09-03", 1.24),
            ("2024-11-19", "2024-12-03", 1.24),
            ("2025-02-18", "2025-03-04", 1.30),
            ("2025-05-20", "2025-06-03", 1.30),
        ],
        "KO": [
            ("2024-03-14", "2024-04-01", 0.485),
            ("2024-06-13", "2024-07-01", 0.485),
            ("2024-09-13", "2024-10-01", 0.485),
            ("2024-12-13", "2024-12-31", 0.485),
            ("2025-03-14", "2025-04-01", 0.51),
            ("2025-06-13", "2025-07-01", 0.51),
        ],
    }
    raw = _KNOWN.get(sym.upper(), [])
    return [
        {"ex_date": ex, "pay_date": pay, "amount": amt}
        for ex, pay, amt in raw
    ]


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
