import auth.tokens as tk
import models, db


def _mk_user():
    with db.get_session() as s:
        u = models.User(email="tok@b.com"); s.add(u); s.commit(); return u.id


def test_create_and_consume():
    uid = _mk_user()
    raw = tk.create_token(uid, "verify", 24)
    assert isinstance(raw, str) and len(raw) > 20
    # raw token is not stored directly
    with db.get_session() as s:
        row = s.query(models.EmailToken).filter_by(user_id=uid).first()
        assert row.token_hash != raw
    assert tk.consume_token(raw, "verify") == uid
    # single use
    assert tk.consume_token(raw, "verify") is None


def test_wrong_kind_and_expiry():
    uid = _mk_user()
    raw = tk.create_token(uid, "reset", 1)
    assert tk.consume_token(raw, "verify") is None  # kind mismatch
    assert tk.consume_token(raw, "reset") == uid


def test_expired(monkeypatch):
    uid = _mk_user()
    raw = tk.create_token(uid, "verify", -1)  # already expired
    assert tk.consume_token(raw, "verify") is None
