"""When a symbol has no company-news, get_news falls back to market news."""
import cache
import services.news as news_svc


def test_symbol_with_no_news_falls_back_to_market(monkeypatch):
    cache.clear()
    market_items = [{"headline": "Market mover", "url": "https://ex.com/a",
                     "source": "X", "datetime": "1h ago", "sentiment": "Neutral",
                     "symbol": "MKT"}]

    def fake_fetch(sym=None):
        return [] if sym else list(market_items)

    monkeypatch.setattr(news_svc, "fetch_news", fake_fetch)
    items, source = news_svc.get_news("NVDA")
    assert source == "finnhub"
    assert items == market_items  # empty company news -> market news


def test_symbol_with_news_keeps_its_own(monkeypatch):
    cache.clear()
    sym_items = [{"headline": "NVDA thing", "url": "https://ex.com/n",
                  "source": "Y", "datetime": "2h ago", "sentiment": "Bullish",
                  "symbol": "NVDA"}]
    monkeypatch.setattr(news_svc, "fetch_news",
                        lambda sym=None: list(sym_items) if sym else [])
    items, source = news_svc.get_news("NVDA")
    assert items == sym_items  # has its own news, no fallback


def test_market_news_unaffected(monkeypatch):
    cache.clear()
    market = [{"headline": "m", "url": "https://ex.com/m", "source": "Z",
               "datetime": "1h ago", "sentiment": "Neutral", "symbol": "MKT"}]
    monkeypatch.setattr(news_svc, "fetch_news",
                        lambda sym=None: market if sym is None else [])
    items, _ = news_svc.get_news(None)
    assert items == market
