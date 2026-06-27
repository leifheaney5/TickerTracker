import providers.finnhub as fh

def test_fetch_news_drops_api_urls(monkeypatch):
    rows = [
        {"headline": "Real article", "url": "https://example.com/a", "source": "X", "datetime": 0},
        {"headline": "API url", "url": "https://finnhub.io/api/news?id=9", "source": "Y", "datetime": 0},
        {"headline": "No url", "url": "", "source": "Z", "datetime": 0},
    ]
    class R:
        ok = True
        def raise_for_status(self): pass
        def json(self): return rows
    monkeypatch.setattr(fh, "_key", lambda: "k")
    monkeypatch.setattr(fh.requests, "get", lambda *a, **k: R())
    out = fh.fetch_news("AAPL")
    urls = [x["url"] for x in out]
    assert "https://example.com/a" in urls
    assert all("finnhub.io/api" not in u for u in urls)
    assert all(u for u in urls)  # no empty urls
