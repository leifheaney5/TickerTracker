import services.history as h
import services.fundamentals as f
from providers import finnhub as fh
import cache


# ── history ──────────────────────────────────────────────────────────────────

def test_history_fallback_to_mock(monkeypatch):
    cache.clear()
    monkeypatch.setattr(h, "fetch_history", lambda s, tf: (_ for _ in ()).throw(RuntimeError("down")))
    monkeypatch.setattr(h.time, "sleep", lambda *_: None)  # no real backoff in tests
    bars, source, stale = h.get_history("AAPL", "1M")
    assert len(bars) == 22 and source == "mock" and stale is False
    assert all(k in bars[0] for k in ("date", "o", "h", "l", "c", "v"))


def test_history_uses_provider(monkeypatch):
    cache.clear()
    sample = [{"date": "2026-06-25", "o": 1, "h": 2, "l": 0.5, "c": 1.5, "v": 10}]
    monkeypatch.setattr(h, "fetch_history", lambda s, tf: sample)
    bars, source, stale = h.get_history("AAPL", "1M")
    assert bars == sample and source == "yahoo" and stale is False


def test_history_retries_then_succeeds(monkeypatch):
    cache.clear()
    sample = [{"date": "2026-06-25", "o": 1, "h": 2, "l": 0.5, "c": 1.5, "v": 10}]
    calls = {"n": 0}
    def flaky(s, tf):
        calls["n"] += 1
        if calls["n"] < 3:
            raise RuntimeError("429")
        return sample
    monkeypatch.setattr(h, "fetch_history", flaky)
    monkeypatch.setattr(h.time, "sleep", lambda *_: None)
    bars, source, stale = h.get_history("AAPL", "1M")
    assert bars == sample and source == "yahoo" and calls["n"] == 3


def test_history_stale_while_error(monkeypatch):
    # Prime cache with a real success, then make the provider fail: we must serve
    # the cached REAL bars (stale=True), never fabricated mock.
    cache.clear()
    good = [{"date": "2026-06-25", "o": 1, "h": 2, "l": 0.5, "c": 1.5, "v": 10}]
    monkeypatch.setattr(h, "fetch_history", lambda s, tf: good)
    h.get_history("AAPL", "1M")  # warms cache
    monkeypatch.setattr(h, "fetch_history", lambda s, tf: (_ for _ in ()).throw(RuntimeError("429")))
    monkeypatch.setattr(h.time, "sleep", lambda *_: None)
    # force TTL expiry so it attempts a refresh
    monkeypatch.setattr(cache.time, "time", lambda: 10**12)
    bars, source, stale = h.get_history("AAPL", "1M")
    assert bars == good and stale is True and source == "yahoo-cache"


# ── fundamentals ─────────────────────────────────────────────────────────────

def test_fundamentals_uses_yahoo(monkeypatch):
    cache.clear()
    data = {"pe": 30.0, "market_cap": 1, "sector": "Technology", "industry": "Semiconductors",
            "week52_high": 9, "week52_low": 1, "all_time_high": 9, "all_time_low": 1,
            "beta": 1.1, "dividend_yield": 0.0, "eps": 5.0}
    monkeypatch.setattr(f, "fetch_fundamentals", lambda s: data)
    out, source, stale = f.get_fundamentals("NVDA")
    assert out["sector"] == "Technology" and source == "yahoo" and stale is False


def test_fundamentals_falls_back_to_finnhub_not_mock(monkeypatch):
    # Yahoo down -> must use REAL Finnhub data, NOT fabricated mock.
    cache.clear()
    monkeypatch.setattr(f, "fetch_fundamentals",
                        lambda s: (_ for _ in ()).throw(RuntimeError("429")))
    real = {"pe": 29.2, "market_cap": 4_659_000_000_000, "sector": "Semiconductors",
            "industry": "Semiconductors", "week52_high": 236.54, "week52_low": 151.49,
            "all_time_high": 236.54, "all_time_low": 151.49, "beta": 2.0,
            "dividend_yield": 0.0, "eps": 3.0}
    monkeypatch.setattr(fh, "fetch_fundamentals", lambda s: real)
    out, source, stale = f.get_fundamentals("NVDA")
    assert source == "finnhub" and out["industry"] == "Semiconductors"
    assert out["market_cap"] > 1_000_000_000_000  # real, not mock


def test_fundamentals_mock_only_when_both_real_sources_fail(monkeypatch):
    cache.clear()
    monkeypatch.setattr(f, "fetch_fundamentals",
                        lambda s: (_ for _ in ()).throw(RuntimeError("429")))
    monkeypatch.setattr(fh, "fetch_fundamentals",
                        lambda s: (_ for _ in ()).throw(RuntimeError("no key")))
    data, source, stale = f.get_fundamentals("AAPL")
    assert source == "mock" and stale is False
    assert data["week52_high"] >= data["week52_low"]
