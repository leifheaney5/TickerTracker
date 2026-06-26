from app import app


def test_watchlist_crud_via_api():
    client = app.test_client()
    r = client.post("/api/watchlist", json={"symbol": "AAPL", "target": 230})
    assert r.status_code == 200 and r.get_json()["data"]["symbol"] == "AAPL"
    r = client.get("/api/watchlist")
    assert r.get_json()["data"][0]["symbol"] == "AAPL"
    r = client.patch("/api/watchlist/AAPL", json={"alert_price": 300})
    assert r.get_json()["data"]["alert_price"] == 300
    r = client.delete("/api/watchlist/AAPL")
    assert r.get_json()["data"]["removed"] is True


def test_settings_via_api():
    client = app.test_client()
    r = client.patch("/api/settings", json={"hide_balances": True})
    assert r.get_json()["data"]["hide_balances"] is True
    assert client.get("/api/settings").get_json()["meta"]["source"] == "db"


def test_holdings_via_api():
    client = app.test_client()
    client.post("/api/holdings", json={"symbol": "AAPL", "shares": 10, "avg_cost": 180})
    assert client.get("/api/holdings").get_json()["data"][0]["shares"] == 10
    assert client.delete("/api/holdings/AAPL").get_json()["data"]["removed"] is True


def test_watchlist_post_rejects_invalid_symbol():
    r = app.test_client().post("/api/watchlist", json={"symbol": "not a symbol!"})
    assert r.status_code == 400
