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
