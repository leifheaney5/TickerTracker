import pytest
from flask import Flask

from app import app
import auth


def test_anonymous_current_user_id_is_none():
    with app.test_request_context("/"):
        assert auth.current_user_id() is None


def test_login_manager_registered():
    assert app.config.get("SECRET_KEY")
    assert "_login" in app.extensions or hasattr(app, "login_manager")


def test_init_login_raises_in_prod_without_secret_key(monkeypatch):
    """init_login must refuse to start when APP_BASE_URL is https and SECRET_KEY is unset."""
    monkeypatch.setenv("APP_BASE_URL", "https://example.com")
    monkeypatch.delenv("SECRET_KEY", raising=False)
    fresh = Flask(__name__)
    with pytest.raises(RuntimeError, match="SECRET_KEY must be set in production"):
        auth.init_login(fresh)
