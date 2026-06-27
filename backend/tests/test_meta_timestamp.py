# backend/tests/test_meta_timestamp.py
from app import app
import app as appmod

def test_envelope_includes_fetched_at(monkeypatch):
    monkeypatch.setattr(appmod, "get_quotes", lambda syms: ({}, "mock"))
    with appmod._rl_lock:
        appmod._rl_hits.clear()
    r = app.test_client().get("/api/quotes?syms=AAPL")
    meta = r.get_json()["meta"]
    assert "fetched_at" in meta
    assert "T" in meta["fetched_at"]  # ISO-8601
