import app as appmod


def test_valid_coin_id():
    assert appmod.valid_coin_id("solana")
    assert appmod.valid_coin_id("shiba-inu")
    assert not appmod.valid_coin_id("Sol Ana")
    assert not appmod.valid_coin_id("")
    assert not appmod.valid_coin_id("../etc")
    assert not appmod.valid_coin_id("x" * 65)


def test_crypto_route_limit_validation(monkeypatch):
    seen = {}
    monkeypatch.setattr(appmod, "get_crypto",
                        lambda limit=50, extra_ids=(): (seen.update(limit=limit, extra=tuple(extra_ids)) or ({"coins": []}, "coingecko")))
    client = appmod.app.test_client()
    client.get("/api/crypto?limit=100&watch=solana,bad id")
    assert seen["limit"] == 100
    assert seen["extra"] == ("solana",)            # invalid id filtered out
    client.get("/api/crypto?limit=7")              # not in {25,50,100}
    assert seen["limit"] == 50                      # falls back to default


def test_crypto_search_route(monkeypatch):
    monkeypatch.setattr(appmod, "get_crypto_search",
                        lambda q: ([{"id": "solana", "symbol": "SOL", "name": "Solana"}], "coingecko"))
    client = appmod.app.test_client()
    r = client.get("/api/crypto/search?q=sol")
    assert r.status_code == 200
    assert r.get_json()["data"][0]["id"] == "solana"
    # too-short query returns empty, no provider call
    r2 = client.get("/api/crypto/search?q=")
    assert r2.get_json()["data"] == []
