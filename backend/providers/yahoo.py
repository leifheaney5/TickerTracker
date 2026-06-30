import logging
from yahooquery import Ticker

logger = logging.getLogger(__name__)

_TF_PERIOD = {"1D": ("1d", "5m"), "5D": ("5d", "15m"), "1W": ("7d", "1d"),
              "1M": ("1mo", "1d"), "3M": ("3mo", "1d"), "1Y": ("1y", "1wk"),
              "5Y": ("5y", "1mo"), "YTD": ("ytd", "1d"), "MAX": ("max", "1mo")}


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
        "prev_close": round(float(price_data.get("regularMarketPreviousClose", price) or price), 2),
        "volume": int(price_data.get("regularMarketVolume", 0) or 0),
    }


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


def domain_from_url(url: str | None) -> str:
    """Reduce a company website URL to its bare host (no scheme/www/path).

    Used for the logo favicon lookup; returns "" for empty input so callers can
    treat "unknown domain" uniformly.
    """
    import re
    v = (url or "").strip()
    if not v:
        return ""
    v = re.sub(r"^[a-z]+://", "", v, flags=re.I)
    v = re.sub(r"^www\.", "", v, flags=re.I)
    v = re.split(r"[/?#]", v, 1)[0]
    return v.lower()


def fetch_dividends(sym: str) -> list:
    """Fetch dividend events for sym from Yahoo Finance.

    Returns a list of dicts: {ex_date: str, pay_date: str|None, amount: float}.
    Dividend events from the trailing ~2 years plus the upcoming ex-dividend date
    from summary metadata (if different from the most-recent historical event).
    Returns [] for non-dividend payers or on any error — treat failure as non-fatal.
    """
    import datetime as _dt2
    try:
        t = Ticker(sym)
        events: list[dict] = []

        # Historical dividends via OHLCV history (2-year trailing window).
        # yahooquery includes a 'dividends' column with non-zero values on ex-dates.
        df = t.history(period="2y", interval="1d")
        if df is not None and not df.empty and "dividends" in df.columns:
            div_df = df[df["dividends"] > 0]
            for idx, row in div_df.iterrows():
                d = idx[1] if isinstance(idx, tuple) else idx
                events.append({
                    "ex_date": str(d)[:10],
                    "pay_date": None,  # historical records don't carry pay_date
                    "amount": round(float(row["dividends"]), 4),
                })

        # Upcoming / most-recent ex-dividend from summary metadata.
        summary = t.summary_detail.get(sym, {})
        if isinstance(summary, dict):
            ex_raw = summary.get("exDividendDate")
            pay_raw = summary.get("dividendDate")
            div_rate = summary.get("dividendRate") or 0.0

            if ex_raw:
                # yahooquery can return a Unix timestamp (int/float) or a date-like.
                if isinstance(ex_raw, (int, float)):
                    ex_date = _dt2.datetime.fromtimestamp(
                        float(ex_raw), tz=_dt2.timezone.utc).strftime("%Y-%m-%d")
                else:
                    ex_date = str(ex_raw)[:10]

                if pay_raw:
                    if isinstance(pay_raw, (int, float)):
                        pay_date = _dt2.datetime.fromtimestamp(
                            float(pay_raw), tz=_dt2.timezone.utc).strftime("%Y-%m-%d")
                    else:
                        pay_date = str(pay_raw)[:10]
                else:
                    pay_date = None

                # Derive per-event amount: prefer the most-recent historical quarterly
                # dividend; fall back to annual rate / 4 (assumes quarterly payer).
                if events:
                    amount = events[-1]["amount"]
                elif div_rate:
                    amount = round(float(div_rate) / 4, 4)
                else:
                    amount = 0.0

                existing_dates = {e["ex_date"] for e in events}
                if ex_date not in existing_dates and amount > 0:
                    events.append({"ex_date": ex_date, "pay_date": pay_date, "amount": amount})

        events.sort(key=lambda e: e["ex_date"])
        return events
    except Exception:
        return []


def fetch_fundamentals(sym: str) -> dict:
    t = Ticker(sym)
    summary = t.summary_detail.get(sym, {})
    keystats = t.key_stats.get(sym, {})
    profile = t.asset_profile.get(sym, {})
    if not isinstance(summary, dict) or not summary:
        raise RuntimeError(f"no fundamentals for {sym}")
    if not isinstance(keystats, dict):
        keystats = {}
    if not isinstance(profile, dict):
        profile = {}
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
        "website": domain_from_url(profile.get("website")),
    }
