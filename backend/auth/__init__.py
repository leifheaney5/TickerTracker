import os
from flask_login import LoginManager, current_user

login_manager = LoginManager()


def init_login(app):
    secret = os.environ.get("SECRET_KEY")
    is_prod = os.environ.get("APP_BASE_URL", "").startswith("https")
    if secret:
        app.config["SECRET_KEY"] = secret
    elif is_prod:
        raise RuntimeError(
            "SECRET_KEY must be set in production (APP_BASE_URL is https). "
            "Refusing to start with an insecure default."
        )
    else:
        app.config["SECRET_KEY"] = "dev-insecure-change-me"
    login_manager.init_app(app)

    app.config.update(
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE="Lax",
        SESSION_COOKIE_SECURE=bool(os.environ.get("APP_BASE_URL", "").startswith("https")),
        REMEMBER_COOKIE_HTTPONLY=True,
    )

    @login_manager.user_loader
    def load_user(user_id):
        import db, models
        with db.get_session() as s:
            return s.get(models.User, int(user_id))

    # API: return 401 JSON instead of redirecting to a login page.
    @login_manager.unauthorized_handler
    def _unauth():
        from flask import jsonify
        return jsonify({"error": "authentication required"}), 401


def current_user_id():
    return int(current_user.id) if getattr(current_user, "is_authenticated", False) else None
