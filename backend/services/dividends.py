"""Dividend tracking service.

Design
------
* ``project_dividends`` is a pure function (no I/O) that combines the user's
  current holdings with a pre-fetched map of dividend events. This makes it
  independently unit-testable without any DB or network fixtures.

* ``upcoming_dividends`` is the composition layer: it loads the user's holdings
  from the DB, calls the Yahoo provider (with 24-hour caching) for each held
  symbol, and delegates to the pure helper.

* Dividend events are sourced from Yahoo Finance via yahooquery. Failures are
  treated as non-fatal (return []) so a provider outage doesn't break the
  Holdings view.

* Cache TTL: 24 hours (dividends are rarely updated intra-day).
"""

import datetime as _dt
import logging

import cache
from mock import mock_dividends
from providers.yahoo import fetch_dividends

logger = logging.getLogger(__name__)

_DIV_TTL = 86_400  # 24 hours


# ── Pure helpers (no I/O; fully unit-tested) ─────────────────────────────────

def project_dividends(holdings: list[dict],
                      dividend_events: dict[str, list[dict]],
                      today: _dt.date) -> list[dict]:
    """Project dividend income for a user's holdings.

    Parameters
    ----------
    holdings:
        List of ``{symbol, shares}`` dicts (zero-share positions are included
        but will produce a total of 0.0 — callers may filter them out).
    dividend_events:
        Dict of ``symbol → list[{ex_date, pay_date, amount}]``.  Missing
        symbols yield no rows (treated as no dividend data available).
    today:
        The reference date used to determine ``status``
        (``'upcoming'`` when ``ex_date >= today``, else ``'paid'``).

    Returns
    -------
    List of rows ``{symbol, ex_date, pay_date, per_share, shares, total,
    status}`` sorted ascending by ``ex_date``.
    """
    rows: list[dict] = []
    for h in holdings:
        sym = h["symbol"]
        shares = h["shares"]
        events = dividend_events.get(sym, [])
        for ev in events:
            ex_date_str = ev["ex_date"]
            ex_date = _dt.date.fromisoformat(ex_date_str)
            status = "upcoming" if ex_date >= today else "paid"
            rows.append({
                "symbol": sym,
                "ex_date": ex_date_str,
                "pay_date": ev.get("pay_date"),
                "per_share": ev["amount"],
                "shares": shares,
                "total": round(ev["amount"] * shares, 2),
                "status": status,
            })
    rows.sort(key=lambda r: r["ex_date"])
    return rows


def annual_income_estimate(holdings: list[dict],
                           dividend_events: dict[str, list[dict]],
                           today: _dt.date) -> float:
    """Estimate the trailing-12-month dividend income across all held symbols.

    Only dividend events whose ``ex_date`` falls in the half-open window
    ``[today - 365 days, today)`` are included.  Upcoming dividends and events
    older than one year are excluded so the number reflects actually-received
    (or imminently-due) income.

    Returns 0.0 when no qualifying events exist.
    """
    cutoff = today - _dt.timedelta(days=365)
    total = 0.0
    for h in holdings:
        sym = h["symbol"]
        shares = h["shares"]
        for ev in dividend_events.get(sym, []):
            ex_date = _dt.date.fromisoformat(ev["ex_date"])
            if cutoff <= ex_date < today:
                total += ev["amount"] * shares
    return round(total, 2)


# ── Provider wrapper with caching ────────────────────────────────────────────

def _get_dividends_for_symbol(sym: str) -> list[dict]:
    """Fetch dividend events for a single symbol with 24-hour cache + mock fallback."""
    try:
        val, _stale = cache.cached(
            f"div:{sym}", _DIV_TTL, lambda: fetch_dividends(sym)
        )
        return val
    except Exception as exc:
        logger.warning("dividends fallback to mock for %s: %s", sym, exc)
        return mock_dividends(sym)


# ── Composed service ─────────────────────────────────────────────────────────

def upcoming_dividends(user_id: int) -> dict:
    """Return projected dividend rows and annual income estimate for a user.

    Loads the user's current holdings from the DB, fetches dividend events
    from Yahoo Finance (24h cached; mock on failure), and returns:

        {
          "rows": [{ symbol, ex_date, pay_date, per_share, shares, total, status }],
          "annual_income_estimate": <float>   # trailing-12-month income
        }

    ``status`` is ``"upcoming"`` when ex_date >= today, else ``"paid"``.
    Rows are sorted ascending by ex_date.
    """
    import db
    import models

    today = _dt.date.today()

    with db.get_session() as s:
        holdings_db = s.query(models.Holding).filter_by(user_id=user_id).all()
        holdings = [
            {"symbol": h.symbol, "shares": h.shares or 0.0}
            for h in holdings_db
            if (h.shares or 0.0) > 0
        ]

    if not holdings:
        return {"rows": [], "annual_income_estimate": 0.0}

    dividend_events: dict[str, list[dict]] = {}
    for h in holdings:
        sym = h["symbol"]
        dividend_events[sym] = _get_dividends_for_symbol(sym)

    rows = project_dividends(holdings, dividend_events, today)
    estimate = annual_income_estimate(holdings, dividend_events, today)

    return {"rows": rows, "annual_income_estimate": estimate}
