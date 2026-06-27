import logging
import cache
from mock import mock_news
from providers.finnhub import fetch_news

logger = logging.getLogger(__name__)


def get_news(sym=None):
    key = f"news:{sym or 'MARKET'}"
    try:
        val, _ = cache.cached(key, 900, lambda: fetch_news(sym))
        # Finnhub's free tier returns very little per-symbol company-news (often
        # zero). Rather than leave the panel empty, fall back to general market
        # news so there's always relevant content to show.
        if sym and not val:
            market, _ = cache.cached("news:MARKET", 900, lambda: fetch_news(None))
            return market, "finnhub"
        return val, "finnhub"
    except Exception as e:
        logger.warning("news fallback to mock for %s: %s", sym, e)
        return mock_news(sym), "mock"


def watchlist_sentiment(syms: list) -> dict:
    """Aggregate sentiment across up to 10 symbols and return a mood summary."""
    syms = syms[:10]
    bullish = 0
    bearish = 0
    neutral = 0

    for sym in syms:
        try:
            items, _ = get_news(sym)
            for item in items:
                s = item.get("sentiment", "")
                if s == "Bullish":
                    bullish += 1
                elif s == "Bearish":
                    bearish += 1
                elif s == "Neutral":
                    neutral += 1
        except Exception as e:
            logger.warning("watchlist_sentiment failed for %s: %s", sym, e)

    total = bullish + bearish + neutral

    if total == 0:
        mood = "Neutral"
    elif bullish > bearish and bullish >= neutral:
        mood = "Bullish"
    elif bearish > bullish and bearish >= neutral:
        mood = "Bearish"
    else:
        mood = "Neutral"

    return {"bullish": bullish, "bearish": bearish, "neutral": neutral, "total": total, "mood": mood}
