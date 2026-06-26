from app import app
import cache


def test_news_route_symbol(monkeypatch):
    cache.clear()
    import services.news as news
    monkeypatch.setattr(news, "fetch_news", lambda sym: (_ for _ in ()).throw(RuntimeError("no key")))
    r = app.test_client().get("/api/news?sym=AAPL")
    assert r.status_code == 200 and r.get_json()["data"]


def test_news_route_market(monkeypatch):
    cache.clear()
    import services.news as news
    monkeypatch.setattr(news, "fetch_news", lambda sym: (_ for _ in ()).throw(RuntimeError("no key")))
    r = app.test_client().get("/api/news?market=1")
    assert r.status_code == 200 and r.get_json()["data"]


def test_ratings_route(monkeypatch):
    cache.clear()
    import services.ratings as ratings
    monkeypatch.setattr(ratings, "fetch_ratings", lambda sym: (_ for _ in ()).throw(RuntimeError("no key")))
    r = app.test_client().get("/api/ratings/AAPL")
    d = r.get_json()["data"]
    assert d["target"]["low"] <= d["target"]["high"]


def test_ratings_invalid_symbol():
    assert app.test_client().get("/api/ratings/TOO_LONG_SYMBOL_X").status_code == 400
