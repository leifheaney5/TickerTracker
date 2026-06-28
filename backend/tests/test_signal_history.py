"""
TDD: Signal history (F3) — the durable, un-backfillable first-party moat.

A daily job snapshots each actively-watched symbol's Pulse so the app accrues a private
time-series no competitor can reconstruct after the fact. Tests assert:
  - one snapshot per distinct watched symbol per day,
  - idempotency (re-running the same day upserts, never duplicates),
  - a new day appends a new point,
  - get_signal_history returns an ordered, shaped series.

Pulse is monkeypatched — the unit under test is the snapshot/accrual logic, not the score.
"""
import datetime

import db
import models
import services.signal_history as sh


def _seed_watch(symbols):
    with db.get_session() as s:
        u = models.User(email="w@x.com", name="W")
        s.add(u)
        s.flush()
        for i, sym in enumerate(symbols):
            s.add(models.WatchlistItem(user_id=u.id, symbol=sym, position=i))
        s.commit()


def _fake_pulse(sym):
    # deterministic per-symbol score
    score = 40.0 + (sum(ord(c) for c in sym) % 30)
    return {"symbol": sym, "score": score, "band": "Neutral",
            "components": [{"key": "sentiment", "label": "Sentiment (news-headline based)",
                            "value": 60, "raw": "2↑ 0↓ of 2 headlines", "state": "Bullish", "weight": 1.0}],
            "price": 123.45, "asOf": "x", "kind": "stock", "disclaimer": "not advice"}


def test_records_one_snapshot_per_watched_symbol(monkeypatch):
    _seed_watch(["AAPL", "MSFT", "AAPL"])  # duplicate across users collapses to distinct
    monkeypatch.setattr(sh.pulse, "compute_pulse", _fake_pulse)
    n = sh.record_snapshots(day=datetime.date(2026, 6, 28))
    assert n == 2
    with db.get_session() as s:
        rows = s.query(models.SignalSnapshot).all()
        assert {r.symbol for r in rows} == {"AAPL", "MSFT"}
        assert all(r.date == datetime.date(2026, 6, 28) for r in rows)


def test_snapshot_is_idempotent_per_day(monkeypatch):
    _seed_watch(["AAPL"])
    monkeypatch.setattr(sh.pulse, "compute_pulse", _fake_pulse)
    sh.record_snapshots(day=datetime.date(2026, 6, 28))
    sh.record_snapshots(day=datetime.date(2026, 6, 28))  # same day again
    with db.get_session() as s:
        rows = s.query(models.SignalSnapshot).filter_by(symbol="AAPL").all()
        assert len(rows) == 1  # upserted, not duplicated


def test_new_day_appends_point(monkeypatch):
    _seed_watch(["AAPL"])
    monkeypatch.setattr(sh.pulse, "compute_pulse", _fake_pulse)
    sh.record_snapshots(day=datetime.date(2026, 6, 27))
    sh.record_snapshots(day=datetime.date(2026, 6, 28))
    hist = sh.get_signal_history("AAPL", days=365)
    assert len(hist) == 2
    assert hist[0]["date"] == "2026-06-27"
    assert hist[1]["date"] == "2026-06-28"
    assert "score" in hist[0] and "band" in hist[0]


def test_snapshot_stores_price_and_mood(monkeypatch):
    _seed_watch(["AAPL"])
    monkeypatch.setattr(sh.pulse, "compute_pulse", _fake_pulse)
    sh.record_snapshots(day=datetime.date(2026, 6, 28))
    with db.get_session() as s:
        row = s.query(models.SignalSnapshot).filter_by(symbol="AAPL").one()
        assert row.price == 123.45
        assert row.sentiment_mood == "Bullish"
