import services.history as h
import services.fundamentals as f
import cache


def test_history_fallback_to_mock(monkeypatch):
    cache.clear()
    monkeypatch.setattr(h, "fetch_history", lambda s, tf: (_ for _ in ()).throw(RuntimeError("down")))
    bars, source = h.get_history("AAPL", "1M")
    assert len(bars) == 22 and source == "mock"
    assert all(k in bars[0] for k in ("date", "o", "h", "l", "c", "v"))


def test_history_uses_provider(monkeypatch):
    cache.clear()
    sample = [{"date": "2026-06-25", "o": 1, "h": 2, "l": 0.5, "c": 1.5, "v": 10}]
    monkeypatch.setattr(h, "fetch_history", lambda s, tf: sample)
    bars, source = h.get_history("AAPL", "1M")
    assert bars == sample and source == "yahoo"


def test_fundamentals_fallback_to_mock(monkeypatch):
    cache.clear()
    monkeypatch.setattr(f, "fetch_fundamentals", lambda s: (_ for _ in ()).throw(RuntimeError("down")))
    data, source = f.get_fundamentals("AAPL")
    assert source == "mock" and data["week52_high"] >= data["week52_low"]
