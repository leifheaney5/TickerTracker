from app import app


def test_health_ok():
    client = app.test_client()
    r = client.get("/api/health")
    assert r.status_code == 200
    body = r.get_json()
    assert body["data"]["status"] == "ok"
    assert body["meta"]["source"] == "internal"
    assert body["meta"]["stale"] is False
