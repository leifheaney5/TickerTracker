"""Part B-1: explicit coverage for get_quotes mock-fallback path.

When both finnhub *and* yahoo raise, every symbol must fall back to a
deterministic mock quote and the overall source must be "mock".
"""
import services.quotes as q


def _raise(msg):
    def _inner(sym):
        raise RuntimeError(msg)
    return _inner


def test_get_quotes_both_providers_fail_returns_mock_source(monkeypatch):
    import cache
    cache.clear()
    monkeypatch.setattr(q.finnhub, "fetch_quote", _raise("finnhub down"))
    monkeypatch.setattr(q, "yahoo_quote", _raise("yahoo down"))
    data, source = q.get_quotes(["AAPL"])
    assert source == "mock"
    assert data["AAPL"]["price"] > 0


def test_get_quotes_all_symbols_mock_when_both_fail(monkeypatch):
    """All symbols fall back: overall source must be 'mock', not a real source."""
    import cache
    cache.clear()
    monkeypatch.setattr(q.finnhub, "fetch_quote", _raise("finnhub down"))
    monkeypatch.setattr(q, "yahoo_quote", _raise("yahoo down"))
    syms = ["AAPL", "MSFT", "TSLA"]
    data, source = q.get_quotes(syms)
    assert source == "mock"
    assert set(data.keys()) == set(syms)
    for sym in syms:
        assert isinstance(data[sym]["price"], float)
        assert data[sym]["price"] > 0


def test_get_quotes_mock_quote_has_required_keys(monkeypatch):
    """Mock quotes must contain the standard shape keys."""
    import cache
    cache.clear()
    monkeypatch.setattr(q.finnhub, "fetch_quote", _raise("finnhub down"))
    monkeypatch.setattr(q, "yahoo_quote", _raise("yahoo down"))
    data, source = q.get_quotes(["NVDA"])
    assert source == "mock"
    required = {"price", "change_pct", "day_open", "day_high", "day_low"}
    assert required <= set(data["NVDA"].keys())


def test_get_quotes_mixed_sources_not_mock_when_one_succeeds(monkeypatch):
    """If at least one symbol gets a real quote, overall source is NOT 'mock'."""
    import cache
    cache.clear()
    _GOOD = {"price": 150.0, "change_pct": 0.5, "day_open": 148.0,
             "day_high": 151.0, "day_low": 147.0, "prev_close": 149.0, "volume": 0}

    call_count = {"n": 0}

    def selective_finnhub(sym):
        call_count["n"] += 1
        if sym == "AAPL":
            return dict(_GOOD)
        raise RuntimeError("no quote")

    monkeypatch.setattr(q.finnhub, "fetch_quote", selective_finnhub)
    monkeypatch.setattr(q, "yahoo_quote", _raise("yahoo down"))
    data, source = q.get_quotes(["AAPL", "FAKE"])
    assert source == "finnhub"   # real source wins
    assert data["AAPL"]["price"] == 150.0
    assert data["FAKE"]["price"] > 0  # mock for the failed one
