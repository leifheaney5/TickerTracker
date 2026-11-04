"""Shared helper for OAuth user find-or-create across providers (Google, Apple, …).

Logic:
1. Existing OAuthIdentity for (provider, subject) → return linked User.
2. Existing User with matching email → add new OAuthIdentity to that User.
3. No existing User → create User + OAuthIdentity.

The email column must be non-None to create a new User; if Apple withholds the
email on subsequent auths the caller should pass the previously stored email or
handle the None case explicitly.
"""
from __future__ import annotations

import db
import models


def upsert_oauth_user(
    provider: str,
    subject: str,
    email: str | None,
    name: str | None,
    verified: bool = True,
):
    """Find or create a User linked via OAuthIdentity.

    Returns the User object (already committed, safe to pass to login_user).
    Returns None only when email is absent AND no existing identity is found
    (which should not occur in practice for Apple or Google flows).
    """
    email = (email or "").strip().lower() or None
    name = (name or "").strip()

    with db.get_session() as s:
        # 1. Existing OAuth link.
        ident = (
            s.query(models.OAuthIdentity)
            .filter_by(provider=provider, subject=subject)
            .first()
        )
        if ident:
            return s.get(models.User, ident.user_id)

        # 2. Existing user with same email.
        u = s.query(models.User).filter_by(email=email).first() if email else None

        if u is None:
            if not email:
                return None  # Cannot create without an email
            u = models.User(email=email, name=name, email_verified=verified)
            s.add(u)
            s.commit()
        elif verified:
            u.email_verified = True
            s.commit()

        s.add(
            models.OAuthIdentity(user_id=u.id, provider=provider, subject=subject)
        )
        s.commit()
        return s.get(models.User, u.id)
