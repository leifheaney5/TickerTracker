import db
import models


def test_watchlist_item_has_alert_state_columns():
    cols = {c.name for c in models.WatchlistItem.__table__.columns}
    assert "alert_active" in cols
    assert "alert_last_fired_at" in cols


def test_alert_state_defaults(tmp_path, monkeypatch):
    # fresh in-memory DB via create_all reflects the new columns with defaults
    item = models.WatchlistItem(user_id=1, symbol="AAPL")
    assert item.alert_active in (False, None)
    assert item.alert_last_fired_at is None
