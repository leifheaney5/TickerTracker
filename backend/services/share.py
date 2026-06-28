"""Share service: per-list read-only shareable tokens + PNG-source data."""
import secrets
import db
import models
from services import watchlists


def create_share(user_id: int, list_id: int | None = None) -> str:
    if list_id is None:
        list_id = watchlists.get_or_create_primary_list(user_id)
    with db.get_session() as s:
        wl = s.query(models.Watchlist).filter_by(id=list_id, user_id=user_id).first()
        if wl is None:
            wl = s.query(models.Watchlist).filter_by(user_id=user_id).first()
        if not wl.share_token:
            wl.share_token = secrets.token_urlsafe(12)
        s.commit()
        return wl.share_token


def resolve_share(token: str) -> dict | None:
    with db.get_session() as s:
        wl = s.query(models.Watchlist).filter_by(share_token=token).first()
        if not wl:
            return None
        user = s.get(models.User, wl.user_id)
        items = (s.query(models.WatchlistItem)
                 .filter_by(user_id=wl.user_id, watchlist_id=wl.id)
                 .order_by(models.WatchlistItem.position).all())
        owner_name = (user.name if user else "") or "A Ticker Tracker user"
        return {"owner_name": owner_name, "list_name": wl.name,
                "items": [{"symbol": w.symbol} for w in items]}
