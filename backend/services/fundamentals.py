import logging
import cache
from mock import mock_fundamentals
from providers.yahoo import fetch_fundamentals
from providers import finnhub as _finnhub

logger = logging.getLogger(__name__)


def _fetch(sym):
    """Real fundamentals, Yahoo first (richest), Finnhub free tier as a real
    fallback when Yahoo is rate-limited. Returns (data, source). Raises only if
    BOTH real sources fail — the caller then serves mock as a last resort."""
    try:
        return fetch_fundamentals(sym), "yahoo"
    except Exception as e:
        logger.info("yahoo fundamentals failed for %s (%s); trying finnhub", sym, e)
        return _finnhub.fetch_fundamentals(sym), "finnhub"


def get_fundamentals(sym):
    """Return (data, source, stale). `stale` is True when a cached value is served
    because a live refresh failed (stale-while-error)."""
    try:
        (val, src), stale = cache.cached(f"fund:{sym}", 3600, lambda: _fetch(sym))
        return val, (src if not stale else f"{src}-cache"), stale
    except Exception as e:
        logger.warning("fundamentals fallback to mock for %s: %s", sym, e)
        return mock_fundamentals(sym), "mock", False
