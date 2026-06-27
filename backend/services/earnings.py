import logging
import datetime as dt
import cache
from providers.finnhub import fetch_earnings

logger = logging.getLogger(__name__)


def get_earnings(syms: list) -> tuple:
    """Return (rows, source) for the next 30 days of earnings.

    If syms is non-empty, the cached list is filtered to those symbols
    (uppercase compare). On exception, returns ([], "mock") as a graceful
    fallback (there is no mock_earnings).
    """
    today = dt.date.today()
    frm = today.isoformat()
    to = (today + dt.timedelta(days=30)).isoformat()
    cache_key = f"earnings:{frm}:{to}"
    try:
        rows, _ = cache.cached(cache_key, 21600, lambda: fetch_earnings(frm, to))
        if syms:
            upper = [s.upper() for s in syms]
            rows = [r for r in rows if r.get("symbol", "").upper() in upper]
            # Diagnostic: distinguish "no upcoming report in window" (expected,
            # the common reason the calendar looks sparse) from a genuine data
            # gap. This is informational — a symbol with no earnings is NOT an
            # error, it just has nothing scheduled in the next 30 days.
            matched = {r.get("symbol", "").upper() for r in rows}
            missing = [s for s in upper if s not in matched]
            if missing:
                logger.info(
                    "earnings coverage %d/%d requested symbols have an upcoming "
                    "report (%s–%s); no report scheduled for: %s",
                    len(upper) - len(missing), len(upper), frm, to,
                    ", ".join(missing),
                )
        return rows, "finnhub"
    except Exception as e:
        logger.warning("earnings fallback to empty: %s", e)
        return [], "mock"
