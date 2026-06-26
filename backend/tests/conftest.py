import os
os.environ["DATABASE_URL"] = "sqlite://"  # in-memory, before db import
os.environ.setdefault("APP_BASE_URL", "http://localhost:5000")  # required by _base() for email/oauth link building
import pytest
import sys


@pytest.fixture(autouse=True)
def fresh_db():
    import db
    import models
    db.Base.metadata.drop_all(db.engine)
    db.init_db()
    yield


@pytest.fixture
def seed_user(fresh_db, monkeypatch):
    """Opt-in fixture: seeds a user id=1 with Settings and monkeypatches
    current_user_id -> 1 so that store-layer unit tests run with a known uid.
    Tests that need a real session (auth-scoping tests) must NOT request this.
    """
    import db, models, auth
    import services.store as store

    with db.get_session() as s:
        user = models.User(email="test@example.com", name="Test User")
        s.add(user)
        s.flush()
        s.add(models.Settings(user_id=user.id))
        s.commit()

    monkeypatch.setattr(auth, "current_user_id", lambda: 1)
    monkeypatch.setattr(store, "current_user_id", lambda: 1)

    # Patch the direct import in test_models (finds the module regardless of
    # how pytest registered it in sys.modules).
    for mod_name, mod in list(sys.modules.items()):
        if mod is not None and getattr(mod, "__file__", None) and "test_models" in mod_name:
            if hasattr(mod, "current_user_id"):
                monkeypatch.setattr(mod, "current_user_id", lambda: 1)

    yield
