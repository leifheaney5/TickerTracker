# backend/services/alerts.py
import datetime as dt
import logging
import db
import models
from services.quotes import get_quotes
from providers.email import _send

logger = logging.getLogger(__name__)
COOLDOWN = dt.timedelta(hours=12)


def should_fire(price: float, alert_price: float, alert_dir: str) -> bool:
    if not alert_price:
        return False
    if alert_dir == "below":
        return price <= alert_price
    return price >= alert_price  # default "above"


def due_alerts(session, now=None):
    now = now or dt.datetime.utcnow()
    rows = (session.query(models.WatchlistItem)
            .filter(models.WatchlistItem.alert_active.is_(True))
            .filter(models.WatchlistItem.alert_price > 0)
            .all())
    out = []
    for w in rows:
        last = w.alert_last_fired_at
        if last is None or (now - last) >= COOLDOWN:
            out.append(w)
    return out


def _alert_email_html(symbol, price, alert_price, alert_dir):
    arrow = "rose above" if alert_dir == "above" else "fell below"
    return (f"<p><b>{symbol}</b> {arrow} your alert price.</p>"
            f"<p>Current: ${price:,.2f} &middot; Alert: ${alert_price:,.2f}</p>"
            f'<p><a href="https://tickertracker.info">Open Ticker Tracker</a></p>')


def check_alerts(now=None, quote_fn=None, send_fn=None) -> int:
    now = now or dt.datetime.utcnow()
    quote_fn = quote_fn or get_quotes
    send_fn = send_fn or _send
    fired = 0
    with db.get_session() as s:
        due = due_alerts(s, now=now)
        if not due:
            return 0
        syms = sorted({w.symbol for w in due})
        quotes, _ = quote_fn(syms)
        for w in due:
            q = quotes.get(w.symbol)
            if not q:
                continue
            price = q["price"]
            if not should_fire(price, w.alert_price, w.alert_dir):
                continue
            user = s.query(models.User).get(w.user_id)
            settings = s.query(models.Settings).get(w.user_id)
            if not user or not user.email:
                continue
            if settings is not None and not settings.alert_notifs:
                continue
            ok = send_fn(user.email,
                         f"{w.symbol} hit your alert price",
                         _alert_email_html(w.symbol, price, w.alert_price, w.alert_dir))
            if ok:
                s.add(models.AlertLog(user_id=w.user_id, symbol=w.symbol, price=price))
                w.alert_last_fired_at = now
                fired += 1
        s.commit()
    return fired


def _seed_for_test(user_email, symbol, alert_price, alert_dir, alert_active):
    """Test helper: create a user + armed watchlist alert in the current DB."""
    with db.get_session() as s:
        u = models.User(email=user_email, name="t", email_verified=True)
        s.add(u); s.flush()
        s.add(models.Settings(user_id=u.id, alert_notifs=True))
        s.add(models.WatchlistItem(user_id=u.id, symbol=symbol,
                                   alert_price=alert_price, alert_dir=alert_dir,
                                   alert_active=alert_active))
        s.commit()
