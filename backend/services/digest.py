# backend/services/digest.py
import logging
import os
import secrets
import db
import models
import services.billing as billing
from services.quotes import get_quotes
from providers.email import _send
from services import watchlists as _wl

logger = logging.getLogger(__name__)

APP_BASE_URL = os.environ.get("APP_BASE_URL", "https://tickertracker.info")


def get_or_create_unsub_token(user_id: int) -> str:
    """Return the stable per-user unsubscribe token, creating one if absent."""
    with db.get_session() as s:
        st = s.get(models.Settings, user_id)
        if st is None:
            raise ValueError(f"No Settings row for user_id={user_id}")
        if st.unsub_token:
            return st.unsub_token
        token = secrets.token_urlsafe(12)
        st.unsub_token = token
        s.commit()
        return token


def unsubscribe(token: str) -> bool:
    """Find the Settings row by unsub_token; set news_digest=False. Idempotent."""
    with db.get_session() as s:
        st = (s.query(models.Settings)
              .filter(models.Settings.unsub_token == token).first())
        if st is None:
            return False
        st.news_digest = False
        s.commit()
        return True


def build_digest_html(name: str, rows: list[dict], unsub_url: str = "") -> str:
    from html import escape
    from providers import email_templates as t

    safe_name = escape(name or "there")
    greeting = (
        f'<p style="margin:0 0 16px">Hi {safe_name}, here\'s how the tickers '
        'on your watchlist moved this week.</p>'
    )

    if rows:
        cells = []
        for r in rows:
            up = r["change_pct"] >= 0
            color = t.UP if up else t.DOWN
            arrow = "&#9650;" if up else "&#9660;"
            sign = "+" if up else ""
            sym = escape(str(r["symbol"]))
            cells.append(
                '<tr>'
                f'<td style="padding:11px 0;border-top:1px solid #f0f2f4;font-weight:700;'
                f'color:#11151b">{sym}</td>'
                f'<td align="right" style="padding:11px 0;border-top:1px solid #f0f2f4;'
                f'font-weight:600">${r["price"]:,.2f}</td>'
                f'<td align="right" style="padding:11px 0;border-top:1px solid #f0f2f4;'
                f'color:{color};font-weight:700">{arrow} {sign}{r["change_pct"]:.2f}%</td>'
                '</tr>'
            )
        table = (
            '<table role="presentation" cellpadding="0" cellspacing="0" width="100%" '
            'style="font-size:14px;color:#33383f">'
            '<tr><td style="padding:0 0 4px;font-size:11px;color:#8b93a0;'
            'text-transform:uppercase;letter-spacing:.04em">Ticker</td>'
            '<td align="right" style="padding:0 0 4px;font-size:11px;color:#8b93a0;'
            'text-transform:uppercase;letter-spacing:.04em">Price</td>'
            '<td align="right" style="padding:0 0 4px;font-size:11px;color:#8b93a0;'
            'text-transform:uppercase;letter-spacing:.04em">Week</td></tr>'
            + "".join(cells) + '</table>'
        )
    else:
        table = '<p style="color:#8b93a0">Your watchlist is empty — add some tickers to get started.</p>'

    cta = t.button("Open Ticker Tracker", t.APP_URL)
    unsub = (
        f'<p style="margin:18px 0 0;font-size:11.5px;color:#8b93a0">'
        f'<a href="{unsub_url}" style="color:#8b93a0">Unsubscribe from the weekly digest</a></p>'
        if unsub_url else ""
    )
    return t.shell("Your week on the watchlist", greeting + table + cta + unsub,
                   preheader="Here's how your watchlist moved this week.")


def send_weekly_digest(quote_fn=None, send_fn=None) -> int:
    quote_fn = quote_fn or get_quotes
    send_fn = send_fn or _send
    emailed = 0
    with db.get_session() as s:
        opted = (s.query(models.Settings)
                 .filter(models.Settings.news_digest.is_(True)).all())
        for st in opted:
            user = s.get(models.User, st.user_id)
            if not user or not user.email or not user.email_verified:
                continue
            if not billing.is_pro(st.user_id):
                continue  # weekly digest is a Pro feature
            items = (s.query(models.WatchlistItem)
                     .filter_by(user_id=st.user_id)
                     .order_by(models.WatchlistItem.position).all())
            locked = _wl.locked_symbols(st.user_id)
            items = [w for w in items if w.symbol not in locked]
            syms = [w.symbol for w in items]
            quotes, _ = quote_fn(syms) if syms else ({}, "none")
            rows = [{"symbol": w.symbol,
                     "price": quotes.get(w.symbol, {}).get("price", 0.0),
                     "change_pct": quotes.get(w.symbol, {}).get("change_pct", 0.0)}
                    for w in items]
            unsub_token = get_or_create_unsub_token(st.user_id)
            unsub_url = f"{APP_BASE_URL}/api/unsubscribe/{unsub_token}"
            html = build_digest_html(user.name, rows, unsub_url=unsub_url)
            if send_fn(user.email, "Your Ticker Tracker weekly digest", html):
                emailed += 1
    return emailed


def _seed_for_test(email, news_digest, symbol):
    with db.get_session() as s:
        u = models.User(email=email, name="t", email_verified=True)
        s.add(u); s.flush()
        s.add(models.Settings(user_id=u.id, news_digest=news_digest))
        wl = models.Watchlist(user_id=u.id, name="My Watchlist", position=0)
        s.add(wl); s.flush()
        s.add(models.WatchlistItem(user_id=u.id, watchlist_id=wl.id,
                                   symbol=symbol, position=0))
        # Pro subscription so the digest's is_pro() gate passes for this user.
        s.add(models.BillingSubscription(user_id=u.id, status="active", plan="pro"))
        s.commit()
