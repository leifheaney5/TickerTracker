"""Share service: create and resolve read-only shareable watchlist tokens."""
import secrets
import db
import models


def create_share(user_id: int) -> str:
    """Return a share token for the given user, creating one if absent."""
    with db.get_session() as s:
        st = s.get(models.Settings, user_id)
        if st is None:
            st = models.Settings(user_id=user_id)
            s.add(st)
        if not st.share_token:
            st.share_token = secrets.token_urlsafe(12)
        s.commit()
        return st.share_token


def resolve_share(token: str) -> dict | None:
    """Return {owner_name, items:[{symbol}]} for the given token, or None."""
    with db.get_session() as s:
        st = s.query(models.Settings).filter_by(share_token=token).first()
        if not st:
            return None
        user = s.get(models.User, st.user_id)
        items = (
            s.query(models.WatchlistItem)
            .filter_by(user_id=st.user_id)
            .order_by(models.WatchlistItem.position)
            .all()
        )
        owner_name = (user.name if user else "") or "A Ticker Tracker user"
        return {
            "owner_name": owner_name,
            "items": [{"symbol": w.symbol} for w in items],
        }


def _seed_user_with_watchlist(email: str, name: str, symbols: list[str]) -> None:
    """Test helper: insert a user + Settings + WatchlistItems in fresh DB."""
    with db.get_session() as s:
        u = models.User(email=email, name=name, email_verified=True)
        s.add(u)
        s.flush()
        s.add(models.Settings(user_id=u.id))
        for i, sym in enumerate(symbols):
            s.add(models.WatchlistItem(user_id=u.id, symbol=sym, position=i))
        s.commit()
