import logging
import cache
from mock import mock_fundamentals
from providers.yahoo import fetch_fundamentals

logger = logging.getLogger(__name__)


def get_fundamentals(sym):
    try:
        val, _ = cache.cached(f"fund:{sym}", 3600, lambda: fetch_fundamentals(sym))
        return val, "yahoo"
    except Exception as e:
        logger.warning("fundamentals fallback to mock for %s: %s", sym, e)
        return mock_fundamentals(sym), "mock"
