# backend/tests/test_crypto_alerts.py
import db
import models
import services.alerts as alerts


def _seed(email, symbol, kind, target):
    with db.get_session() as s:
        u = models.User(email=email, name="t", email_verified=True)
        s.add(u); s.flush()
        s.add(models.Settings(user_id=u.id, alert_notifs=True))
        # Price-hit alert emails are a Pro feature (billing.is_pro gate in
        # check_alerts), so seed an active Pro subscription for the alert to fire.
        s.add(models.BillingSubscription(user_id=u.id, status="active", plan="pro"))
        s.add(models.WatchlistItem(user_id=u.id, symbol=symbol, kind=kind, target=target))
        s.commit()


def test_crypto_target_fires(monkeypatch):
    db.Base.metadata.create_all(db.engine)
    _seed("c1@t.co", "solana", "crypto", target=100)
    sent = []
    fired = alerts.check_alerts(
        crypto_price_fn=lambda ids: {"solana": {"price": 150.0, "change_pct": 5}},
        quote_fn=lambda syms: ({}, "test"),
        send_fn=lambda to, subj, html: sent.append((to, subj)) or True)
    assert fired == 1 and sent and "solana" in sent[0][1]


def test_crypto_below_target_does_not_fire(monkeypatch):
    db.Base.metadata.create_all(db.engine)
    _seed("c2@t.co", "cardano", "crypto", target=500)
    fired = alerts.check_alerts(
        crypto_price_fn=lambda ids: {"cardano": {"price": 1.2, "change_pct": -1}},
        quote_fn=lambda syms: ({}, "test"),
        send_fn=lambda to, subj, html: True)
    assert fired == 0
