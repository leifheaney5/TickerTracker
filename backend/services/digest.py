# backend/services/digest.py
import logging
import db
import models
from services.quotes import get_quotes
from providers.email import _send

logger = logging.getLogger(__name__)


def build_digest_html(name: str, rows: list[dict]) -> str:
    greeting = f"<p>Hi {name or 'there'}, here's your watchlist this week:</p>"
    items = "".join(
        f"<li><b>{r['symbol']}</b>: ${r['price']:,.2f} "
        f"({'+' if r['change_pct'] >= 0 else ''}{r['change_pct']:.2f}%)</li>"
        for r in rows
    )
    body = f"<ul>{items}</ul>" if rows else "<p>Your watchlist is empty.</p>"
    return (greeting + body +
            '<p><a href="https://tickertracker.info">Open Ticker Tracker</a></p>')


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
            items = (s.query(models.WatchlistItem)
                     .filter_by(user_id=st.user_id)
                     .order_by(models.WatchlistItem.position).all())
            syms = [w.symbol for w in items]
            quotes, _ = quote_fn(syms) if syms else ({}, "none")
            rows = [{"symbol": w.symbol,
                     "price": quotes.get(w.symbol, {}).get("price", 0.0),
                     "change_pct": quotes.get(w.symbol, {}).get("change_pct", 0.0)}
                    for w in items]
            if send_fn(user.email, "Your Ticker Tracker weekly digest",
                       build_digest_html(user.name, rows)):
                emailed += 1
    return emailed


def _seed_for_test(email, news_digest, symbol):
    with db.get_session() as s:
        u = models.User(email=email, name="t", email_verified=True)
        s.add(u); s.flush()
        s.add(models.Settings(user_id=u.id, news_digest=news_digest))
        s.add(models.WatchlistItem(user_id=u.id, symbol=symbol))
        s.commit()
