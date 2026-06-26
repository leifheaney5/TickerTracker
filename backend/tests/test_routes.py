import cache
from app import app


def test_quotes_route(monkeypatch):
    cache.clear()
    import services.quotes as q
    monkeypatch.setattr(q, "fetch_quote", lambda s: (_ for _ in ()).throw(RuntimeError("down")))
    client = app.test_client()
    r = client.get("/api/quotes?syms=AAPL,MSFT")
    body = r.get_json()
    assert r.status_code == 200
    assert set(body["data"]["quotes"].keys()) == {"AAPL", "MSFT"}
    assert "market_status" in body["data"]
    assert body["meta"]["source"] == "mock"


def test_history_route(monkeypatch):
    cache.clear()
    import services.history as h
    monkeypatch.setattr(h, "fetch_history", lambda s, tf: (_ for _ in ()).throw(RuntimeError("down")))
    r = app.test_client().get("/api/history/AAPL?tf=1M")
    body = r.get_json()
    assert len(body["data"]) == 22


def test_crypto_and_fng_routes(monkeypatch):
    cache.clear()
    import services.crypto as c
    monkeypatch.setattr(c, "fetch_crypto", lambda: (_ for _ in ()).throw(RuntimeError("down")))
    r1 = app.test_client().get("/api/crypto")
    assert r1.get_json()["data"]["coins"]
    r2 = app.test_client().get("/api/fng")
    assert 0 <= r2.get_json()["data"]["value"] <= 100
