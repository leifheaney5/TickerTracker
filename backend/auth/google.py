import os
from authlib.integrations.flask_client import OAuth

oauth = OAuth()
_google_enabled = False


def register(app):
    if not os.environ.get("GOOGLE_CLIENT_ID"):
        return
    oauth.init_app(app)
    oauth.register(
        name="google",
        client_id=os.environ["GOOGLE_CLIENT_ID"],
        client_secret=os.environ["GOOGLE_CLIENT_SECRET"],
        server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
        client_kwargs={"scope": "openid email profile"},
    )
    global _google_enabled
    _google_enabled = True


def is_enabled() -> bool:
    return _google_enabled


def upsert_google_user(subject: str, email: str, name: str):
    from auth.oauth_common import upsert_oauth_user
    email = (email or "").strip().lower()
    return upsert_oauth_user(
        provider="google",
        subject=subject,
        email=email,
        name=name or "",
        verified=True,
    )
