import os
from authlib.integrations.flask_client import OAuth

import db
import models

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
    email = (email or "").strip().lower()
    with db.get_session() as s:
        ident = s.query(models.OAuthIdentity).filter_by(provider="google", subject=subject).first()
        if ident:
            return s.get(models.User, ident.user_id)
        u = s.query(models.User).filter_by(email=email).first()
        if u is None:
            u = models.User(email=email, name=name or "", email_verified=True)
            s.add(u); s.commit()
        else:
            u.email_verified = True; s.commit()
        s.add(models.OAuthIdentity(user_id=u.id, provider="google", subject=subject))
        s.commit()
        return s.get(models.User, u.id)
