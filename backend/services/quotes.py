import logging
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, time as dt_time
try:
    from zoneinfo import ZoneInfo
except ImportError:
    ZoneInfo = None

import cache
from mock import mock_quote
from providers.yahoo import fetch_quote as yahoo_quote
from providers import finnhub

logger = logging.getLogger(__name__)


def _fetch_one(sym):
    """Return (quote_dict, source) for one symbol: Finnhub first (fast, no 429),
    then Yahoo, then deterministic mock. Cached per symbol for 60s."""
    def producer():
        # Finnhub primary — one fast call, reliable. Falls through to Yahoo.
        try:
            return finnhub.fetch_quote(sym), "finnhub"
        except Exception as e:
            logger.info("finnhub quote miss for %s (%s); trying yahoo", sym, e)
            return yahoo_quote(sym), "yahoo"
    try:
        (val, source), _ = cache.cached(f"quote:{sym}", 60, producer)
        return sym, val, source
    except Exception as e:
        logger.warning("quote fallback to mock for %s: %s", sym, e)
        return sym, mock_quote(sym), "mock"


def get_quotes(syms):
    """Fetch all symbols CONCURRENTLY. Returns (quotes_dict, overall_source).
    overall_source is 'mock' only if EVERY symbol fell back to mock (so the UI
    can flag stale/unavailable data); otherwise the best real source seen."""
    out = {}
    sources = set()
    if not syms:
        return out, "finnhub"
    with ThreadPoolExecutor(max_workers=min(10, len(syms))) as ex:
        for sym, val, source in ex.map(_fetch_one, syms):
            out[sym] = val
            sources.add(source)
    real = [s for s in sources if s != "mock"]
    overall = real[0] if real else "mock"
    return out, overall


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
