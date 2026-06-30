# backend/services/alerts.py
import datetime as dt
import logging
import db
import models
import services.billing as billing
from services.quotes import get_quotes
from providers.email import _send
from services import watchlists as _wl
from services.history import get_history as _get_history
from services.earnings import get_earnings as _get_earnings

logger = logging.getLogger(__name__)
COOLDOWN = dt.timedelta(hours=12)
# Earnings alert cooldown: 24 h so the same event doesn't spam every cron run.
EARNINGS_COOLDOWN = dt.timedelta(hours=24)


# ─── Pure helpers ─────────────────────────────────────────────────────────────

def should_fire(price: float, alert_price: float, alert_dir: str) -> bool:
    if not alert_price:
        return False
    if alert_dir == "below":
        return price <= alert_price
    return price >= alert_price  # default "above"


def volume_spike_triggered(today_vol: int, prior_vols: list, pct: float) -> bool:
    """Return True when today_vol exceeds the trailing average by at least pct%.

    Args:
        today_vol:  today's raw session volume (integer).
        prior_vols: list of prior session volumes (e.g. last 20 daily closes).
                    Must be non-empty; volumes of zero are included in the avg.
        pct:        spike threshold in percent above the average (e.g. 100 → 2x avg).
                    Values <= 0 are treated as misconfigured and never fire.

    Returns:
        True if today_vol >= avg(prior_vols) * (1 + pct / 100), else False.
    """
    if not prior_vols:
        return False
    if pct < 0:
        return False
    avg = sum(prior_vols) / len(prior_vols)
    if avg == 0:
        return False
    return today_vol >= avg * (1 + pct / 100)


def earnings_within(next_earnings_date: dt.date, today: dt.date, days: int) -> bool:
    """Return True when next_earnings_date falls within [today, today + days].

    Args:
        next_earnings_date: the upcoming earnings date (date object).
        today:              reference date for the check.
        days:               lookahead window in days.  0 or negative → never fires.

    Returns:
        True if 0 <= (next_earnings_date - today).days <= days, else False.
    """
    if days <= 0:
        return False
    delta = (next_earnings_date - today).days
    return 0 <= delta <= days


# ─── Internal helpers ─────────────────────────────────────────────────────────

def due_alerts(session, now=None):
    """Watchlist items eligible to notify this run, off cooldown. An item is
    eligible if it has an armed alert (alert_active + alert_price) OR a price
    target set — so just setting a target on a card gets you an email.
    Locked items (free-user overflow beyond FREE_MAX_ACTIVE_ITEMS) are excluded."""
    now = now or dt.datetime.utcnow()
    rows = session.query(models.WatchlistItem).all()
    # Cache per-user LOCKED symbol sets so we don't recompute N times for N items
    # of the same user. Exclude only locked (free-overflow) items; items not in
    # any list are not locked and remain eligible.
    _locked_cache: dict = {}
    out = []
    for w in rows:
        has_alert = bool(w.alert_active) and (w.alert_price or 0) > 0
        has_target = (w.target or 0) > 0
        has_vol_spike = (w.vol_spike_pct or 0) > 0
        has_earnings = (w.earnings_days or 0) > 0
        if not (has_alert or has_target or has_vol_spike or has_earnings):
            continue
        # Exclude locked (free overflow) items
        if w.user_id not in _locked_cache:
            _locked_cache[w.user_id] = _wl.locked_symbols(w.user_id)
        if w.symbol in _locked_cache[w.user_id]:
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

    def _fmt(v):
        # Sub-$1 coins need more precision than 2dp.
        if v >= 1:
            return f"${v:,.2f}"
        return f"${v:,.4f}"

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
        f'{_fmt(price)} <span style="font-size:16px;color:{color}">{arrow}</span></div>'
        f'<div style="margin-top:8px">'
        f'{t.stat_pill(f"{sign}{diff_pct:.2f}% vs your {label}", color)}'
        f'</div>'
        '</td></tr></table>'

        # Detail rows
        '<table role="presentation" cellpadding="0" cellspacing="0" width="100%" '
        'style="font-size:13.5px;color:#33383f">'
        f'<tr><td style="padding:6px 0;color:#8b93a0">Your {label}</td>'
        f'<td align="right" style="padding:6px 0;font-weight:700">{_fmt(level)}</td></tr>'
        f'<tr><td style="padding:6px 0;color:#8b93a0;border-top:1px solid #f0f2f4">Current</td>'
        f'<td align="right" style="padding:6px 0;font-weight:700;border-top:1px solid #f0f2f4;'
        f'color:{color}">{_fmt(price)}</td></tr>'
        '</table>'

        f'{t.button(f"View {symbol} on Ticker Tracker", f"{t.APP_URL}/ticker/{symbol}")}'
        '<p style="margin:16px 0 0;font-size:12px;color:#8b93a0">'
        "You're receiving this because you set an alert on this ticker. "
        'Manage alerts in your watchlist, or turn off alert emails in Settings.</p>'
    )
    return t.shell(f"{symbol} hit your {label}", body,
                   preheader=f"{symbol} is at {_fmt(price)} — {moved} your {label}.")


def _vol_spike_email_html(symbol, today_vol, avg_vol, pct_above):
    """Branded email for a volume-spike alert."""
    from html import escape
    from providers import email_templates as t
    symbol = escape(str(symbol))

    def _fmt_vol(v):
        if v >= 1_000_000:
            return f"{v/1_000_000:.1f}M"
        if v >= 1_000:
            return f"{v/1_000:.0f}K"
        return str(v)

    body = (
        f'<p style="margin:0 0 18px;font-size:15px">'
        f'<b style="color:#11151b">{symbol}</b> is seeing unusually high trading volume today.</p>'

        '<table role="presentation" cellpadding="0" cellspacing="0" width="100%" '
        'style="margin:0 0 16px;border:1px solid #eceef1;border-radius:12px">'
        '<tr><td style="padding:16px 18px">'
        f'<div style="font-size:12px;color:#8b93a0;text-transform:uppercase;letter-spacing:.04em">'
        f'{symbol} &middot; volume spike</div>'
        f'<div style="font-size:30px;font-weight:800;color:#11151b;margin-top:2px">'
        f'{_fmt_vol(today_vol)} <span style="font-size:16px;color:{t.UP}">&#9650;</span></div>'
        f'<div style="margin-top:8px">'
        f'{t.stat_pill(f"+{pct_above:.0f}% vs 20-day avg", t.UP)}'
        f'</div>'
        '</td></tr></table>'

        '<table role="presentation" cellpadding="0" cellspacing="0" width="100%" '
        'style="font-size:13.5px;color:#33383f">'
        f'<tr><td style="padding:6px 0;color:#8b93a0">Today\'s volume</td>'
        f'<td align="right" style="padding:6px 0;font-weight:700">{_fmt_vol(today_vol)}</td></tr>'
        f'<tr><td style="padding:6px 0;color:#8b93a0;border-top:1px solid #f0f2f4">20-day avg</td>'
        f'<td align="right" style="padding:6px 0;font-weight:700;border-top:1px solid #f0f2f4">'
        f'{_fmt_vol(int(avg_vol))}</td></tr>'
        '</table>'

        f'{t.button(f"View {symbol} on Ticker Tracker", f"{t.APP_URL}/ticker/{symbol}")}'
        '<p style="margin:16px 0 0;font-size:12px;color:#8b93a0">'
        "You're receiving this because you set a volume spike alert on this ticker. "
        'Manage alerts in your watchlist, or turn off alert emails in Settings.</p>'
    )
    return t.shell(f"{symbol} volume spike", body,
                   preheader=f"{symbol} volume is {_fmt_vol(today_vol)} — {pct_above:.0f}% above average.")


def _earnings_email_html(symbol, earnings_date, days_away, eps_estimate):
    """Branded email for an upcoming earnings alert."""
    from html import escape
    from providers import email_templates as t
    symbol = escape(str(symbol))
    date_str = earnings_date.strftime("%B %d, %Y").replace(" 0", " ") if hasattr(earnings_date, "strftime") else str(earnings_date)
    days_label = "tomorrow" if days_away == 1 else (f"today" if days_away == 0 else f"in {days_away} days")
    eps_str = (f"${eps_estimate:.2f}" if eps_estimate is not None else "—")

    body = (
        f'<p style="margin:0 0 18px;font-size:15px">'
        f'<b style="color:#11151b">{symbol}</b> reports earnings {days_label}.</p>'

        '<table role="presentation" cellpadding="0" cellspacing="0" width="100%" '
        'style="margin:0 0 16px;border:1px solid #eceef1;border-radius:12px">'
        '<tr><td style="padding:16px 18px">'
        f'<div style="font-size:12px;color:#8b93a0;text-transform:uppercase;letter-spacing:.04em">'
        f'{symbol} &middot; upcoming earnings</div>'
        f'<div style="font-size:24px;font-weight:800;color:#11151b;margin-top:2px">'
        f'{date_str}</div>'
        f'<div style="margin-top:8px">'
        f'{t.stat_pill(days_label, t.ACCENT)}'
        f'</div>'
        '</td></tr></table>'

        '<table role="presentation" cellpadding="0" cellspacing="0" width="100%" '
        'style="font-size:13.5px;color:#33383f">'
        f'<tr><td style="padding:6px 0;color:#8b93a0">EPS estimate</td>'
        f'<td align="right" style="padding:6px 0;font-weight:700">{eps_str}</td></tr>'
        '</table>'

        f'{t.button(f"View {symbol} on Ticker Tracker", f"{t.APP_URL}/ticker/{symbol}")}'
        '<p style="margin:16px 0 0;font-size:12px;color:#8b93a0">'
        "You're receiving this because you set an earnings alert on this ticker. "
        'Manage alerts in your watchlist, or turn off alert emails in Settings.</p>'
    )
    return t.shell(f"{symbol} earnings {days_label}", body,
                   preheader=f"{symbol} reports earnings {days_label} ({date_str}).")


def _last_alert_log(session, user_id: int, symbol: str, kind: str, since: dt.datetime):
    """Return the most recent AlertLog for (user_id, symbol, alert_kind=kind) after `since`."""
    return (
        session.query(models.AlertLog)
        .filter(
            models.AlertLog.user_id == user_id,
            models.AlertLog.symbol == symbol,
            models.AlertLog.alert_kind == kind,
            models.AlertLog.triggered_at >= since,
        )
        .order_by(models.AlertLog.triggered_at.desc())
        .first()
    )


def _send_push_best_effort(session, user_id: int, payload: dict):
    """Send a web push to all active subscriptions for user_id.

    Subscriptions that return 404/410 are pruned. This is best-effort: failures
    do not propagate. Returns the number of successful sends.
    """
    from providers.webpush import send_push, WebPushException
    subs = session.query(models.PushSubscription).filter_by(user_id=user_id).all()
    ok = 0
    to_prune = []
    for sub in subs:
        try:
            result = send_push(
                {"endpoint": sub.endpoint, "p256dh": sub.p256dh, "auth": sub.auth},
                payload,
            )
            if result:
                ok += 1
        except WebPushException:
            to_prune.append(sub.id)
        except Exception as e:
            logger.warning("push delivery failed for sub %s: %s", sub.id, e)
    for sid in to_prune:
        session.query(models.PushSubscription).filter_by(id=sid).delete()
    return ok


# ─── Main cron entrypoint ─────────────────────────────────────────────────────

def check_alerts(now=None, quote_fn=None, send_fn=None, crypto_price_fn=None,
                 get_history_fn=None, get_earnings_fn=None) -> int:
    """Evaluate all alert rules and dispatch notifications.

    Returns the total number of notifications fired (email + push each count 1).

    Keyword args allow injection in tests:
      quote_fn       — override get_quotes (stock prices)
      send_fn        — override _send (email delivery)
      crypto_price_fn — override get_crypto_prices
      get_history_fn  — override _get_history (daily bars for vol-spike)
      get_earnings_fn — override _get_earnings (calendar for earnings alert)
    """
    now = now or dt.datetime.utcnow()
    today = now.date()
    quote_fn = quote_fn or get_quotes
    send_fn = send_fn or _send
    history_fn = get_history_fn or _get_history
    earnings_fn = get_earnings_fn or _get_earnings
    if crypto_price_fn is None:
        from services.crypto import get_crypto_prices
        crypto_price_fn = get_crypto_prices
    fired = 0
    with db.get_session() as s:
        due = due_alerts(s, now=now)
        if not due:
            return 0

        # ── 1. Price / target alerts ─────────────────────────────────────────
        stock = [w for w in due if (w.kind or "stock") != "crypto"]
        crypto = [w for w in due if (w.kind or "stock") == "crypto"]
        prices = {}
        if stock:
            quotes, _ = quote_fn(sorted({w.symbol for w in stock}))
            prices.update({sym: q["price"] for sym, q in quotes.items()})
        if crypto:
            cp = crypto_price_fn(sorted({w.symbol for w in crypto}))
            prices.update({cid: p["price"] for cid, p in cp.items()})

        for w in due:
            price = prices.get(w.symbol)
            if price is None:
                continue
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
            if not billing.is_pro(w.user_id):
                continue  # price-hit alert emails are a Pro feature
            label = "price target" if kind == "target" else "alert price"
            display = w.coin_name or w.symbol
            ok = send_fn(user.email,
                         f"{display} hit your {label}",
                         _alert_email_html(display, price, level, direction, kind))
            if ok:
                s.add(models.AlertLog(user_id=w.user_id, symbol=w.symbol,
                                      price=price, alert_kind="price"))
                w.alert_last_fired_at = now
                # Best-effort push
                push_payload = {
                    "title": f"{display} hit your {label}",
                    "body": f"Current price: {'$' + f'{price:,.2f}'}",
                    "url": f"/ticker/{w.symbol}",
                }
                _send_push_best_effort(s, w.user_id, push_payload)
                fired += 1

        # ── 2. Volume-spike alerts ────────────────────────────────────────────
        vol_items = [w for w in due if (w.vol_spike_pct or 0) > 0
                     and (w.kind or "stock") != "crypto"]
        for w in vol_items:
            user = s.get(models.User, w.user_id)
            settings = s.get(models.Settings, w.user_id)
            if not user or not user.email:
                continue
            if settings is not None and not settings.alert_notifs:
                continue
            if not billing.is_pro(w.user_id):
                continue
            # Cooldown: only fire once per 24 h for volume spike
            since = now - dt.timedelta(hours=24)
            if _last_alert_log(s, w.user_id, w.symbol, "volume_spike", since):
                continue
            try:
                bars, _, _ = history_fn(w.symbol, "3M")
            except Exception as e:
                logger.warning("vol spike: history fetch failed for %s: %s", w.symbol, e)
                continue
            if not bars or len(bars) < 2:
                continue
            # Last bar is "today"; prior N bars are the trailing avg baseline.
            # Use up to 20 prior sessions (exclude today's bar).
            prior_bars = bars[:-1]
            prior_vols = [b.get("v", 0) or 0 for b in prior_bars[-20:]]
            today_vol = bars[-1].get("v", 0) or 0
            if not volume_spike_triggered(today_vol, prior_vols, w.vol_spike_pct):
                continue
            avg_vol = sum(prior_vols) / len(prior_vols) if prior_vols else 0
            pct_above = ((today_vol - avg_vol) / avg_vol * 100) if avg_vol else 0
            display = w.coin_name or w.symbol
            ok = send_fn(
                user.email,
                f"{display} volume spike — {pct_above:.0f}% above average",
                _vol_spike_email_html(display, today_vol, avg_vol, pct_above),
            )
            if ok:
                s.add(models.AlertLog(user_id=w.user_id, symbol=w.symbol,
                                      price=0.0, alert_kind="volume_spike"))
                w.alert_last_fired_at = now
                push_payload = {
                    "title": f"{display} volume spike",
                    "body": f"Volume is {pct_above:.0f}% above the 20-day average",
                    "url": f"/ticker/{w.symbol}",
                }
                _send_push_best_effort(s, w.user_id, push_payload)
                fired += 1

        # ── 3. Earnings proximity alerts ─────────────────────────────────────
        earn_items = [w for w in due if (w.earnings_days or 0) > 0
                      and (w.kind or "stock") != "crypto"]
        if earn_items:
            earn_syms = list({w.symbol for w in earn_items})
            try:
                calendar, _ = earnings_fn(earn_syms)
            except Exception as e:
                logger.warning("earnings alert: calendar fetch failed: %s", e)
                calendar = []

            # Build a map: symbol → earliest upcoming date
            _next_earn: dict = {}
            for row in calendar:
                sym = (row.get("symbol") or "").upper()
                date_str = row.get("date") or ""
                if not sym or not date_str:
                    continue
                try:
                    d = dt.date.fromisoformat(date_str)
                except ValueError:
                    continue
                if d < today:
                    continue
                if sym not in _next_earn or d < _next_earn[sym][0]:
                    _next_earn[sym] = (d, row.get("epsEstimate"))

            for w in earn_items:
                sym_upper = w.symbol.upper()
                earn_info = _next_earn.get(sym_upper)
                if not earn_info:
                    continue
                earn_date, eps_est = earn_info
                if not earnings_within(earn_date, today, w.earnings_days):
                    continue
                user = s.get(models.User, w.user_id)
                settings = s.get(models.Settings, w.user_id)
                if not user or not user.email:
                    continue
                if settings is not None and not settings.alert_notifs:
                    continue
                if not billing.is_pro(w.user_id):
                    continue
                # De-dupe: don't email for the same event within 24 h
                since = now - EARNINGS_COOLDOWN
                if _last_alert_log(s, w.user_id, w.symbol, "earnings", since):
                    continue
                days_away = (earn_date - today).days
                display = w.coin_name or w.symbol
                ok = send_fn(
                    user.email,
                    f"{display} earnings in {days_away} day{'s' if days_away != 1 else ''}",
                    _earnings_email_html(display, earn_date, days_away, eps_est),
                )
                if ok:
                    s.add(models.AlertLog(user_id=w.user_id, symbol=w.symbol,
                                          price=0.0, alert_kind="earnings"))
                    w.alert_last_fired_at = now
                    push_payload = {
                        "title": f"{display} earnings {('in ' + str(days_away) + ' days') if days_away else 'today'}",
                        "body": f"Reports on {earn_date.strftime('%b %d').replace(' 0', ' ')}",
                        "url": f"/ticker/{w.symbol}",
                    }
                    _send_push_best_effort(s, w.user_id, push_payload)
                    fired += 1

        s.commit()
    return fired


def _seed_for_test(user_email, symbol, alert_price=0, alert_dir="above",
                   alert_active=False, target=0):
    """Test helper: create a user + primary watchlist + watchlist item (armed alert and/or target)."""
    with db.get_session() as s:
        u = models.User(email=user_email, name="t", email_verified=True)
        s.add(u); s.flush()
        s.add(models.Settings(user_id=u.id, alert_notifs=True))
        wl = models.Watchlist(user_id=u.id, name="My Watchlist", position=0)
        s.add(wl); s.flush()
        s.add(models.WatchlistItem(user_id=u.id, watchlist_id=wl.id, symbol=symbol,
                                   position=0,
                                   alert_price=alert_price, alert_dir=alert_dir,
                                   alert_active=alert_active, target=target))
        s.add(models.BillingSubscription(user_id=u.id, status="active", plan="pro"))
        s.commit()
