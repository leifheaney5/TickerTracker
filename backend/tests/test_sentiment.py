"""Tests for watchlist_sentiment() in services.news."""


def test_bullish_majority(monkeypatch):
    def fake_get_news(sym=None):
        if sym == "AAPL":
            return [{"sentiment": "Bullish"}, {"sentiment": "Bullish"}, {"sentiment": "Bullish"}, {"sentiment": "Bearish"}], "mock"
        if sym == "MSFT":
            return [{"sentiment": "Bullish"}, {"sentiment": "Bullish"}], "mock"
        return [], "mock"
    monkeypatch.setattr("services.news.get_news", fake_get_news)
    from services.news import watchlist_sentiment
    result = watchlist_sentiment(["AAPL", "MSFT"])
    assert result == {"bullish": 5, "bearish": 1, "neutral": 0, "total": 6, "mood": "Bullish"}


def test_empty_returns_neutral(monkeypatch):
    from services.news import watchlist_sentiment
    result = watchlist_sentiment([])
    assert result == {"bullish": 0, "bearish": 0, "neutral": 0, "total": 0, "mood": "Neutral"}
