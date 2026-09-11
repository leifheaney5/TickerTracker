import db
import models
import pytest
from auth.passwords import hash_password
from app import app


def _verified_client(email="store_route_user@example.com"):
    """Create a verified user and return a logged-in test client."""
    c = app.test_client()
    with db.get_session() as s:
        s.add(models.User(
            email=email,
            password_hash=hash_password("password123"),
            email_verified=True,
        ))
        s.commit()
    c.post("/api/auth/login", json={"email": email, "password": "password123"})
    return c


def test_watchlist_crud_via_api():
    client = _verified_client()
    r = client.post("/api/watchlist", json={
        "symbol": "AAPL", "buy_target": 185,
        "sell_target": 240, "target": 999,
    })
    assert r.status_code == 200 and r.get_json()["data"]["symbol"] == "AAPL"
    assert r.get_json()["data"]["buy_target"] == 185
    assert r.get_json()["data"]["sell_target"] == 240
    assert r.get_json()["data"]["target"] == 240
    r = client.get("/api/watchlist")
    assert r.get_json()["data"][0]["sell_target"] == 240
    r = client.patch("/api/watchlist/AAPL", json={
        "buy_target": 0, "sell_target": 0, "alert_price": 300,
    })
    assert r.status_code == 200
    assert r.get_json()["data"]["buy_target"] == 0
    assert r.get_json()["data"]["sell_target"] == 0
    assert r.get_json()["data"]["target"] == 0
    assert r.get_json()["data"]["alert_price"] == 300
    r = client.delete("/api/watchlist/AAPL")
    assert r.get_json()["data"]["removed"] is True


def test_settings_via_api():
    client = _verified_client("settings_user@example.com")
    r = client.patch("/api/settings", json={"hide_balances": True})
    assert r.get_json()["data"]["hide_balances"] is True
    assert client.get("/api/settings").get_json()["meta"]["source"] == "db"


def test_holdings_via_api():
    client = _verified_client("holdings_user@example.com")
    client.post("/api/holdings", json={"symbol": "AAPL", "shares": 10, "avg_cost": 180})
    assert client.get("/api/holdings").get_json()["data"][0]["shares"] == 10
    assert client.delete("/api/holdings/AAPL").get_json()["data"]["removed"] is True


def test_watchlist_post_rejects_invalid_symbol():
    client = _verified_client("invalid_sym_user@example.com")
    r = client.post("/api/watchlist", json={"symbol": "not a symbol!"})
    assert r.status_code == 400


@pytest.mark.parametrize("field,value", [
    ("buy_target", -1),
    ("buy_target", "nan"),
    ("sell_target", "inf"),
    ("target", "not-a-number"),
    ("buy_target", None),
    ("sell_target", True),
])
def test_flat_watchlist_rejects_invalid_targets(field, value):
    client = _verified_client(f"invalid_{field}_{str(value).replace('-', '_').lower()}@example.com")
    r = client.post("/api/watchlist", json={"symbol": "AAPL", field: value})
    assert r.status_code == 400


def test_flat_watchlist_patch_rejects_invalid_target():
    client = _verified_client("invalid_patch_target@example.com")
    assert client.post("/api/watchlist", json={"symbol": "AAPL"}).status_code == 200
    r = client.patch("/api/watchlist/AAPL", json={"buy_target": -0.01})
    assert r.status_code == 400
