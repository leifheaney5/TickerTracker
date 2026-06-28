import cache
from app import app


def test_logos_route_returns_symbol_url_map(monkeypatch):
    cache.clear()
    import services.logos as L
    monkeypatch.setattr(L.finnhub, "fetch_logo", lambda s: f"https://logo/{s}.png")
    client = app.test_client()
    r = client.get("/api/logos?syms=AAPL,KO")
    body = r.get_json()
    assert r.status_code == 200
    assert body["data"] == {"AAPL": "https://logo/AAPL.png", "KO": "https://logo/KO.png"}


def test_logos_route_drops_invalid_symbols(monkeypatch):
    cache.clear()
    import services.logos as L
    monkeypatch.setattr(L.finnhub, "fetch_logo", lambda s: f"https://logo/{s}.png")
    client = app.test_client()
    r = client.get("/api/logos?syms=AAPL,not a symbol!")
    assert r.status_code == 200
    assert set(r.get_json()["data"].keys()) == {"AAPL"}
