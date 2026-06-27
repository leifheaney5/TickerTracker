import responses
import providers.coingecko as cg

_MARKETS = "https://api.coingecko.com/api/v3/coins/markets"
_SEARCH = "https://api.coingecko.com/api/v3/search"


def _row(cid, sym, name, price, chg, cap):
    return {"id": cid, "symbol": sym, "name": name, "current_price": price,
            "price_change_percentage_24h": chg, "market_cap": cap}


@responses.activate
def test_fetch_crypto_limit_and_shape():
    responses.add(responses.GET, _MARKETS, json=[
        _row("bitcoin", "btc", "Bitcoin", 60000, 1.5, 1_200_000_000_000),
        _row("ethereum", "eth", "Ethereum", 3000, -2.1, 400_000_000_000),
    ], status=200)
    out = cg.fetch_crypto(limit=50)
    assert out["coins"][0]["id"] == "bitcoin"
    assert out["coins"][0]["symbol"] == "BTC"        # upper-cased ticker
    assert out["total_market_cap"] == 1_600_000_000_000
    assert out["btc_dominance"] == 75.0
    # per_page forwarded
    assert "per_page=50" in responses.calls[0].request.url


@responses.activate
def test_search_coins_shape():
    responses.add(responses.GET, _SEARCH, json={"coins": [
        {"id": "solana", "symbol": "sol", "name": "Solana", "market_cap_rank": 5},
    ]}, status=200)
    hits = cg.search_coins("sol")
    assert hits[0] == {"id": "solana", "symbol": "SOL", "name": "Solana"}


@responses.activate
def test_fetch_crypto_unions_extra_id_outside_top_n():
    responses.add(responses.GET, _MARKETS, json=[
        _row("bitcoin", "btc", "Bitcoin", 60000, 1.5, 1_200_000_000_000),
    ], status=200)
    responses.add(responses.GET, _MARKETS, json=[
        _row("shiba-inu", "shib", "Shiba Inu", 0.00002, 3.0, 9_000_000_000),
    ], status=200)
    out = cg.fetch_crypto(limit=50, extra_ids=["shiba-inu"])
    assert {c["id"] for c in out["coins"]} == {"bitcoin", "shiba-inu"}
    assert len(responses.calls) == 2
    assert "ids=shiba-inu" in responses.calls[1].request.url
    assert "ids=" not in responses.calls[0].request.url   # top-N call is unfiltered


@responses.activate
def test_fetch_crypto_skips_second_request_when_extra_already_in_top_n():
    responses.add(responses.GET, _MARKETS, json=[
        _row("bitcoin", "btc", "Bitcoin", 60000, 1.5, 1_200_000_000_000),
    ], status=200)
    out = cg.fetch_crypto(limit=50, extra_ids=["bitcoin"])
    assert len(responses.calls) == 1
    assert {c["id"] for c in out["coins"]} == {"bitcoin"}


@responses.activate
def test_fetch_prices_keyed_by_id():
    responses.add(responses.GET, _MARKETS, json=[
        _row("solana", "sol", "Solana", 150.0, 4.0, 7_000_000_000),
    ], status=200)
    prices = cg.fetch_prices(["solana"])
    assert prices["solana"]["price"] == 150.0
    assert prices["solana"]["change_pct"] == 4.0
