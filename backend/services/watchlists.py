"""List-aware watchlist service. All free-vs-premium enforcement lives here so
routes stay thin. Locked-ness (free overflow beyond 10 active) is computed."""
import db
import models
from services import premium


class PremiumRequired(Exception):
    pass


class FreeLimit(Exception):
    pass


class LastList(Exception):
    pass


def _item_dict(it, locked=False):
    return {"symbol": it.symbol, "position": it.position, "target": it.target,
            "alert_price": it.alert_price, "alert_dir": it.alert_dir,
            "alert_active": bool(it.alert_active), "watchlist_id": it.watchlist_id,
            "locked": locked}


def get_or_create_primary_list(uid: int) -> int:
    with db.get_session() as s:
        wl = (s.query(models.Watchlist).filter_by(user_id=uid)
              .order_by(models.Watchlist.position, models.Watchlist.id).first())
        if wl is None:
            wl = models.Watchlist(user_id=uid, name="My Watchlist", position=0)
            s.add(wl); s.commit()
        return wl.id


def _ordered_lists(s, uid):
    return (s.query(models.Watchlist).filter_by(user_id=uid)
            .order_by(models.Watchlist.position, models.Watchlist.id).all())


def list_watchlists(uid: int) -> list[dict]:
    get_or_create_primary_list(uid)
    premium_user = premium.is_premium_uid(uid)
    out = []
    with db.get_session() as s:
        for wl in _ordered_lists(s, uid):
            items = (s.query(models.WatchlistItem)
                     .filter_by(user_id=uid, watchlist_id=wl.id)
                     .order_by(models.WatchlistItem.position).all())
            dicts = []
            for idx, it in enumerate(items):
                locked = (not premium_user) and idx >= premium.FREE_MAX_ACTIVE_ITEMS
                dicts.append(_item_dict(it, locked=locked))
            out.append({"id": wl.id, "name": wl.name, "position": wl.position,
                        "share_token": wl.share_token, "items": dicts})
    return out


def create_watchlist(uid: int, name: str) -> dict:
    if not premium.is_premium_uid(uid):
        # free users are limited to FREE_MAX_LISTS
        with db.get_session() as s:
            count = s.query(models.Watchlist).filter_by(user_id=uid).count()
        if count >= premium.FREE_MAX_LISTS:
            raise PremiumRequired()
    with db.get_session() as s:
        pos = s.query(models.Watchlist).filter_by(user_id=uid).count()
        wl = models.Watchlist(user_id=uid, name=(name or "Untitled").strip()[:60], position=pos)
        s.add(wl); s.commit()
        return {"id": wl.id, "name": wl.name, "position": wl.position,
                "share_token": wl.share_token, "items": []}


def _owned(s, uid, list_id):
    return s.query(models.Watchlist).filter_by(id=list_id, user_id=uid).first()


def rename_or_move_list(uid, list_id, name=None, position=None):
    with db.get_session() as s:
        wl = _owned(s, uid, list_id)
        if not wl:
            return None
        if name is not None:
            wl.name = name.strip()[:60] or wl.name
        if position is not None:
            wl.position = int(position)
        s.commit()
        return {"id": wl.id, "name": wl.name, "position": wl.position,
                "share_token": wl.share_token}


def delete_watchlist(uid, list_id) -> bool:
    with db.get_session() as s:
        if s.query(models.Watchlist).filter_by(user_id=uid).count() <= 1:
            raise LastList()
        wl = _owned(s, uid, list_id)
        if not wl:
            return False
        s.query(models.WatchlistItem).filter_by(user_id=uid, watchlist_id=list_id).delete()
        s.delete(wl); s.commit()
        return True


def add_item(uid, list_id, symbol, target=0, alert_price=0, alert_dir="above") -> dict:
    symbol = symbol.upper()
    with db.get_session() as s:
        wl = _owned(s, uid, list_id)
        if not wl:
            raise ValueError("list not found")
        existing = s.query(models.WatchlistItem).filter_by(
            user_id=uid, watchlist_id=list_id, symbol=symbol).first()
        if existing:
            existing.target = target
            existing.alert_price = alert_price
            existing.alert_dir = alert_dir
            s.commit()
            return _item_dict(existing)
        # Free cap: count ACTIVE items in this user's single list.
        if not premium.is_premium_uid(uid):
            count = s.query(models.WatchlistItem).filter_by(user_id=uid, watchlist_id=list_id).count()
            if count >= premium.FREE_MAX_ACTIVE_ITEMS:
                raise FreeLimit()
        pos = s.query(models.WatchlistItem).filter_by(user_id=uid, watchlist_id=list_id).count()
        it = models.WatchlistItem(user_id=uid, watchlist_id=list_id, symbol=symbol,
                                  position=pos, target=target, alert_price=alert_price,
                                  alert_dir=alert_dir)
        s.add(it); s.commit()
        return _item_dict(it)


def update_item(uid, list_id, symbol, **fields):
    symbol = symbol.upper()
    allowed = {"target", "alert_price", "alert_dir", "alert_active", "position", "watchlist_id"}
    with db.get_session() as s:
        it = s.query(models.WatchlistItem).filter_by(
            user_id=uid, watchlist_id=list_id, symbol=symbol).first()
        if not it:
            return None
        for k, v in fields.items():
            if k in allowed and v is not None:
                if k == "watchlist_id" and not _owned(s, uid, int(v)):
                    continue  # never move into a list you don't own
                setattr(it, k, v)
        s.commit()
        return _item_dict(it)


def remove_item(uid, list_id, symbol) -> bool:
    symbol = symbol.upper()
    with db.get_session() as s:
        it = s.query(models.WatchlistItem).filter_by(
            user_id=uid, watchlist_id=list_id, symbol=symbol).first()
        if not it:
            return False
        s.delete(it); s.commit()
        return True


def active_symbols(uid: int) -> list[str]:
    """Deduped union of non-locked symbols across all the user's lists."""
    seen, out = set(), []
    for lst in list_watchlists(uid):
        for it in lst["items"]:
            if it["locked"]:
                continue
            if it["symbol"] not in seen:
                seen.add(it["symbol"]); out.append(it["symbol"])
    return out
