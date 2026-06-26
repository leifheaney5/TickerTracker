import cache
from app import app
import services.search as search_svc


def test_search_returns_results(monkeypatch):
    cache.clear()
    sample = [{"symbol": "AAPL", "description": "APPLE INC", "type": "Common Stock"}]
    monkeypatch.setattr(search_svc.finnhub, "search_symbols", lambda q: list(sample))
    r = app.test_client().get("/api/search?q=apple")
    body = r.get_json()
    assert r.status_code == 200
    assert body["data"][0]["symbol"] == "AAPL"


def test_search_empty_query():
    r = app.test_client().get("/api/search?q=")
    assert r.status_code == 200 and r.get_json()["data"] == []


def test_search_provider_failure_returns_empty(monkeypatch):
    cache.clear()
    monkeypatch.setattr(search_svc.finnhub, "search_symbols",
                        lambda q: (_ for _ in ()).throw(RuntimeError("no key")))
    r = app.test_client().get("/api/search?q=kraken")
    assert r.status_code == 200 and r.get_json()["data"] == []


def test_security_headers_present():
    r = app.test_client().get("/api/health")
    assert r.headers.get("X-Content-Type-Options") == "nosniff"
    assert r.headers.get("X-Frame-Options") == "DENY"
    assert "frame-ancestors 'none'" in r.headers.get("Content-Security-Policy", "")
