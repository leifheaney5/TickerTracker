import os
os.environ.setdefault("DATABASE_URL", "sqlite://")
import db, models
from services import premium


def _fresh():
    models.Base.metadata.drop_all(db.engine)
    models.Base.metadata.create_all(db.engine)


def test_default_plan_is_free_and_not_premium():
    _fresh()
    with db.get_session() as s:
        u = models.User(email="a@b.com", name="A")
        s.add(u); s.commit()
        assert u.plan == "free"
        assert premium.is_premium(u) is False


def test_premium_flag_detected():
    _fresh()
    with db.get_session() as s:
        u = models.User(email="p@b.com", name="P", plan="premium")
        s.add(u); s.commit()
        assert premium.is_premium(u) is True
