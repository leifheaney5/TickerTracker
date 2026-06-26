import services.quotes as q


def test_get_quotes_uses_provider_when_ok(monkeypatch):
    def fake_fetch(sym):
        return {"price": 100.0, "change_pct": 1.0, "day_open": 99.0,
                "day_high": 101.0, "day_low": 98.0, "volume": 1000}
    monkeypatch.setattr(q, "fetch_quote", fake_fetch)
    import cache
    cache.clear()
    data, source = q.get_quotes(["AAPL"])
    assert data["AAPL"]["price"] == 100.0
    assert source == "yahoo"


def test_get_quotes_falls_back_to_mock(monkeypatch):
    def boom(sym):
        raise RuntimeError("yahoo down")
    monkeypatch.setattr(q, "fetch_quote", boom)
    import cache
    cache.clear()
    data, source = q.get_quotes(["AAPL"])
    assert data["AAPL"]["price"] > 0   # mock served
    assert source == "mock"


def test_market_status_returns_known_value():
    assert q.get_market_status() in {
        "Market Open", "Pre-Market", "After-Hours", "Closed (Weekend)", "Unknown"}
