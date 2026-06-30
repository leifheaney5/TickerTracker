"""Portfolio-vs-benchmark normalized %-growth service.

HONESTY NOTE — current-holdings backtest
-----------------------------------------
This service computes "how would the portfolio have performed over period X?"
using *today's holdings* applied backwards across the historical window.  It
does NOT replay actual historical positions (we don't store those).  The route
and the UI both carry an explicit disclaimer label so users understand the
assumption.

Design
------
* ``normalize_pct`` and ``portfolio_value_series`` are pure functions (no I/O)
  so they can be independently unit-tested.
* ``portfolio_vs_benchmark`` is the composed service: it loads the user's
  holdings from the DB, calls ``history_fn(sym, tf)`` (injected so tests can
  stub it), aligns the two series, normalises both to % change from the first
  common point, and returns aligned arrays.
* History comes from ``services/history.py`` (Yahoo Finance, 1-hour cache) —
  benchmark ETFs (SPY/QQQ) go through the exact same path as any other symbol.
* Supported timeframes match Yahoo provider: 1M, 3M, 1Y, 5Y (weekly/monthly
  granularity — daily on the shorter ones).
"""

import logging

logger = logging.getLogger(__name__)


# ── Pure helpers (no I/O; fully unit-tested) ─────────────────────────────────

def normalize_pct(values: list[float]) -> list[float]:
    """Convert a price series to percent-change relative to the first point.

    Returns ``[]`` for an empty input.  Returns all zeros when the first value
    is zero (avoids division-by-zero; callers can treat this as "no data").
    """
    if not values:
        return []
    first = values[0]
    if first == 0:
        return [0.0] * len(values)
    return [round((v - first) / first * 100.0, 4) for v in values]


def portfolio_value_series(holdings: list[dict],
                           symbol_histories: dict[str, list[dict]]) -> list[tuple[str, float]]:
    """Compute a portfolio total-value series on the intersection of available dates.

    Parameters
    ----------
    holdings:
        List of ``{symbol, shares}`` dicts.
    symbol_histories:
        Dict of ``symbol → list[{date: str, c: float, ...}]`` (standard bar format).

    Returns
    -------
    List of ``(date_str, total_value)`` tuples sorted ascending by date.
    Dates where *any* holding lacks history are excluded (intersection semantics).
    Returns ``[]`` when holdings is empty or no common dates exist.
    """
    if not holdings:
        return []

    # Build date→close map for each held symbol.
    sym_date_close: dict[str, dict[str, float]] = {}
    for h in holdings:
        sym = h["symbol"]
        bars = symbol_histories.get(sym, [])
        sym_date_close[sym] = {bar["date"]: float(bar["c"]) for bar in bars}

    # Intersection of dates across ALL symbols.
    date_sets = [set(dc.keys()) for dc in sym_date_close.values()]
    if not date_sets:
        return []
    common_dates = sorted(set.intersection(*date_sets))

    result: list[tuple[str, float]] = []
    for d in common_dates:
        total = sum(
            sym_date_close[h["symbol"]].get(d, 0.0) * h["shares"]
            for h in holdings
        )
        result.append((d, round(total, 2)))

    return result


# ── Composed service ─────────────────────────────────────────────────────────

_VALID_INDICES = {"SPY", "QQQ"}


def portfolio_vs_benchmark(user_id: int, tf: str, index: str,
                           history_fn=None) -> dict:
    """Build a normalized %-growth overlay: portfolio vs benchmark ETF.

    CURRENT-HOLDINGS BACKTEST: applies today's position sizes retroactively
    across the historical window.  The response always carries a ``disclaimer``
    field; the UI must display it.

    Parameters
    ----------
    user_id : int
    tf : str
        Timeframe string (e.g. ``"1Y"``).  Validated by the route before this
        is called.
    index : str
        ``"SPY"`` or ``"QQQ"`` (validated by the route).
    history_fn : callable, optional
        ``history_fn(symbol, tf) -> (bars, source, stale)``.  Defaults to
        ``services.history.get_history``.  Injected for testing.

    Returns
    -------
    dict with keys:
        ``dates``, ``portfolio_pct``, ``benchmark_pct``, ``index``,
        ``disclaimer``
    All lists are the same length and aligned by date.
    Returns empty lists when the user has no holdings or data is unavailable.
    """
    if history_fn is None:
        from services.history import get_history
        history_fn = get_history

    import db
    import models

    with db.get_session() as s:
        holdings_db = s.query(models.Holding).filter_by(user_id=user_id).all()
        holdings = [
            {"symbol": h.symbol, "shares": h.shares or 0.0}
            for h in holdings_db
            if (h.shares or 0.0) > 0
        ]

    DISCLAIMER = (
        "Current-holdings backtest: assumes today's positions were held "
        "over the entire period. Historical trades are not reflected."
    )

    if not holdings:
        return {
            "dates": [], "portfolio_pct": [], "benchmark_pct": [],
            "index": index, "disclaimer": DISCLAIMER,
        }

    # Fetch history for every held symbol (Yahoo, cached 1h by get_history).
    symbol_histories: dict[str, list[dict]] = {}
    for h in holdings:
        sym = h["symbol"]
        try:
            bars, _src, _stale = history_fn(sym, tf)
            symbol_histories[sym] = bars
        except Exception as exc:
            logger.warning("benchmark: failed to fetch history for %s: %s", sym, exc)
            symbol_histories[sym] = []

    # Portfolio value series on the intersection of holding dates.
    pv_series = portfolio_value_series(holdings, symbol_histories)
    if not pv_series:
        return {
            "dates": [], "portfolio_pct": [], "benchmark_pct": [],
            "index": index, "disclaimer": DISCLAIMER,
        }

    pv_dict: dict[str, float] = {d: v for d, v in pv_series}

    # Fetch benchmark history (same path; also cached 1h).
    try:
        bm_bars, _src, _stale = history_fn(index, tf)
    except Exception as exc:
        logger.warning("benchmark: failed to fetch %s history: %s", index, exc)
        bm_bars = []

    bm_date_close: dict[str, float] = {b["date"]: float(b["c"]) for b in bm_bars}

    # Align to dates common to BOTH portfolio series AND benchmark.
    common_dates = sorted(d for d in pv_dict if d in bm_date_close)
    if not common_dates:
        return {
            "dates": [], "portfolio_pct": [], "benchmark_pct": [],
            "index": index, "disclaimer": DISCLAIMER,
        }

    pv_values = [pv_dict[d] for d in common_dates]
    bm_values = [bm_date_close[d] for d in common_dates]

    portfolio_pct = normalize_pct(pv_values)
    benchmark_pct = normalize_pct(bm_values)

    return {
        "dates": common_dates,
        "portfolio_pct": portfolio_pct,
        "benchmark_pct": benchmark_pct,
        "index": index,
        "disclaimer": DISCLAIMER,
    }
