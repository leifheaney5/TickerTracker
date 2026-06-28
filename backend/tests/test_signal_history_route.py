"""
TDD: /api/pulse/<SYM>/history route (F3) — serves the accrued Pulse series in the envelope.
"""
import services.signal_history as sh
from app import app


def test_history_route_returns_series(monkeypatch):
    monkeypatch.setattr(sh, "get_signal_history",
                        lambda sym, days=30: [{"date": "2026-06-27", "score": 55.0, "band": "Building"}])
    r = app.test_client().get("/api/pulse/AAPL/history")
    assert r.status_code == 200
    body = r.get_json()
    assert isinstance(body["data"], list)
    assert body["data"][0]["band"] == "Building"


def test_history_route_rejects_invalid_symbol():
    r = app.test_client().get("/api/pulse/THIS_IS_WAY_TOO_LONG/history")
    assert r.status_code == 400
