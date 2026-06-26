import os
os.environ["DATABASE_URL"] = "sqlite://"  # in-memory, before db import
import pytest
import sys


@pytest.fixture(autouse=True)
def fresh_db():
    import db
    import models
    db.Base.metadata.drop_all(db.engine)
    db.init_db()
    # Seed the singleton user (id=1) and their Settings row so that
    # store-layer tests and test_singleton_user_seeded all pass.
    with db.get_session() as s:
        user = models.User(email="test@example.com", name="Test User")
        s.add(user)
        s.flush()
        s.add(models.Settings(user_id=user.id))
        s.commit()
    yield


@pytest.fixture(autouse=True)
def mock_current_user_id(request, fresh_db, monkeypatch):
    """Return user id=1 for all tests except test_login_manager, which
    validates the real Flask-Login behaviour.  We patch every import site
    that holds a direct reference to the function.
    """
    if request.node.fspath.basename == "test_login_manager.py":
        yield
        return

    import auth
    import services.store as store

    monkeypatch.setattr(auth, "current_user_id", lambda: 1)
    monkeypatch.setattr(store, "current_user_id", lambda: 1)

    # Patch the direct import in test_models (finds the module regardless of
    # how pytest registered it in sys.modules).
    for mod_name, mod in list(sys.modules.items()):
        if mod is not None and getattr(mod, "__file__", None) and "test_models" in mod_name:
            if hasattr(mod, "current_user_id"):
                monkeypatch.setattr(mod, "current_user_id", lambda: 1)

    yield
