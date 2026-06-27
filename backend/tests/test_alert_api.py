import app as appmod
from app import app

def test_watchlist_patch_accepts_alert_active(monkeypatch):
    captured = {}
    monkeypatch.setattr(appmod, "update_watch",
                        lambda sym, **f: captured.update(f) or {"symbol": sym, **f})
    monkeypatch.setattr(appmod, "_require_user", lambda: 1)
    with appmod._rl_lock:
        appmod._rl_hits.clear()
    r = app.test_client().patch("/api/watchlist/AAPL",
                                json={"alert_active": True, "alert_price": 200, "evil": 1})
    assert r.status_code == 200
    assert captured == {"alert_active": True, "alert_price": 200}  # 'evil' dropped
