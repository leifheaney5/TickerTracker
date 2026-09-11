# backend/tests/test_alert_depth.py
# TDD tests for F1 (volume-spike) + F2 (earnings) + F3 (push) new alert rules.
# Written BEFORE the implementation so they fail first.

import datetime as dt
import db
import models
import services.alerts as al


# ─── Feature 1: volume_spike_triggered (pure helper) ─────────────────────────

def test_volume_spike_triggered_basic():
    """Today's volume 2x the 20-session average should trigger at 100% threshold."""
    prior = [1_000_000] * 20   # avg = 1M
    assert al.volume_spike_triggered(2_000_000, prior, 100) is True


def test_volume_spike_not_triggered():
    """Volume only 10% above average; 50% threshold should NOT fire."""
    prior = [1_000_000] * 20
    assert al.volume_spike_triggered(1_100_000, prior, 50) is False


def test_volume_spike_exact_threshold():
    """Exactly at threshold (0% margin) should fire."""
    prior = [1_000_000] * 20   # avg = 1M; threshold 0% → >= 1M
    assert al.volume_spike_triggered(1_000_000, prior, 0) is True


def test_volume_spike_empty_prior():
    """No prior volumes → cannot compute avg → no fire."""
    assert al.volume_spike_triggered(9_999_999, [], 50) is False


def test_volume_spike_negative_pct():
    """Negative threshold is nonsensical → treat as no-fire."""
    prior = [1_000_000] * 20
    assert al.volume_spike_triggered(1_000_000, prior, -10) is False


def test_volume_spike_zero_avg():
    """If prior vols are all zero, avoid div/0 → no fire."""
    prior = [0] * 20
    assert al.volume_spike_triggered(500, prior, 50) is False


def test_volume_spike_partial_prior():
    """Works correctly with fewer than 20 prior sessions (e.g. new listing)."""
    prior = [500_000, 600_000, 700_000]   # avg = 600k
    # 900_000 is 50% above 600k → fires at 50% threshold
    assert al.volume_spike_triggered(900_000, prior, 50) is True


# ─── Feature 2: earnings_within (pure helper) ─────────────────────────────────

def test_earnings_within_true():
    today = dt.date(2026, 7, 1)
    next_earnings = dt.date(2026, 7, 5)   # 4 days away
    assert al.earnings_within(next_earnings, today, 7) is True


def test_earnings_within_false():
    today = dt.date(2026, 7, 1)
    next_earnings = dt.date(2026, 7, 15)  # 14 days away
    assert al.earnings_within(next_earnings, today, 7) is False


def test_earnings_within_same_day():
    today = dt.date(2026, 7, 10)
    assert al.earnings_within(today, today, 1) is True


def test_earnings_within_zero_days():
    """days=0 → never fire (misconfigured / disabled)."""
    today = dt.date(2026, 7, 1)
    assert al.earnings_within(today, today, 0) is False


def test_earnings_in_past():
    """Earnings date in the past → should NOT fire (delta < 0)."""
    today = dt.date(2026, 7, 10)
    past = dt.date(2026, 7, 5)
    assert al.earnings_within(past, today, 7) is False


# ─── Feature 1 integration: volume_spike fires via check_alerts ───────────────

def _seed_vol_alert(user_email, symbol, vol_spike_pct):
    """Seed a user + Pro subscription + watchlist item with vol_spike_pct set."""
    with db.get_session() as s:
        u = models.User(email=user_email, name="vtest", email_verified=True)
        s.add(u); s.flush()
        s.add(models.Settings(user_id=u.id, alert_notifs=True))
        wl = models.Watchlist(user_id=u.id, name="W", position=0)
        s.add(wl); s.flush()
        s.add(models.WatchlistItem(
            user_id=u.id, watchlist_id=wl.id, symbol=symbol,
            position=0, vol_spike_pct=vol_spike_pct,
        ))
        s.add(models.BillingSubscription(user_id=u.id, status="active", plan="pro"))
        s.commit()


def test_volume_spike_alert_fires(monkeypatch):
    """Volume spike integration: when today's vol is 3x average, an email is sent."""
    _seed_vol_alert("volspike@example.com", "TSLA", 100.0)

    sent = []

    # 20 prior daily bars with volume 1M each, today's bar = 3M (200% spike > 100% threshold)
    prior_bars = [{"date": "2026-06-01", "c": 100.0, "v": 1_000_000}] * 20
    today_bar = {"date": "2026-06-29", "c": 102.0, "v": 3_000_000}

    def fake_get_history(sym, tf):
        return prior_bars + [today_bar], "yahoo", False

    monkeypatch.setattr(al, "_get_history", fake_get_history)
    monkeypatch.setattr(al, "_send", lambda to, subj, html: sent.append((to, subj)) or True)
    # No price alerts or earnings alerts on these items, only vol_spike
    monkeypatch.setattr(al, "get_quotes", lambda syms: ({}, "mock"))

    fired = al.check_alerts(quote_fn=lambda syms: ({}, "mock"),
                            send_fn=lambda to, subj, html: sent.append((to, subj)) or True,
                            get_history_fn=fake_get_history)
    assert fired >= 1
    subjects = [s for _, s in sent]
    assert any("volume" in s.lower() or "spike" in s.lower() or "TSLA" in s for s in subjects)


def test_volume_spike_no_fire_below_threshold(monkeypatch):
    """Volume only 10% above average; 50% threshold → no fire."""
    _seed_vol_alert("novol@example.com", "AAPL", 50.0)

    prior_bars = [{"date": "2026-06-01", "c": 100.0, "v": 1_000_000}] * 20
    today_bar = {"date": "2026-06-29", "c": 102.0, "v": 1_100_000}

    def fake_get_history(sym, tf):
        return prior_bars + [today_bar], "yahoo", False

    fired = al.check_alerts(quote_fn=lambda syms: ({}, "mock"),
                            send_fn=lambda *a: True,
                            get_history_fn=fake_get_history)
    assert fired == 0


def test_volume_spike_cooldown(monkeypatch):
    """A second check_alerts run within cooldown period does NOT re-fire."""
    _seed_vol_alert("cool_vol@example.com", "NVDA", 100.0)

    prior_bars = [{"date": "2026-06-01", "c": 100.0, "v": 1_000_000}] * 20
    today_bar = {"date": "2026-06-29", "c": 102.0, "v": 3_000_000}

    def fake_get_history(sym, tf):
        return prior_bars + [today_bar], "yahoo", False

    sent = []
    fired1 = al.check_alerts(quote_fn=lambda syms: ({}, "mock"),
                              send_fn=lambda to, s, h: sent.append(to) or True,
                              get_history_fn=fake_get_history)
    fired2 = al.check_alerts(quote_fn=lambda syms: ({}, "mock"),
                              send_fn=lambda to, s, h: sent.append(to) or True,
                              get_history_fn=fake_get_history)
    assert fired1 >= 1
    assert fired2 == 0


# ─── Feature 2 integration: earnings_days fires via check_alerts ──────────────

def _seed_earnings_alert(user_email, symbol, earnings_days):
    with db.get_session() as s:
        u = models.User(email=user_email, name="etest", email_verified=True)
        s.add(u); s.flush()
        s.add(models.Settings(user_id=u.id, alert_notifs=True))
        wl = models.Watchlist(user_id=u.id, name="W", position=0)
        s.add(wl); s.flush()
        s.add(models.WatchlistItem(
            user_id=u.id, watchlist_id=wl.id, symbol=symbol,
            position=0, earnings_days=earnings_days,
        ))
        s.add(models.BillingSubscription(user_id=u.id, status="active", plan="pro"))
        s.commit()


def test_earnings_alert_fires(monkeypatch):
    """Earnings in 3 days, threshold=7 → email is sent."""
    _seed_earnings_alert("earnfire@example.com", "MSFT", 7)

    today = dt.date(2026, 7, 1)
    # earnings 3 days from now
    future_earnings = (today + dt.timedelta(days=3)).isoformat()

    fake_calendar = [{"symbol": "MSFT", "date": future_earnings,
                      "hour": "amc", "epsEstimate": 3.00}]

    sent = []
    fired = al.check_alerts(
        now=dt.datetime.combine(today, dt.time(9, 0)),
        quote_fn=lambda syms: ({}, "mock"),
        send_fn=lambda to, subj, html: sent.append((to, subj)) or True,
        get_earnings_fn=lambda syms: (fake_calendar, "finnhub"),
    )
    assert fired >= 1
    assert any("earnfire@example.com" == t for t, _ in sent)


def test_earnings_alert_dedupe(monkeypatch):
    """Same earnings event within cooldown → second run does NOT re-fire."""
    _seed_earnings_alert("dedup_earn@example.com", "GOOG", 7)

    today = dt.date(2026, 7, 1)
    future_earnings = (today + dt.timedelta(days=3)).isoformat()
    fake_calendar = [{"symbol": "GOOG", "date": future_earnings,
                      "hour": "bmo", "epsEstimate": 1.50}]

    sent = []

    def run():
        return al.check_alerts(
            now=dt.datetime.combine(today, dt.time(9, 0)),
            quote_fn=lambda syms: ({}, "mock"),
            send_fn=lambda to, s, h: sent.append(to) or True,
            get_earnings_fn=lambda syms: (fake_calendar, "finnhub"),
        )

    fired1 = run()
    fired2 = run()
    assert fired1 >= 1
    assert fired2 == 0


def test_earnings_alert_not_fired_when_too_far(monkeypatch):
    """Earnings 30 days away; threshold=7 → no fire."""
    _seed_earnings_alert("faraway@example.com", "AMZN", 7)

    today = dt.date(2026, 7, 1)
    future_earnings = (today + dt.timedelta(days=30)).isoformat()
    fake_calendar = [{"symbol": "AMZN", "date": future_earnings,
                      "hour": "bmo", "epsEstimate": 1.00}]

    fired = al.check_alerts(
        now=dt.datetime.combine(today, dt.time(9, 0)),
        quote_fn=lambda syms: ({}, "mock"),
        send_fn=lambda *a: True,
        get_earnings_fn=lambda syms: (fake_calendar, "finnhub"),
    )
    assert fired == 0


# ─── Feature 3: push subscribe / unsubscribe routes ──────────────────────────

def _push_client(email: str):
    """Create a verified user and return a logged-in test client."""
    from app import app as flask_app
    from auth.passwords import hash_password

    with db.get_session() as s:
        u = models.User(email=email, name="P", email_verified=True,
                        password_hash=hash_password("pw123"))
        s.add(u); s.flush()
        s.add(models.Settings(user_id=u.id))
        s.commit()

    client = flask_app.test_client()
    client.post("/api/auth/login", json={"email": email, "password": "pw123"})
    return client


def test_push_subscribe_upsert():
    """POST /api/push/subscribe upserts a PushSubscription for an authed user."""
    email = "pushuser@example.com"
    client = _push_client(email)
    payload = {
        "endpoint": "https://fcm.googleapis.com/fcm/send/abc123",
        "keys": {"p256dh": "BAAAAAAA", "auth": "secretXX"},
    }
    resp = client.post("/api/push/subscribe",
                       json=payload,
                       environ_base={"REMOTE_ADDR": "127.0.0.1"})
    assert resp.status_code == 200
    with db.get_session() as s:
        u = s.query(models.User).filter_by(email=email).first()
        sub = s.query(models.PushSubscription).filter_by(user_id=u.id).first()
        assert sub is not None
        assert sub.endpoint == payload["endpoint"]


def test_push_unsubscribe():
    """POST /api/push/unsubscribe removes the subscription record."""
    email = "pushunsub@example.com"
    ep = "https://fcm.googleapis.com/fcm/send/xyz999"
    client = _push_client(email)
    # Pre-seed a subscription
    with db.get_session() as s:
        u = s.query(models.User).filter_by(email=email).first()
        s.add(models.PushSubscription(user_id=u.id, endpoint=ep,
                                      p256dh="BBBBBBBB", auth="secretYY"))
        s.commit()

    resp = client.post("/api/push/unsubscribe",
                       json={"endpoint": ep},
                       environ_base={"REMOTE_ADDR": "127.0.0.1"})
    assert resp.status_code == 200
    with db.get_session() as s:
        u = s.query(models.User).filter_by(email=email).first()
        sub = s.query(models.PushSubscription).filter_by(user_id=u.id).first()
        assert sub is None


def test_push_subscribe_requires_auth():
    """Unauthenticated POST /api/push/subscribe returns 401."""
    from app import app as flask_app
    client = flask_app.test_client()
    payload = {
        "endpoint": "https://fcm.googleapis.com/fcm/send/anon",
        "keys": {"p256dh": "AAAAAAAA", "auth": "secretZZ"},
    }
    resp = client.post("/api/push/subscribe", json=payload,
                       environ_base={"REMOTE_ADDR": "127.0.0.1"})
    assert resp.status_code == 401


def test_vapid_public_key_returns_null_when_unset(monkeypatch):
    """GET /api/push/vapid-public-key returns {key: null} when VAPID_PUBLIC_KEY unset."""
    from app import app as flask_app
    monkeypatch.delenv("VAPID_PUBLIC_KEY", raising=False)
    client = flask_app.test_client()
    resp = client.get("/api/push/vapid-public-key",
                      environ_base={"REMOTE_ADDR": "127.0.0.1"})
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["key"] is None


def test_push_sent_on_alert_fire(monkeypatch):
    """When an alert fires, send_push is called for the user's subscriptions."""
    import providers.webpush as wp

    push_calls = []
    monkeypatch.setattr(wp, "send_push", lambda sub, payload: push_calls.append(sub) or True)

    al._seed_for_test(user_email="pushfire@example.com", symbol="AAPL",
                      alert_price=100, alert_dir="above", alert_active=True)

    # Add a push subscription for the user
    with db.get_session() as s:
        u = s.query(models.User).filter_by(email="pushfire@example.com").first()
        s.add(models.PushSubscription(
            user_id=u.id,
            endpoint="https://fcm.googleapis.com/fcm/send/pushfire",
            p256dh="CCCCCCCC",
            auth="secretAA",
        ))
        s.commit()

    al.check_alerts(
        quote_fn=lambda syms: ({s: {"price": 150.0} for s in syms}, "test"),
        send_fn=lambda *a: True,
    )
    assert len(push_calls) >= 1


def test_push_no_op_when_vapid_unset(monkeypatch):
    """send_push is a no-op when VAPID_PRIVATE_KEY is not set (logs, returns False)."""
    import providers.webpush as wp
    monkeypatch.delenv("VAPID_PRIVATE_KEY", raising=False)
    # Should not raise; returns False gracefully
    result = wp.send_push(
        {"endpoint": "https://example.com/push", "p256dh": "AAAA", "auth": "BBBB"},
        {"title": "Test", "body": "Hello"}
    )
    assert result is False
