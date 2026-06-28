"""
Signal history (F3) — the durable first-party moat.

A daily job snapshots each actively-watched symbol's Pulse into ``signal_snapshots``. Because the
series is captured live and never reconstructable from third-party APIs after the fact, it is the
asset that compounds: the longer the app runs, the more history it owns that competitors cannot
backfill. Surfaces as Pulse sparklines and "shifted N days ago" annotations.

Idempotent per (symbol, day): re-running a day upserts rather than duplicating.
"""
import datetime
import logging

import db
import models
import services.pulse as pulse

logger = logging.getLogger(__name__)


def _mood_from(p) -> str:
    for c in p.get("components", []):
        if c.get("key") == "sentiment":
            return c.get("state", "Neutral")
    return "Neutral"


def record_snapshots(day=None) -> int:
    """Snapshot today's Pulse for every distinct actively-watched symbol. Returns count written."""
    day = day or datetime.date.today()
    with db.get_session() as s:
        symbols = sorted({row[0] for row in s.query(models.WatchlistItem.symbol).distinct()})

    count = 0
    for sym in symbols:
        try:
            p = pulse.compute_pulse(sym)
        except Exception as e:
            logger.warning("snapshot skipped for %s: %s", sym, e)
            continue
        _upsert(sym, day, p)
        count += 1
    return count


def _upsert(sym, day, p):
    with db.get_session() as s:
        row = s.query(models.SignalSnapshot).filter_by(symbol=sym, date=day).one_or_none()
        if row is None:
            row = models.SignalSnapshot(symbol=sym, date=day)
            s.add(row)
        row.pulse_score = p.get("score", 0.0)
        row.pulse_band = p.get("band", "")
        row.sentiment_mood = _mood_from(p)
        row.price = p.get("price") or 0.0
        s.commit()


def get_signal_history(sym, days=30):
    """Return the recent Pulse series for a symbol, oldest-first."""
    sym = (sym or "").upper()
    cutoff = datetime.date.today() - datetime.timedelta(days=days)
    with db.get_session() as s:
        rows = (s.query(models.SignalSnapshot)
                .filter(models.SignalSnapshot.symbol == sym, models.SignalSnapshot.date >= cutoff)
                .order_by(models.SignalSnapshot.date)
                .all())
        return [{"date": r.date.isoformat(), "score": r.pulse_score, "band": r.pulse_band,
                 "mood": r.sentiment_mood, "price": r.price} for r in rows]
