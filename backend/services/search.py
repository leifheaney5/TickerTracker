import logging

import cache
from providers import finnhub

logger = logging.getLogger(__name__)


def search(query: str):
    """Search symbols across the whole market via Finnhub (not a fixed universe).
    Cached 1h per query. Returns (results, source); results is a list of
    {symbol, description, type}. Falls back to an empty list if Finnhub is
    unavailable (no key / error)."""
    q = (query or "").strip()
    if len(q) < 1:
        return [], "finnhub"
    try:
        val, _ = cache.cached(f"search:{q.lower()}", 3600, lambda: finnhub.search_symbols(q))
        return val, "finnhub"
    except Exception as e:
        logger.warning("symbol search failed for %r: %s", q, e)
        return [], "mock"
