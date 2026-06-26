from auth.google import upsert_google_user
import db, models


def test_creates_user_and_identity():
    u = upsert_google_user("sub-1", "g1@b.com", "G One")
    assert u.email == "g1@b.com" and u.email_verified is True
    with db.get_session() as s:
        assert s.query(models.OAuthIdentity).filter_by(provider="google", subject="sub-1").count() == 1


def test_links_existing_email():
    with db.get_session() as s:
        s.add(models.User(email="link@b.com", password_hash="x", email_verified=True)); s.commit()
    u = upsert_google_user("sub-2", "link@b.com", "Linked")
    assert u.email == "link@b.com"
    with db.get_session() as s:
        assert s.query(models.OAuthIdentity).filter_by(subject="sub-2").first().user_id == u.id


def test_returns_same_user_on_repeat():
    a = upsert_google_user("sub-3", "rep@b.com", "R")
    b = upsert_google_user("sub-3", "rep@b.com", "R")
    assert a.id == b.id
