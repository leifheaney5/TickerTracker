import datetime as dt
import hashlib
import secrets

import db
import models


def _hash(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def create_token(user_id: int, kind: str, ttl_hours: int) -> str:
    raw = secrets.token_urlsafe(32)
    expires = dt.datetime.utcnow() + dt.timedelta(hours=ttl_hours)
    with db.get_session() as s:
        s.add(models.EmailToken(user_id=user_id, kind=kind,
                                token_hash=_hash(raw), expires_at=expires))
        s.commit()
    return raw


def consume_token(raw: str, kind: str):
    h = _hash(raw)
    now = dt.datetime.utcnow()
    with db.get_session() as s:
        row = (s.query(models.EmailToken)
               .filter_by(token_hash=h, kind=kind, used_at=None).first())
        if not row or row.expires_at < now:
            return None
        row.used_at = now
        s.commit()
        return row.user_id
