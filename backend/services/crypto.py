import logging
import cache
from mock import mock_crypto, mock_fng
from providers.coingecko import fetch_crypto
from providers.fng import fetch_fng

logger = logging.getLogger(__name__)


def get_crypto():
    try:
        val, _ = cache.cached("crypto", 60, lambda: fetch_crypto())
        return val, "coingecko"
    except Exception as e:
        logger.warning("crypto fallback to mock: %s", e)
        return mock_crypto(), "mock"


def get_fng():
    try:
        val, _ = cache.cached("fng", 300, lambda: fetch_fng())
        return val, "alternative.me"
    except Exception as e:
        logger.warning("fng fallback to mock: %s", e)
        return mock_fng(), "mock"
