from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

_ph = PasswordHasher()


def hash_password(pw: str) -> str:
    return _ph.hash(pw)


def verify_password(pw: str, hashed: str) -> bool:
    if not hashed:
        return False
    try:
        return _ph.verify(hashed, pw)
    except VerifyMismatchError:
        return False
    except Exception:
        return False


def valid_password(pw: str) -> bool:
    return isinstance(pw, str) and len(pw) >= 8
