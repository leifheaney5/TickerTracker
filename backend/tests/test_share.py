import os
os.environ.setdefault("DATABASE_URL", "sqlite://")
import db, models
import services.share as sh
from services import share, watchlists


def _fresh_user(email="o@e.com", name="Owner"):
    models.Base.metadata.drop_all(db.engine)
    models.Base.metadata.create_all(db.engine)
    with db.get_session() as s:
        u = models.User(email=email, name=name, plan="premium")
        s.add(u); s.commit()
        return u.id


def _fresh_premium():
    models.Base.metadata.drop_all(db.engine)
    models.Base.metadata.create_all(db.engine)
    with db.get_session() as s:
        u = models.User(email="o@x.com", name="Owner", plan="premium")
        s.add(u); s.commit()
        return u.id


def test_create_and_resolve_share():
    uid = _fresh_user()
    lid = watchlists.get_or_create_primary_list(uid)
    watchlists.add_item(uid, lid, "AAPL")
    watchlists.add_item(uid, lid, "NVDA")
    token = share.create_share(user_id=uid)
    assert token and len(token) >= 16
    res = share.resolve_share(token)
    assert res["owner_name"] == "Owner"
    assert res["list_name"] == "My Watchlist"
    assert sorted(i["symbol"] for i in res["items"]) == ["AAPL", "NVDA"]


def test_resolve_unknown_token_is_none():
    assert share.resolve_share("nope") is None


def test_per_list_share_resolves_with_name():
    uid = _fresh_premium()
    a = watchlists.get_or_create_primary_list(uid)
    watchlists.rename_or_move_list(uid, a, name="Tech Only")
    watchlists.add_item(uid, a, "NVDA")
    token = share.create_share(uid, a)
    res = share.resolve_share(token)
    assert res["owner_name"] == "Owner"
    assert res["list_name"] == "Tech Only"
    assert [i["symbol"] for i in res["items"]] == ["NVDA"]
