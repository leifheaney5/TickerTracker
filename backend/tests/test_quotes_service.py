import services.quotes as q


_GOOD = {"price": 100.0, "change_pct": 1.0, "day_open": 99.0,
         "day_high": 101.0, "day_low": 98.0, "volume": 1000}


def test_get_quotes_uses_finnhub_when_ok(monkeypatch):
    import cache
    cache.clear()
    monkeypatch.setattr(q.finnhub, "fetch_quote", lambda s: dict(_GOOD))
    data, source = q.get_quotes(["AAPL"])
    assert data["AAPL"]["price"] == 100.0
    assert source == "finnhub"


def test_get_quotes_falls_back_to_yahoo(monkeypatch):
    import cache
    cache.clear()
    monkeypatch.setattr(q.finnhub, "fetch_quote", lambda s: (_ for _ in ()).throw(RuntimeError("finnhub down")))
    monkeypatch.setattr(q, "yahoo_quote", lambda s: dict(_GOOD))
    data, source = q.get_quotes(["AAPL"])
    assert data["AAPL"]["price"] == 100.0
    assert source == "yahoo"


def test_get_quotes_falls_back_to_mock(monkeypatch):
    import cache
    cache.clear()
    monkeypatch.setattr(q.finnhub, "fetch_quote", lambda s: (_ for _ in ()).throw(RuntimeError("finnhub down")))
    monkeypatch.setattr(q, "yahoo_quote", lambda s: (_ for _ in ()).throw(RuntimeError("yahoo down")))
    data, source = q.get_quotes(["AAPL"])
    assert data["AAPL"]["price"] > 0   # mock served
    assert source == "mock"


def test_get_quotes_concurrent_multiple(monkeypatch):
    import cache
    cache.clear()
    monkeypatch.setattr(q.finnhub, "fetch_quote", lambda s: dict(_GOOD))
    syms = ["AAPL", "MSFT", "NVDA", "TSLA", "AMZN"]
    data, source = q.get_quotes(syms)
    assert set(data.keys()) == set(syms)
    assert source == "finnhub"


def test_market_status_returns_known_value():
    assert q.get_market_status() in {
        "Market Open", "Pre-Market", "After-Hours", "Closed (Weekend)", "Unknown"}
