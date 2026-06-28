# backend/tests/test_alerts_service.py
import datetime as dt
import db, models
import services.alerts as al
from services import premium

def test_should_fire_above():
    assert al.should_fire(101, 100, "above") is True
    assert al.should_fire(99, 100, "above") is False

def test_should_fire_below():
    assert al.should_fire(99, 100, "below") is True
    assert al.should_fire(101, 100, "below") is False

def test_check_alerts_fires_and_stamps(monkeypatch):
    # one armed alert on AAPL above 100; price comes back 150 -> should fire once
    sent = []
    def fake_quote(syms): return ({s: {"price": 150.0} for s in syms}, "test")
    def fake_send(to, subject, html): sent.append((to, subject)); return True

    # Seed an in-memory DB with a user + armed alert.
    al._seed_for_test(user_email="u@e.com", symbol="AAPL",
                      alert_price=100, alert_dir="above", alert_active=True)
    fired = al.check_alerts(quote_fn=fake_quote, send_fn=fake_send)
    assert fired == 1
    assert sent and sent[0][0] == "u@e.com"
    # second run is suppressed by cooldown
    fired2 = al.check_alerts(quote_fn=fake_quote, send_fn=fake_send)
    assert fired2 == 0


def test_check_alerts_fires_on_target_hit(monkeypatch):
    # A watchlist item with ONLY a target (no armed alert) should email when the
    # price reaches/passes the target.
    sent = []
    def fake_quote(syms): return ({s: {"price": 205.0} for s in syms}, "test")
    def fake_send(to, subject, html):
        sent.append((to, subject, html)); return True

    al._seed_for_test(user_email="t@e.com", symbol="MSFT", target=200)
    fired = al.check_alerts(quote_fn=fake_quote, send_fn=fake_send)
    assert fired == 1
    to, subject, html = sent[0]
    assert to == "t@e.com"
    assert "price target" in subject          # labeled as a target hit
    assert "MSFT" in html and "Ticker Tracker" in html  # branded email


def test_target_not_hit_does_not_fire(monkeypatch):
    def fake_quote(syms): return ({s: {"price": 150.0} for s in syms}, "test")
    al._seed_for_test(user_email="n@e.com", symbol="NVDA", target=200)
    fired = al.check_alerts(quote_fn=fake_quote, send_fn=lambda *a: True)
    assert fired == 0


def test_locked_items_excluded_from_alerts():
    """Free user with 12 items (indices 10+11 locked): locked items that WOULD
    satisfy the alert condition must NOT fire; active ones still DO fire."""
    # Reset DB for clean state
    models.Base.metadata.drop_all(db.engine)
    models.Base.metadata.create_all(db.engine)

    # Create a premium user, add 12 items with armed alerts, then downgrade to free
    with db.get_session() as s:
        u = models.User(email="lock@e.com", name="L", email_verified=True, plan="premium")
        s.add(u); s.flush()
        s.add(models.Settings(user_id=u.id, alert_notifs=True))
        # create primary watchlist
        wl = models.Watchlist(user_id=u.id, name="My Watchlist", position=0)
        s.add(wl); s.flush()
        for i in range(12):
            s.add(models.WatchlistItem(
                user_id=u.id, watchlist_id=wl.id,
                symbol=f"TK{i}", position=i,
                alert_price=100.0, alert_dir="above", alert_active=True,
            ))
        s.commit()
        uid = u.id

    # Downgrade to free — items at index >= 10 become locked
    with db.get_session() as s:
        s.get(models.User, uid).plan = "free"; s.commit()

    sent = []
    # Price 150 would trigger every armed alert
    def fake_quote(syms): return ({sym: {"price": 150.0} for sym in syms}, "test")
    def fake_send(to, subject, html): sent.append(subject); return True

    fired = al.check_alerts(quote_fn=fake_quote, send_fn=fake_send)

    # Only the 10 active (non-locked) items should fire
    assert fired == premium.FREE_MAX_ACTIVE_ITEMS
    # Locked symbols (TK10, TK11) must NOT appear in any sent subject
    for locked_sym in ("TK10", "TK11"):
        assert not any(locked_sym in subj for subj in sent), (
            f"Locked symbol {locked_sym} leaked into alerts"
        )
