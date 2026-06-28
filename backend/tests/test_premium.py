import os
os.environ.setdefault("DATABASE_URL", "sqlite://")
import db, models
from services import premium


def _fresh():
    models.Base.metadata.drop_all(db.engine)
    models.Base.metadata.create_all(db.engine)


def test_billing_disabled_treats_everyone_as_premium(monkeypatch):
    # Premium is billing-backed; with billing OFF there is no enforcement, so
    # everyone is effectively unlimited (no behavior regression pre-launch).
    monkeypatch.delenv("BILLING_ENABLED", raising=False)
    _fresh()
    with db.get_session() as s:
        u = models.User(email="a@b.com", name="A")
        s.add(u); s.commit()
        assert premium.is_premium(u) is True


def test_free_user_not_premium_when_billing_enabled(monkeypatch):
    monkeypatch.setenv("BILLING_ENABLED", "1")
    _fresh()
    with db.get_session() as s:
        u = models.User(email="f@b.com", name="F")
        s.add(u); s.commit()
        assert premium.is_premium(u) is False


def test_pro_subscriber_is_premium_when_billing_enabled(monkeypatch):
    monkeypatch.setenv("BILLING_ENABLED", "1")
    _fresh()
    with db.get_session() as s:
        u = models.User(email="p@b.com", name="P")
        s.add(u); s.flush()
        s.add(models.BillingSubscription(user_id=u.id, status="active", plan="pro"))
        s.commit()
        assert premium.is_premium(u) is True
