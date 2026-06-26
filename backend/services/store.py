import db
import models
from auth import current_user_id


def _wl_dict(w):
    return {"symbol": w.symbol, "position": w.position, "target": w.target,
            "alert_price": w.alert_price, "alert_dir": w.alert_dir}


def get_watchlist():
    uid = current_user_id()
    with db.get_session() as s:
        rows = (s.query(models.WatchlistItem)
                .filter_by(user_id=uid).order_by(models.WatchlistItem.position).all())
        return [_wl_dict(w) for w in rows]


def add_watch(symbol, target=0, alert_price=0, alert_dir="above"):
    uid = current_user_id()
    symbol = symbol.upper()
    with db.get_session() as s:
        existing = s.query(models.WatchlistItem).filter_by(user_id=uid, symbol=symbol).first()
        if existing:
            existing.target = target
            existing.alert_price = alert_price
            existing.alert_dir = alert_dir
            s.commit()
            return _wl_dict(existing)
        count = s.query(models.WatchlistItem).filter_by(user_id=uid).count()
        item = models.WatchlistItem(user_id=uid, symbol=symbol, position=count,
                                    target=target, alert_price=alert_price, alert_dir=alert_dir)
        s.add(item)
        s.commit()
        return _wl_dict(item)


def update_watch(symbol, **fields):
    uid = current_user_id()
    symbol = symbol.upper()
    with db.get_session() as s:
        item = s.query(models.WatchlistItem).filter_by(user_id=uid, symbol=symbol).first()
        if not item:
            return None
        for k, v in fields.items():
            if hasattr(item, k) and v is not None:
                setattr(item, k, v)
        s.commit()
        return _wl_dict(item)


def remove_watch(symbol):
    uid = current_user_id()
    symbol = symbol.upper()
    with db.get_session() as s:
        item = s.query(models.WatchlistItem).filter_by(user_id=uid, symbol=symbol).first()
        if not item:
            return False
        s.delete(item)
        s.commit()
        return True


def _get_or_create_settings(s, uid):
    st = s.get(models.Settings, uid)
    if st is None:
        st = models.Settings(user_id=uid)
        s.add(st)
        s.commit()
    return st


def get_settings():
    uid = current_user_id()
    with db.get_session() as s:
        st = _get_or_create_settings(s, uid)
        return {"broker_connected": st.broker_connected, "broker_name": st.broker_name,
                "live_updates": st.live_updates, "alert_notifs": st.alert_notifs,
                "news_digest": st.news_digest, "hide_balances": st.hide_balances,
                "currency": st.currency}


def update_settings(**fields):
    uid = current_user_id()
    with db.get_session() as s:
        st = _get_or_create_settings(s, uid)
        for k, v in fields.items():
            if hasattr(st, k) and v is not None:
                setattr(st, k, v)
        s.commit()
    return get_settings()


def _h_dict(h):
    return {"symbol": h.symbol, "shares": h.shares, "avg_cost": h.avg_cost}


def get_holdings():
    uid = current_user_id()
    with db.get_session() as s:
        return [_h_dict(h) for h in s.query(models.Holding).filter_by(user_id=uid).all()]


def set_holding(symbol, shares, avg_cost):
    uid = current_user_id()
    symbol = symbol.upper()
    with db.get_session() as s:
        h = s.query(models.Holding).filter_by(user_id=uid, symbol=symbol).first()
        if h:
            h.shares = shares
            h.avg_cost = avg_cost
        else:
            h = models.Holding(user_id=uid, symbol=symbol, shares=shares, avg_cost=avg_cost)
            s.add(h)
        s.commit()
        return _h_dict(h)


def remove_holding(symbol):
    uid = current_user_id()
    symbol = symbol.upper()
    with db.get_session() as s:
        h = s.query(models.Holding).filter_by(user_id=uid, symbol=symbol).first()
        if not h:
            return False
        s.delete(h)
        s.commit()
        return True
