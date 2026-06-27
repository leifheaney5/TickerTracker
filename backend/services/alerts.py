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
    """Watchlist items eligible to notify this run, off cooldown. An item is
    eligible if it has an armed alert (alert_active + alert_price) OR a price
    target set — so just setting a target on a card gets you an email."""
    now = now or dt.datetime.utcnow()
    rows = session.query(models.WatchlistItem).all()
    out = []
    for w in rows:
        has_alert = bool(w.alert_active) and (w.alert_price or 0) > 0
        has_target = (w.target or 0) > 0
        if not (has_alert or has_target):
            continue
        last = w.alert_last_fired_at
        if last is None or (now - last) >= COOLDOWN:
            out.append(w)
    return out


def _evaluate(w, price):
    """Return (level, direction, kind) if this item should fire for `price`,
    else None. Prefers an explicit armed alert; falls back to the target.
    Target direction is inferred: target above the alert level is an 'above'
    goal, etc. — for a plain target we treat reaching/exceeding it as firing."""
    # 1) explicit armed alert
    if bool(w.alert_active) and (w.alert_price or 0) > 0:
        if should_fire(price, w.alert_price, w.alert_dir):
            return (w.alert_price, w.alert_dir, "alert")
    # 2) price target — fire once price reaches/passes it (in the goal direction)
    if (w.target or 0) > 0:
        # If no explicit direction, assume the target is a goal to rise into when
        # it's >= a typical level; simplest robust rule: fire when price crosses
        # the target in EITHER direction relative to when it was set is hard
        # without history, so: notify when current price has reached the target
        # (>= target). This matches "my target has been hit".
        if price >= w.target:
            return (w.target, "above", "target")
    return None


def _alert_email_html(symbol, price, level, direction, kind):
    """Branded, colorful alert email. `kind` is 'target' or 'alert'; `direction`
    is 'above'/'below'; `level` is the price that was crossed."""
    from html import escape
    from providers import email_templates as t
    symbol = escape(str(symbol))  # defense-in-depth: never trust into HTML
    up = direction == "above"
    color = t.UP if up else t.DOWN
    arrow = "&#9650;" if up else "&#9660;"  # ▲ / ▼
    moved = "rose above" if up else "fell below"
    label = "price target" if kind == "target" else "alert price"
    diff = price - level
    diff_pct = (diff / level * 100) if level else 0
    sign = "+" if diff >= 0 else ""

    body = (
        f'<p style="margin:0 0 18px;font-size:15px">'
        f'<b style="color:#11151b">{symbol}</b> {moved} your {label}.</p>'

        # Big price row
        '<table role="presentation" cellpadding="0" cellspacing="0" width="100%" '
        'style="margin:0 0 16px;border:1px solid #eceef1;border-radius:12px">'
        '<tr><td style="padding:16px 18px">'
        f'<div style="font-size:12px;color:#8b93a0;text-transform:uppercase;'
        f'letter-spacing:.04em">{symbol} &middot; current price</div>'
        f'<div style="font-size:30px;font-weight:800;color:#11151b;margin-top:2px">'
        f'${price:,.2f} <span style="font-size:16px;color:{color}">{arrow}</span></div>'
        f'<div style="margin-top:8px">'
        f'{t.stat_pill(f"{sign}{diff_pct:.2f}% vs your {label}", color)}'
        f'</div>'
        '</td></tr></table>'

        # Detail rows
        '<table role="presentation" cellpadding="0" cellspacing="0" width="100%" '
        'style="font-size:13.5px;color:#33383f">'
        f'<tr><td style="padding:6px 0;color:#8b93a0">Your {label}</td>'
        f'<td align="right" style="padding:6px 0;font-weight:700">${level:,.2f}</td></tr>'
        f'<tr><td style="padding:6px 0;color:#8b93a0;border-top:1px solid #f0f2f4">Current</td>'
        f'<td align="right" style="padding:6px 0;font-weight:700;border-top:1px solid #f0f2f4;'
        f'color:{color}">${price:,.2f}</td></tr>'
        '</table>'

        f'{t.button(f"View {symbol} on Ticker Tracker", f"{t.APP_URL}/?sym={symbol}")}'
        '<p style="margin:16px 0 0;font-size:12px;color:#8b93a0">'
        "You're receiving this because you set an alert on this ticker. "
        'Manage alerts in your watchlist, or turn off alert emails in Settings.</p>'
    )
    return t.shell(f"{symbol} hit your {label}", body,
                   preheader=f"{symbol} is at ${price:,.2f} — {moved} your {label}.")


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
            hit = _evaluate(w, price)
            if not hit:
                continue
            level, direction, kind = hit
            user = s.get(models.User, w.user_id)
            settings = s.get(models.Settings, w.user_id)
            if not user or not user.email:
                continue
            if settings is not None and not settings.alert_notifs:
                continue
            label = "price target" if kind == "target" else "alert price"
            ok = send_fn(user.email,
                         f"{w.symbol} hit your {label}",
                         _alert_email_html(w.symbol, price, level, direction, kind))
            if ok:
                s.add(models.AlertLog(user_id=w.user_id, symbol=w.symbol, price=price))
                w.alert_last_fired_at = now
                fired += 1
        s.commit()
    return fired


def _seed_for_test(user_email, symbol, alert_price=0, alert_dir="above",
                   alert_active=False, target=0):
    """Test helper: create a user + watchlist item (armed alert and/or target)."""
    with db.get_session() as s:
        u = models.User(email=user_email, name="t", email_verified=True)
        s.add(u); s.flush()
        s.add(models.Settings(user_id=u.id, alert_notifs=True))
        s.add(models.WatchlistItem(user_id=u.id, symbol=symbol,
                                   alert_price=alert_price, alert_dir=alert_dir,
                                   alert_active=alert_active, target=target))
        s.commit()
