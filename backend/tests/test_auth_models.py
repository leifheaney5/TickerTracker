import db
import models


def test_user_has_auth_columns():
    with db.get_session() as s:
        u = models.User(email="a@b.com", password_hash="x", email_verified=True)
        s.add(u); s.commit()
        got = s.query(models.User).filter_by(email="a@b.com").first()
        assert got.email_verified is True and got.password_hash == "x"


def test_oauth_identity_roundtrip():
    with db.get_session() as s:
        u = models.User(email="g@b.com"); s.add(u); s.commit()
        s.add(models.OAuthIdentity(user_id=u.id, provider="google", subject="sub123"))
        s.commit()
        oi = s.query(models.OAuthIdentity).filter_by(provider="google", subject="sub123").first()
        assert oi.user_id == u.id


def test_email_token_and_login_attempt():
    with db.get_session() as s:
        u = models.User(email="t@b.com"); s.add(u); s.commit()
        s.add(models.EmailToken(user_id=u.id, kind="verify", token_hash="h", expires_at=__import__("datetime").datetime(2030,1,1)))
        s.add(models.LoginAttempt(email="t@b.com", ip="1.2.3.4", success=False))
        s.commit()
        assert s.query(models.EmailToken).count() == 1
        assert s.query(models.LoginAttempt).count() == 1
