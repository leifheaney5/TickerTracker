import datetime as dt

import db
import models

WINDOW_MIN = 15
MAX_FAILURES = 5


def record_attempt(email: str, ip: str, success: bool) -> None:
    with db.get_session() as s:
        s.add(models.LoginAttempt(email=(email or "").lower(), ip=ip or "", success=success))
        s.commit()


def is_locked(email: str, ip: str) -> bool:
    cutoff = dt.datetime.utcnow() - dt.timedelta(minutes=WINDOW_MIN)
    with db.get_session() as s:
        n = (s.query(models.LoginAttempt)
             .filter(models.LoginAttempt.email == (email or "").lower(),
                     models.LoginAttempt.ip == (ip or ""),
                     models.LoginAttempt.success == False,  # noqa: E712
                     models.LoginAttempt.created_at >= cutoff)
             .count())
        return n >= MAX_FAILURES
