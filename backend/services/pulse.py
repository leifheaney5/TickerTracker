"""
Pulse composite score (F2) — the named moat metric.

Pulse blends several *independent* real signal types into a single transparent 0-100 score:

  momentum (RSI) · trend (SMA50/200 + MACD) · 52-week positioning · analyst consensus & target ·
  news-headline sentiment

Each input is an ordinary, explainable indicator computed from data we already fetch (no new
providers, no ML, no prediction). The score is honest *by construction*:

  - Every component carries its raw value, weight, and contribution — there is no black box.
  - A missing/unavailable signal is OMITTED and the remaining weights are renormalized, rather
    than zero-filled (which would falsely read as bearish). The score reflects only what we know.
  - Sentiment is labeled as news-headline-based, never implied to be NLP/ML.

Pulse is a summary of public signals, NOT investment advice — see ``DISCLAIMER``.
"""
import datetime
import logging

import services.history as history_svc
import services.fundamentals as fundamentals_svc
import services.ratings as ratings_svc
import services.news as news_svc
import services.indicators as ind

logger = logging.getLogger(__name__)

# Published weights (sum to 1.0 when all components are available).
WEIGHTS = {
    "momentum": 0.22,
    "trend": 0.22,
    "positioning": 0.18,
    "analyst": 0.20,
    "sentiment": 0.18,
}

# Quartile bands (canonical, matches the brand Pulse-dial color ramp).
def _band(score):
    if score >= 75:
        return "Hot"
    if score >= 50:
        return "Building"
    if score >= 25:
        return "Neutral"
    return "Cooling"


def _state(value):
    if value >= 60:
        return "Bullish"
    if value <= 40:
        return "Bearish"
    return "Neutral"


CONSENSUS_SCORE = {"Strong Buy": 100, "Buy": 75, "Hold": 50, "Sell": 25, "Strong Sell": 0}

DISCLAIMER = "Pulse is a transparent summary of public signals — not investment advice."


def _safe(fn, default=None):
    try:
        return fn()
    except Exception as e:  # any provider/service failure degrades one component, never the whole score
        logger.warning("pulse component failed: %s", e)
        return default


# ─── component builders: each returns (value 0-100, raw str) or None ──────────

def _momentum(closes):
    r = ind.rsi(closes, 14)
    if r is None:
        return None
    return r, f"RSI {r:.0f}"


def _trend(closes):
    t = ind.sma_trend(closes)
    m = ind.macd(closes)
    signals = []
    labels = []
    if t["above_sma50"] is not None:
        signals.append(t["above_sma50"]); labels.append("SMA50")
    if t["above_sma200"] is not None:
        signals.append(t["above_sma200"]); labels.append("SMA200")
    if m is not None:
        signals.append(m["hist"] > 0); labels.append("MACD")
    if not signals:
        return None
    bullish = sum(1 for s in signals if s)
    value = bullish / len(signals) * 100.0
    return value, f"{bullish}/{len(signals)} trend signals up ({', '.join(labels)})"


def _positioning(price, fund):
    if price is None or not fund:
        return None
    lo, hi = fund.get("week52_low"), fund.get("week52_high")
    if lo is None or hi is None:
        return None
    val = ind.range_position(price, lo, hi)
    if val is None:
        return None
    return val, f"{val:.0f}% of 52-week range"


def _analyst(ratings, price):
    if not ratings:
        return None
    parts = []
    cons = ratings.get("consensus")
    cons_score = CONSENSUS_SCORE.get(cons)
    if cons_score is not None:
        parts.append(cons_score)
    target = ratings.get("target") or {}
    mean = target.get("mean")
    current = target.get("current") or price
    upside = None
    if mean and current:
        upside = (mean - current) / current * 100.0
        parts.append(max(0.0, min(100.0, 50.0 + upside * 2.5)))  # +20% -> 100, -20% -> 0
    if not parts:
        return None
    value = sum(parts) / len(parts)
    raw = cons or "—"
    if upside is not None:
        raw = f"{raw}, {upside:+.0f}% to mean target"
    return value, raw


def _sentiment(news_items):
    bull = sum(1 for n in news_items if n.get("sentiment") == "Bullish")
    bear = sum(1 for n in news_items if n.get("sentiment") == "Bearish")
    neu = sum(1 for n in news_items if n.get("sentiment") == "Neutral")
    total = bull + bear + neu
    if total == 0:
        return None
    value = max(0.0, min(100.0, 50.0 + (bull - bear) / total * 50.0))
    return value, f"{bull}↑ {bear}↓ of {total} headlines"


def compute_pulse(sym):
    """Compute the Pulse composite for a stock symbol. Always returns a dict; never raises."""
    sym = (sym or "").upper()

    bars = _safe(lambda: history_svc.get_history(sym, "1Y")[0], default=[]) or []
    closes = [b["c"] for b in bars]
    price = closes[-1] if closes else None
    fund = _safe(lambda: fundamentals_svc.get_fundamentals(sym)[0], default={}) or {}
    ratings = _safe(lambda: ratings_svc.get_ratings(sym)[0], default={}) or {}
    news_items = _safe(lambda: news_svc.get_news(sym)[0], default=[]) or []

    components = []

    def add(key, label, result):
        if result is None:
            return
        value, raw = result
        components.append({
            "key": key, "label": label,
            "value": round(value, 1), "raw": raw,
            "state": _state(value), "weight": WEIGHTS[key],
        })

    add("momentum", "Momentum (RSI)", _safe(lambda: _momentum(closes)))
    add("trend", "Trend (SMA50/200 + MACD)", _safe(lambda: _trend(closes)))
    add("positioning", "52-week positioning", _safe(lambda: _positioning(price, fund)))
    add("analyst", "Analyst consensus & target", _safe(lambda: _analyst(ratings, price)))
    add("sentiment", "Sentiment (news-headline based)", _safe(lambda: _sentiment(news_items)))

    total_w = sum(c["weight"] for c in components)
    if total_w > 0:
        score = sum(c["value"] * c["weight"] for c in components) / total_w
        for c in components:
            c["weight"] = c["weight"] / total_w  # renormalize over available components
            c["contribution"] = round(c["value"] * c["weight"], 2)
    else:
        score = 50.0  # no signals available at all -> neutral, not a fabricated reading

    score = round(max(0.0, min(100.0, score)), 1)

    return {
        "symbol": sym,
        "score": score,
        "band": _band(score),
        "components": components,
        "price": price,
        "asOf": datetime.datetime.utcnow().isoformat() + "Z",
        "kind": "stock",
        "disclaimer": DISCLAIMER,
    }
