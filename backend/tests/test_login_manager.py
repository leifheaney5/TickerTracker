from app import app
import auth


def test_anonymous_current_user_id_is_none():
    with app.test_request_context("/"):
        assert auth.current_user_id() is None


def test_login_manager_registered():
    assert app.config.get("SECRET_KEY")
    assert "_login" in app.extensions or hasattr(app, "login_manager")
