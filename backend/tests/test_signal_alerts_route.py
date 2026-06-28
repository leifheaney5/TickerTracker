"""TDD: /api/pulse/<SYM>/signals route (F4) — active smart-signal conditions in the envelope."""
import services.signal_alerts as sa
from app import app


def _fake_eval(sym):
    return {"symbol": sym, "pulse": {"score": 80, "band": "Hot"},
            "conditions": [{"key": "near_target", "title": "Near analyst target", "detail": "..."}],
            "disclaimer": "not advice"}


def test_signals_route_returns_conditions(monkeypatch):
    monkeypatch.setattr(sa, "evaluate_signal_alerts", _fake_eval)
    r = app.test_client().get("/api/pulse/AAPL/signals")
    assert r.status_code == 200
    body = r.get_json()
    assert body["data"]["conditions"][0]["key"] == "near_target"


def test_signals_route_rejects_invalid_symbol():
    assert app.test_client().get("/api/pulse/TOO_LONG_SYMBOL_NAME/signals").status_code == 400
