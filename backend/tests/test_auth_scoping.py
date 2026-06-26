import db
import models
from auth.passwords import hash_password
from app import app


def _verified_client(email):
    c = app.test_client()
    with db.get_session() as s:
        s.add(models.User(email=email, password_hash=hash_password("password123"), email_verified=True))
        s.commit()
    c.post("/api/auth/login", json={"email": email, "password": "password123"})
    return c


def test_anonymous_blocked_on_personalization():
    c = app.test_client()
    assert c.get("/api/watchlist").status_code == 401
    assert c.post("/api/watchlist", json={"symbol": "AAPL"}).status_code == 401
    assert c.get("/api/settings").status_code == 401
    assert c.patch("/api/watchlist/AAPL", json={"target": 100}).status_code == 401
    assert c.delete("/api/watchlist/AAPL").status_code == 401
    assert c.patch("/api/settings", json={"hide_balances": True}).status_code == 401
    assert c.get("/api/holdings").status_code == 401
    assert c.post("/api/holdings", json={"symbol": "AAPL", "shares": 1, "avg_cost": 1}).status_code == 401
    assert c.delete("/api/holdings/AAPL").status_code == 401


def test_public_routes_open_when_anonymous(monkeypatch):
    import cache
    cache.clear()
    import services.quotes as q
    monkeypatch.setattr(q.finnhub, "fetch_quote", lambda s: (_ for _ in ()).throw(RuntimeError("x")))
    monkeypatch.setattr(q, "yahoo_quote", lambda s: (_ for _ in ()).throw(RuntimeError("x")))
    c = app.test_client()
    assert c.get("/api/quotes?syms=AAPL").status_code == 200
    assert c.get("/api/health").status_code == 200


def test_users_are_isolated():
    a = _verified_client("a@iso.com")
    b = _verified_client("b@iso.com")
    a.post("/api/watchlist", json={"symbol": "AAPL"})
    assert any(w["symbol"] == "AAPL" for w in a.get("/api/watchlist").get_json()["data"])
    assert b.get("/api/watchlist").get_json()["data"] == []
