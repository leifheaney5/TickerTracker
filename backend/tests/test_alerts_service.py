# backend/tests/test_alerts_service.py
import datetime as dt
import db, models
import services.alerts as al

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


def test_price_hit_email_only_for_pro_users():
    import services.billing as billing  # noqa: F401
    # Free + Pro user, both with an armed alert that should fire at price 200.
    with db.get_session() as s:
        free = models.User(email="free_al@example.com", name="F", email_verified=True)
        pro = models.User(email="pro_al@example.com", name="P", email_verified=True)
        s.add(free); s.add(pro); s.flush()
        s.add(models.Settings(user_id=free.id, alert_notifs=True))
        s.add(models.Settings(user_id=pro.id, alert_notifs=True))
        s.add(models.WatchlistItem(user_id=free.id, symbol="AAPL",
                                   alert_price=150, alert_dir="above", alert_active=True))
        s.add(models.WatchlistItem(user_id=pro.id, symbol="AAPL",
                                   alert_price=150, alert_dir="above", alert_active=True))
        s.add(models.BillingSubscription(user_id=pro.id, status="active", plan="pro"))
        s.commit()
    sent = []
    n = al.check_alerts(
        quote_fn=lambda syms: ({s: {"price": 200.0} for s in syms}, "mock"),
        send_fn=lambda to, subj, html: sent.append(to) or True,
    )
    assert n == 1 and sent == ["pro_al@example.com"]
