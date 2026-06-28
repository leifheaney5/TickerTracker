import logging
import cache
from mock import mock_crypto, mock_fng
from providers.coingecko import fetch_crypto, search_coins, fetch_prices
from providers.fng import fetch_fng

logger = logging.getLogger(__name__)


def get_crypto(limit=50, extra_ids=()):
    extra = tuple(sorted(set(i for i in extra_ids if i)))
    key = f"crypto:{limit}:{','.join(extra)}"
    try:
        val, _ = cache.cached(key, 60, lambda: fetch_crypto(limit, extra))
        return val, "coingecko"
    except Exception as e:
        logger.warning("crypto fallback to mock: %s", e)
        return mock_crypto(limit, extra), "mock"


def get_crypto_search(q):
    key = f"crypto_search:{q.lower()}"
    try:
        val, _ = cache.cached(key, 300, lambda: search_coins(q))
        return val, "coingecko"
    except Exception as e:
        logger.warning("crypto search fallback: %s", e)
        return [], "mock"


def get_crypto_prices(ids):
    try:
        return fetch_prices(ids)
    except Exception as e:
        logger.warning("crypto prices failed: %s", e)
        return {}


def get_fng():
    try:
        val, _ = cache.cached("fng", 300, lambda: fetch_fng())
        return val, "alternative.me"
    except Exception as e:
        logger.warning("fng fallback to mock: %s", e)
        return mock_fng(), "mock"
