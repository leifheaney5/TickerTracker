"""
Technical indicators (F1) — pure functions over close/volume arrays.

The foundation for the Pulse signal layer. Everything here is deterministic, takes no
network/DB, and returns ``None`` (never raises) on insufficient data, so callers can degrade
gracefully. Inputs are plain float lists (the ``c`` / ``v`` fields of history bars from
``services/history.py``), oldest-first.

These are standard, transparent formulas — no proprietary "magic." That transparency is the
point: Pulse is honest precisely because each input here is an ordinary, explainable indicator.
"""
import math


def sma(values, n):
    """Simple moving average of the last ``n`` values, or None if too few."""
    if not values or n <= 0 or len(values) < n:
        return None
    return sum(values[-n:]) / n


def ema(values, n):
    """Exponential moving average (SMA-seeded), or None if fewer than ``n`` values."""
    series = _ema_series(values, n)
    return series[-1] if series else None


def _ema_series(values, n):
    """EMA values aligned to index ``n-1`` onward (seeded with the SMA of the first n)."""
    if not values or n <= 0 or len(values) < n:
        return []
    k = 2.0 / (n + 1.0)
    e = sum(values[:n]) / n
    out = [e]
    for v in values[n:]:
        e = v * k + e * (1.0 - k)
        out.append(e)
    return out


def rsi(closes, period=14):
    """Wilder's RSI (0-100), or None if fewer than ``period+1`` closes.

    With exactly ``period+1`` closes the result is the simple-average seed (no smoothing
    iterations yet), which keeps the formula hand-verifiable.
    """
    if not closes or period <= 0 or len(closes) < period + 1:
        return None
    gains, losses = [], []
    for i in range(1, len(closes)):
        change = closes[i] - closes[i - 1]
        gains.append(max(change, 0.0))
        losses.append(max(-change, 0.0))
    avg_gain = sum(gains[:period]) / period
    avg_loss = sum(losses[:period]) / period
    for i in range(period, len(gains)):
        avg_gain = (avg_gain * (period - 1) + gains[i]) / period
        avg_loss = (avg_loss * (period - 1) + losses[i]) / period
    if avg_loss == 0:
        return 100.0 if avg_gain > 0 else 50.0
    rs = avg_gain / avg_loss
    return 100.0 - 100.0 / (1.0 + rs)


def macd(closes, fast=12, slow=26, signal=9):
    """MACD line, signal line, and histogram. None if too few closes.

    Returns ``{"macd", "signal", "hist"}``. MACD = EMA(fast) - EMA(slow);
    signal = EMA(MACD line, signal); hist = MACD - signal.
    """
    if not closes or len(closes) < slow + signal:
        return None
    fast_series = _ema_series(closes, fast)
    slow_series = _ema_series(closes, slow)
    # Align the fast series to the slow series' start index (slow-1).
    offset = slow - fast
    fast_aligned = fast_series[offset:]
    macd_line = [f - s for f, s in zip(fast_aligned, slow_series)]
    signal_series = _ema_series(macd_line, signal)
    if not signal_series:
        return None
    macd_val = macd_line[-1]
    signal_val = signal_series[-1]
    return {"macd": macd_val, "signal": signal_val, "hist": macd_val - signal_val}


def bollinger(closes, n=20, k=2):
    """Bollinger bands + %B (0-100). None if fewer than ``n`` closes.

    %B is the last price's position within the band; a zero-width band (flat series)
    yields a neutral 50.0 by convention.
    """
    if not closes or n <= 0 or len(closes) < n:
        return None
    window = closes[-n:]
    mid = sum(window) / n
    var = sum((x - mid) ** 2 for x in window) / n  # population variance
    std = math.sqrt(var)
    upper = mid + k * std
    lower = mid - k * std
    width = upper - lower
    price = closes[-1]
    pct_b = 50.0 if width == 0 else (price - lower) / width * 100.0
    return {"mid": mid, "upper": upper, "lower": lower, "pct_b": pct_b}


def range_position(price, low, high):
    """Where ``price`` sits in the [low, high] range as 0-100, clamped. None if low == high."""
    if high == low:
        return None
    pos = (price - low) / (high - low) * 100.0
    return max(0.0, min(100.0, pos))


def volume_ratio(volumes, n=20):
    """Latest volume relative to the average of the prior ``n``. None if too few / zero avg."""
    if not volumes or n <= 0 or len(volumes) < n + 1:
        return None
    prior = volumes[-n - 1:-1]
    avg = sum(prior) / n
    if avg == 0:
        return None
    return volumes[-1] / avg


def sma_trend(closes):
    """Price vs SMA50/SMA200. Each leg is None when its SMA can't be computed yet."""
    price = closes[-1] if closes else None
    s50 = sma(closes, 50)
    s200 = sma(closes, 200)
    above50 = (price > s50) if (s50 is not None and price is not None) else None
    above200 = (price > s200) if (s200 is not None and price is not None) else None
    return {"sma50": s50, "sma200": s200, "above_sma50": above50, "above_sma200": above200}
