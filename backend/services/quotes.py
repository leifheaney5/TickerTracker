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
