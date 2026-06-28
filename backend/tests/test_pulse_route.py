"""
TDD: /api/pulse/<SYM> route (F2). Wraps compute_pulse in the standard envelope.
"""
import services.pulse as pulse
from app import app


def _fake_pulse(sym):
    return {
        "symbol": sym, "score": 61.0, "band": "Building",
        "components": [{"key": "momentum", "label": "Momentum (RSI)", "value": 58.0,
                        "raw": "RSI 58", "state": "Neutral", "weight": 1.0, "contribution": 58.0}],
        "asOf": "2026-06-28T00:00:00Z", "kind": "stock",
        "disclaimer": "Pulse is a transparent summary of public signals — not investment advice.",
    }


def test_pulse_route_returns_envelope(monkeypatch):
    monkeypatch.setattr(pulse, "compute_pulse", _fake_pulse)
    r = app.test_client().get("/api/pulse/AAPL")
    assert r.status_code == 200
    body = r.get_json()
    assert "data" in body and "meta" in body
    assert body["data"]["symbol"] == "AAPL"
    assert body["data"]["band"] == "Building"
    assert isinstance(body["data"]["components"], list)


def test_pulse_route_uppercases_symbol(monkeypatch):
    monkeypatch.setattr(pulse, "compute_pulse", _fake_pulse)
    r = app.test_client().get("/api/pulse/aapl")
    assert r.get_json()["data"]["symbol"] == "AAPL"


def test_pulse_route_rejects_invalid_symbol():
    r = app.test_client().get("/api/pulse/THIS_IS_WAY_TOO_LONG")
    assert r.status_code == 400
