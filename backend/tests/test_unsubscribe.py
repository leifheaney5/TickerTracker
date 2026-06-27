# backend/tests/test_unsubscribe.py
"""
TDD tests for one-click unsubscribe feature.
All four cases per spec:
  (a) get_or_create_unsub_token is stable (same token on 2nd call)
  (b) unsubscribe(token) sets news_digest False and returns True
  (c) unsubscribe("bad") returns False
  (d) after unsubscribe, that user is no longer emailed by send_weekly_digest
"""
import db
import models
import services.digest as dg


def _make_opted_in_user(email="digest@e.com", symbol="AAPL"):
    """Seed an opted-in, email-verified user; return user_id."""
    with db.get_session() as s:
        u = models.User(email=email, name="T", email_verified=True)
        s.add(u)
        s.flush()
        s.add(models.Settings(user_id=u.id, news_digest=True))
        s.add(models.WatchlistItem(user_id=u.id, symbol=symbol))
        s.commit()
        return u.id


# (a) get_or_create_unsub_token is stable
def test_get_or_create_unsub_token_is_stable():
    uid = _make_opted_in_user()
    token1 = dg.get_or_create_unsub_token(uid)
    token2 = dg.get_or_create_unsub_token(uid)
    assert token1 == token2
    assert len(token1) > 8  # non-trivial token


# (b) unsubscribe(token) sets news_digest False and returns True
def test_unsubscribe_token_sets_news_digest_false():
    uid = _make_opted_in_user(email="unsub_b@e.com")
    token = dg.get_or_create_unsub_token(uid)
    result = dg.unsubscribe(token)
    assert result is True
    with db.get_session() as s:
        st = s.get(models.Settings, uid)
        assert st.news_digest is False


# (c) unsubscribe("bad") returns False
def test_unsubscribe_bad_token_returns_false():
    result = dg.unsubscribe("this-token-does-not-exist")
    assert result is False


# (d) after unsubscribe, user is not emailed by send_weekly_digest
def test_unsubscribed_user_not_emailed():
    uid = _make_opted_in_user(email="unsub_d@e.com", symbol="TSLA")
    token = dg.get_or_create_unsub_token(uid)
    dg.unsubscribe(token)

    sent = []

    def fake_quote(syms):
        return ({s: {"price": 100.0, "change_pct": 0.5} for s in syms}, "t")

    def fake_send(to, subject, html):
        sent.append(to)
        return True

    dg.send_weekly_digest(quote_fn=fake_quote, send_fn=fake_send)
    assert "unsub_d@e.com" not in sent


# (e) idempotent: calling unsubscribe twice still returns True
def test_unsubscribe_is_idempotent():
    uid = _make_opted_in_user(email="idem@e.com")
    token = dg.get_or_create_unsub_token(uid)
    assert dg.unsubscribe(token) is True
    assert dg.unsubscribe(token) is True  # second call still True
