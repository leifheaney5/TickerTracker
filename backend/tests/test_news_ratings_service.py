import services.news as news
import services.ratings as ratings
import cache


def test_news_fallback_to_mock(monkeypatch):
    cache.clear()
    monkeypatch.setattr(news, "fetch_news", lambda sym: (_ for _ in ()).throw(RuntimeError("no key")))
    items, source = news.get_news("AAPL")
    assert items and source == "mock"


def test_news_uses_provider(monkeypatch):
    cache.clear()
    sample = [{"source": "Reuters", "datetime": "1h ago", "sentiment": "Bullish",
               "headline": "x", "url": "u", "symbol": "AAPL"}]
    monkeypatch.setattr(news, "fetch_news", lambda sym: sample)
    items, source = news.get_news("AAPL")
    assert items == sample and source == "finnhub"


def test_ratings_fallback_to_mock(monkeypatch):
    cache.clear()
    monkeypatch.setattr(ratings, "fetch_ratings", lambda sym: (_ for _ in ()).throw(RuntimeError("no key")))
    data, source = ratings.get_ratings("AAPL")
    assert source == "mock" and data["target"]["low"] <= data["target"]["high"]
