import os
os.environ.setdefault("DATABASE_URL", "sqlite://")
import json
import pytest
import db, models
from app import app


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("BILLING_ENABLED", "1")  # enforce plan limits in tests
    models.Base.metadata.drop_all(db.engine)
    models.Base.metadata.create_all(db.engine)
    with db.get_session() as s:
        free = models.User(email="free@x.com", name="free", email_verified=True)
        prem = models.User(email="prem@x.com", name="prem", email_verified=True)
        s.add(free); s.add(prem); s.flush()
        # prem is Pro via an active Stripe subscription; free has none.
        s.add(models.BillingSubscription(user_id=prem.id, status="active", plan="pro"))
        s.commit()
    app.config["TESTING"] = True
    return app.test_client()


def _login(client, email):
    with db.get_session() as s:
        uid = s.query(models.User).filter_by(email=email).first().id
    with client.session_transaction() as sess:
        sess["_user_id"] = str(uid)
    return uid


def test_free_user_blocked_creating_second_list(client):
    _login(client, "free@x.com")
    client.get("/api/watchlists")  # lazily creates primary
    r = client.post("/api/watchlists", json={"name": "Prospective"})
    assert r.status_code == 402
    assert r.get_json()["data"]["error"] == "premium_required"


def test_premium_user_creates_list(client):
    _login(client, "prem@x.com")
    client.get("/api/watchlists")
    r = client.post("/api/watchlists", json={"name": "Tech Only"})
    assert r.status_code == 200
    assert r.get_json()["data"]["name"] == "Tech Only"


def test_free_user_over_cap_item_blocked(client):
    from services import premium
    cap = premium.FREE_MAX_ACTIVE_ITEMS
    _login(client, "free@x.com")
    lid = client.get("/api/watchlists").get_json()["data"][0]["id"]
    for i in range(cap):
        assert client.post(f"/api/watchlists/{lid}/items", json={"symbol": f"AA{i}"}).status_code == 200
    r = client.post(f"/api/watchlists/{lid}/items", json={"symbol": "OVER"})
    assert r.status_code == 402
    assert r.get_json()["data"]["error"] == "free_limit"


def test_cannot_delete_last_list(client):
    _login(client, "prem@x.com")
    lid = client.get("/api/watchlists").get_json()["data"][0]["id"]
    r = client.delete(f"/api/watchlists/{lid}")
    assert r.status_code == 409
    assert r.get_json()["data"]["error"] == "last_list"


def test_auth_scoping_other_users_list(client):
    _login(client, "prem@x.com")
    lid = client.get("/api/watchlists").get_json()["data"][0]["id"]
    _login(client, "free@x.com")  # switch user
    r = client.patch(f"/api/watchlists/{lid}", json={"name": "hax"})
    assert r.status_code in (403, 404)


def test_patch_item_move_to_unowned_list_returns_404(client):
    """PATCH moving item to another user's list_id must return 404, not 500."""
    _login(client, "prem@x.com")
    prem_lid = client.get("/api/watchlists").get_json()["data"][0]["id"]

    _login(client, "free@x.com")
    free_lid = client.get("/api/watchlists").get_json()["data"][0]["id"]
    # Add an item to free user's list
    client.post(f"/api/watchlists/{free_lid}/items", json={"symbol": "AAPL"})

    # Try to move that item into prem user's list (which free user doesn't own)
    r = client.patch(f"/api/watchlists/{free_lid}/items/AAPL",
                     json={"watchlist_id": prem_lid})
    assert r.status_code == 404
    assert r.get_json()["data"]["error"] == "not found"
