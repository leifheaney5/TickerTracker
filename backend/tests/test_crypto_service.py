import services.crypto as c
import cache


def test_get_crypto_limit_passthrough(monkeypatch):
    cache.clear()
    seen = {}
    def fake(limit=50, extra_ids=()):
        seen["limit"] = limit; seen["extra"] = tuple(extra_ids)
        return {"coins": [{"id": "bitcoin"}], "total_market_cap": 1, "btc_dominance": 1}
    monkeypatch.setattr(c, "fetch_crypto", fake)
    data, source = c.get_crypto(limit=100, extra_ids=["solana"])
    assert source == "coingecko" and seen["limit"] == 100 and seen["extra"] == ("solana",)


def test_get_crypto_fallback_to_mock(monkeypatch):
    cache.clear()
    monkeypatch.setattr(c, "fetch_crypto",
                        lambda limit=50, extra_ids=(): (_ for _ in ()).throw(RuntimeError("down")))
    data, source = c.get_crypto(limit=25)
    assert data["coins"] and len(data["coins"]) == 25 and source == "mock"


def test_get_crypto_search_fallback(monkeypatch):
    cache.clear()
    monkeypatch.setattr(c, "search_coins",
                        lambda q: (_ for _ in ()).throw(RuntimeError("down")))
    hits, source = c.get_crypto_search("btc")
    assert hits == [] and source == "mock"


def test_get_crypto_prices_empty_on_error(monkeypatch):
    monkeypatch.setattr(c, "fetch_prices",
                        lambda ids: (_ for _ in ()).throw(RuntimeError("down")))
    assert c.get_crypto_prices(["solana"]) == {}
