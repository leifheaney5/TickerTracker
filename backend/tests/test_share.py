import services.share as sh


def test_create_and_resolve_share():
    sh._seed_user_with_watchlist(email="o@e.com", name="Owner", symbols=["AAPL", "NVDA"])
    token = sh.create_share(user_id=1)
    assert token and len(token) >= 16
    res = sh.resolve_share(token)
    assert res["owner_name"] == "Owner"
    assert sorted(i["symbol"] for i in res["items"]) == ["AAPL", "NVDA"]


def test_resolve_unknown_token_is_none():
    assert sh.resolve_share("nope") is None
