from mock import mock_news, mock_ratings


def test_mock_news_shape():
    items = mock_news("AAPL")
    assert len(items) >= 3
    for it in items:
        assert set(("source", "datetime", "sentiment", "headline", "url", "symbol")) <= set(it)
        assert it["sentiment"] in {"Bullish", "Bearish", "Neutral"}


def test_mock_news_deterministic():
    assert mock_news("AAPL") == mock_news("AAPL")


def test_mock_ratings_shape():
    r = mock_ratings("AAPL")
    d = r["distribution"]
    assert set(("strongBuy", "buy", "hold", "sell", "strongSell")) == set(d)
    t = r["target"]
    assert t["low"] <= t["mean"] <= t["high"]
    assert r["consensus"] in {"Strong Buy", "Buy", "Hold", "Sell", "Strong Sell"}
