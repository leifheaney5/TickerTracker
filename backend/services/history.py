import logging
import time
import cache
from mock import mock_history
from providers.yahoo import fetch_history

logger = logging.getLogger(__name__)


def _fetch_with_retry(sym, tf, tries=3):
    """Yahoo's unauthenticated endpoints rate-limit (429) under load. A couple of
    short backoff retries rides out transient throttling so we keep serving REAL
    candles instead of falling through to mock."""
    last = None
    for i in range(tries):
        try:
            return fetch_history(sym, tf)
        except Exception as e:
            last = e
            if i < tries - 1:
                time.sleep(0.4 * (i + 1))
    raise last


def get_history(sym, tf):
    """Return (bars, source, stale). On a live-refresh failure with a prior cached
    value, serve that value (stale-while-error) rather than fabricated mock bars."""
    try:
        val, stale = cache.cached(f"hist:{sym}:{tf}", 3600,
                                  lambda: _fetch_with_retry(sym, tf))
        return val, ("yahoo" if not stale else "yahoo-cache"), stale
    except Exception as e:
        logger.warning("history fallback to mock for %s/%s: %s", sym, tf, e)
        return mock_history(sym, tf), "mock", False
