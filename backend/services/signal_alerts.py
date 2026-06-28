"""
Smart / divergence signal alerts (F4).

Beyond commodity price-threshold alerts, this surfaces *named, explainable* conditions that need
more than one signal to agree — exactly the "double-confirmation" insight retail returns for. The
detection rule set is a PURE function (``detect_signal_conditions``) so it's deterministic and
fully testable; ``evaluate_signal_alerts`` assembles a symbol's context from the real services.

Every condition is honest: it names the signals that fired and the reading behind them. None of
this is advice — it's "here is something worth a look, and here's exactly why."
"""
import logging

import services.pulse as pulse
import services.ratings as ratings_svc
import services.history as history_svc
import services.news as news_svc
import services.signal_history as signal_history
import services.indicators as ind

logger = logging.getLogger(__name__)

NEAR_TARGET_PCT = 3.0       # within this % of the mean analyst target
OVERBOUGHT = 70.0
OVERSOLD = 30.0
DIVERGENCE_RETURN_PCT = 5.0  # |recent return| beyond this, against sentiment, is a divergence

_BAND_RANK = {"Cooling": 0, "Neutral": 1, "Building": 2, "Hot": 3}


def detect_signal_conditions(ctx) -> list:
    """Pure detector. ``ctx`` carries the current readings; returns active named conditions."""
    out = []
    rsi = ctx.get("rsi")
    sentiment = ctx.get("sentiment", "Neutral")
    price = ctx.get("price")
    target = ctx.get("target_mean")
    band = ctx.get("band")
    prev_band = ctx.get("prev_band")
    ret = ctx.get("recent_return_pct")

    if price and target:
        dist = abs(target - price) / price * 100.0
        if dist <= NEAR_TARGET_PCT:
            out.append({
                "key": "near_target", "title": "Near analyst target",
                "detail": f"Price ${price:,.2f} is within {dist:.1f}% of the ${target:,.2f} mean analyst target.",
            })

    if rsi is not None and rsi >= OVERBOUGHT and sentiment == "Bearish":
        out.append({
            "key": "overbought_bearish", "title": "Overbought + bearish news",
            "detail": f"RSI {rsi:.0f} is overbought while news-headline sentiment is bearish.",
        })

    if rsi is not None and rsi <= OVERSOLD and sentiment == "Bullish":
        out.append({
            "key": "oversold_bullish", "title": "Oversold + bullish news",
            "detail": f"RSI {rsi:.0f} is oversold while news-headline sentiment is bullish.",
        })

    if band and prev_band and band != prev_band:
        up = _BAND_RANK.get(band, 1) > _BAND_RANK.get(prev_band, 1)
        out.append({
            "key": "pulse_band_up" if up else "pulse_band_down",
            "title": "Pulse heating up" if up else "Pulse cooling down",
            "detail": f"Pulse band moved from {prev_band} to {band}.",
        })

    if ret is not None:
        if ret >= DIVERGENCE_RETURN_PCT and sentiment == "Bearish":
            out.append({
                "key": "price_sentiment_divergence", "title": "Price / sentiment divergence",
                "detail": f"Price is up {ret:.1f}% recently while news-headline sentiment is bearish.",
            })
        elif ret <= -DIVERGENCE_RETURN_PCT and sentiment == "Bullish":
            out.append({
                "key": "price_sentiment_divergence", "title": "Price / sentiment divergence",
                "detail": f"Price is down {abs(ret):.1f}% recently while news-headline sentiment is bullish.",
            })

    return out


def _sentiment_mood(news_items) -> str:
    bull = sum(1 for n in news_items if n.get("sentiment") == "Bullish")
    bear = sum(1 for n in news_items if n.get("sentiment") == "Bearish")
    if bull > bear:
        return "Bullish"
    if bear > bull:
        return "Bearish"
    return "Neutral"


def _safe(fn, default=None):
    try:
        return fn()
    except Exception as e:
        logger.warning("signal_alerts context fetch failed: %s", e)
        return default


def evaluate_signal_alerts(sym) -> dict:
    """Assemble a symbol's real signal context and return its active conditions + the Pulse."""
    sym = (sym or "").upper()
    p = _safe(lambda: pulse.compute_pulse(sym), default={"band": "Neutral", "price": None, "score": 50.0})

    bars = _safe(lambda: history_svc.get_history(sym, "1Y")[0], default=[]) or []
    closes = [b["c"] for b in bars]
    rsi = ind.rsi(closes, 14) if closes else None

    ratings = _safe(lambda: ratings_svc.get_ratings(sym)[0], default={}) or {}
    target_mean = (ratings.get("target") or {}).get("mean")

    news_items = _safe(lambda: news_svc.get_news(sym)[0], default=[]) or []
    sentiment = _sentiment_mood(news_items)

    # recent return over the snapshot history (price-based), if we have >= 2 points
    hist = _safe(lambda: signal_history.get_signal_history(sym, days=14), default=[]) or []
    recent_return = None
    if len(hist) >= 2 and hist[0].get("price"):
        first = hist[0]["price"]
        last = hist[-1].get("price") or p.get("price")
        if first and last:
            recent_return = (last - first) / first * 100.0
    prev_band = hist[-2]["band"] if len(hist) >= 2 else None

    ctx = {
        "rsi": rsi, "sentiment": sentiment, "price": p.get("price"),
        "target_mean": target_mean, "band": p.get("band"), "prev_band": prev_band,
        "recent_return_pct": recent_return,
    }
    return {
        "symbol": sym,
        "pulse": {"score": p.get("score"), "band": p.get("band")},
        "conditions": detect_signal_conditions(ctx),
        "disclaimer": "Signal alerts highlight notable multi-signal conditions — not investment advice.",
    }
