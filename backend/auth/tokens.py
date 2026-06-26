import datetime as dt
import hashlib
import secrets

import db
import models


def _hash(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def invalidate_tokens(user_id: int, kind: str) -> None:
    now = dt.datetime.utcnow()
    with db.get_session() as s:
        (s.query(models.EmailToken)
         .filter(models.EmailToken.user_id == user_id,
                 models.EmailToken.kind == kind,
                 models.EmailToken.used_at.is_(None))
         .update({models.EmailToken.used_at: now}, synchronize_session=False))
        s.commit()


def create_token(user_id: int, kind: str, ttl_hours: int) -> str:
    raw = secrets.token_urlsafe(32)
    expires = dt.datetime.utcnow() + dt.timedelta(hours=ttl_hours)
    invalidate_tokens(user_id, kind)
    with db.get_session() as s:
        s.add(models.EmailToken(user_id=user_id, kind=kind,
                                token_hash=_hash(raw), expires_at=expires))
        s.commit()
    return raw


def consume_token(raw: str, kind: str):
    h = _hash(raw)
    now = dt.datetime.utcnow()
    with db.get_session() as s:
        # Atomically claim the token: UPDATE ... WHERE still unused & not expired.
        updated = (s.query(models.EmailToken)
                   .filter(models.EmailToken.token_hash == h,
                           models.EmailToken.kind == kind,
                           models.EmailToken.used_at.is_(None),
                           models.EmailToken.expires_at >= now)
                   .update({models.EmailToken.used_at: now}, synchronize_session=False))
        if not updated:
            s.rollback()
            return None
        row = s.query(models.EmailToken).filter_by(token_hash=h, kind=kind).first()
        s.commit()
        return row.user_id if row else None
