import datetime as dt

import db
import models

WINDOW_MIN = 15
MAX_FAILURES = 5


def record_attempt(email: str, ip: str, success: bool) -> None:
    with db.get_session() as s:
        s.add(models.LoginAttempt(email=(email or "").lower(), ip=ip or "", success=success))
        s.commit()


def is_locked(email: str, ip: str = "") -> bool:
    """Return True if the given email has >= MAX_FAILURES failed attempts in the last WINDOW_MIN minutes.

    Keyed on email only so that an attacker cannot bypass the lockout by rotating IP / X-Forwarded-For.
    The ip parameter is accepted but ignored (kept for call-site compatibility).
    """
    cutoff = dt.datetime.utcnow() - dt.timedelta(minutes=WINDOW_MIN)
    with db.get_session() as s:
        n = (s.query(models.LoginAttempt)
             .filter(models.LoginAttempt.email == (email or "").lower(),
                     models.LoginAttempt.success == False,  # noqa: E712
                     models.LoginAttempt.created_at >= cutoff)
             .count())
        return n >= MAX_FAILURES
