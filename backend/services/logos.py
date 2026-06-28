import logging
from concurrent.futures import ThreadPoolExecutor

import cache
from providers import finnhub

logger = logging.getLogger(__name__)

# Brand logos change very rarely; cache each symbol for a week so we don't burn
# Finnhub's rate limit re-fetching logos on every poll.
_LOGO_TTL = 60 * 60 * 24 * 7


def _fetch_one(sym):
    def producer():
        return finnhub.fetch_logo(sym)
    try:
        url, _ = cache.cached(f"logo:{sym}", _LOGO_TTL, producer)
        return sym, url
    except Exception as e:
        logger.info("logo miss for %s: %s", sym, e)
        return sym, ""


def get_logos(syms):
    """Map each symbol to its Finnhub brand-logo URL, fetched concurrently and
    cached per symbol. Symbols with no logo (or a provider error) are omitted so
    the frontend falls back to its favicon/monogram chain."""
    out = {}
    if not syms:
        return out
    with ThreadPoolExecutor(max_workers=min(10, len(syms))) as ex:
        for sym, url in ex.map(_fetch_one, syms):
            if url:
                out[sym] = url
    return out
