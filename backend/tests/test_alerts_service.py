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
