import logging
import cache
from mock import mock_news
from providers.finnhub import fetch_news

logger = logging.getLogger(__name__)


def get_news(sym=None):
    key = f"news:{sym or 'MARKET'}"
    try:
        val, _ = cache.cached(key, 900, lambda: fetch_news(sym))
        return val, "finnhub"
    except Exception as e:
        logger.warning("news fallback to mock for %s: %s", sym, e)
        return mock_news(sym), "mock"
