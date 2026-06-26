import db
import models
from auth import current_user_id


def test_singleton_user_seeded():
    with db.get_session() as s:
        u = s.get(models.User, 1)
        assert u is not None
        settings = s.get(models.Settings, 1)
        assert settings is not None
    assert current_user_id() == 1


def test_watchlist_item_roundtrip():
    with db.get_session() as s:
        s.add(models.WatchlistItem(user_id=1, symbol="AAPL", position=0, target=230.0))
        s.commit()
    with db.get_session() as s:
        items = s.query(models.WatchlistItem).filter_by(user_id=1).all()
        assert len(items) == 1 and items[0].symbol == "AAPL"
