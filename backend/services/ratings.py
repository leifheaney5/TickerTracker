import logging
import cache
from mock import mock_ratings
from providers.finnhub import fetch_ratings

logger = logging.getLogger(__name__)


def get_ratings(sym):
    try:
        val, _ = cache.cached(f"ratings:{sym}", 21600, lambda: fetch_ratings(sym))
        return val, "finnhub"
    except Exception as e:
        logger.warning("ratings fallback to mock for %s: %s", sym, e)
        return mock_ratings(sym), "mock"
