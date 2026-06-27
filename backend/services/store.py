import db
import models
from auth import current_user_id
from services import watchlists as _wl


def get_watchlist():
    uid = current_user_id()
    # Active union across all lists (deduped, ordered). Locked overflow excluded.
    rows = []
    for lst in _wl.list_watchlists(uid):
        for it in lst["items"]:
            if not it["locked"]:
                rows.append(it)
    # de-dupe by symbol, renumber position for the flat consumer
    seen, out = set(), []
    for i, it in enumerate(rows):
        if it["symbol"] in seen:
            continue
        seen.add(it["symbol"])
        out.append({"symbol": it["symbol"], "position": len(out), "target": it["target"],
                    "alert_price": it["alert_price"], "alert_dir": it["alert_dir"],
                    "alert_active": bool(it["alert_active"])})
    return out


def add_watch(symbol, target=0, alert_price=0, alert_dir="above"):
    uid = current_user_id()
    lid = _wl.get_or_create_primary_list(uid)
    it = _wl.add_item(uid, lid, symbol, target=target, alert_price=alert_price, alert_dir=alert_dir)
    return {"symbol": it["symbol"], "position": it["position"], "target": it["target"],
            "alert_price": it["alert_price"], "alert_dir": it["alert_dir"],
            "alert_active": bool(it["alert_active"])}


def update_watch(symbol, **fields):
    uid = current_user_id()
    lid = _wl.get_or_create_primary_list(uid)
    it = _wl.update_item(uid, lid, symbol, **fields)
    if it is None:
        return None
    return {"symbol": it["symbol"], "position": it["position"], "target": it["target"],
            "alert_price": it["alert_price"], "alert_dir": it["alert_dir"],
            "alert_active": bool(it["alert_active"])}


def remove_watch(symbol):
    uid = current_user_id()
    lid = _wl.get_or_create_primary_list(uid)
    return _wl.remove_item(uid, lid, symbol)


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
