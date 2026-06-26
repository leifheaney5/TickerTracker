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


def test_consume_token_is_single_use():
    uid = _mk_user()
    raw = tk.create_token(uid, "verify", 24)
    assert tk.consume_token(raw, "verify") == uid
    # second call must return None (single-use enforced atomically)
    assert tk.consume_token(raw, "verify") is None


def test_create_second_token_invalidates_first():
    uid = _mk_user()
    raw1 = tk.create_token(uid, "reset", 1)
    raw2 = tk.create_token(uid, "reset", 1)  # should invalidate raw1
    # raw1 is now used/invalidated; consuming it must fail
    assert tk.consume_token(raw1, "reset") is None
    # raw2 is still valid
    assert tk.consume_token(raw2, "reset") == uid
