"""AES-256-GCM field-level encryption helpers.

Generate a key and set ENCRYPTION_KEY in your environment (Railway secret /
.env). The value must be a URL-safe base64-encoded 32-byte random secret:

    python -c "import os, base64; print(base64.urlsafe_b64encode(os.urandom(32)).decode())"

When ENCRYPTION_KEY is absent this module operates in passthrough mode:
  - encrypt() returns the plaintext unchanged
  - decrypt() returns its input unchanged

This keeps dev environments and existing tests working without any key set.

Encrypted values carry a 'gcm1:' version prefix so they are distinguishable
from legacy plaintext stored in the same column. On read, any value without
the prefix is treated as legacy plaintext and returned as-is, enabling
zero-downtime key introduction on existing deployments.
"""
from __future__ import annotations

import base64
import logging
import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from sqlalchemy import String
from sqlalchemy.types import TypeDecorator

log = logging.getLogger(__name__)

_PREFIX = "gcm1:"
_NONCE_LEN = 12


def _get_key() -> bytes | None:
    raw = os.environ.get("ENCRYPTION_KEY", "").strip()
    if not raw:
        return None
    try:
        # Add padding: urlsafe_b64decode tolerates extra '=' chars.
        key = base64.urlsafe_b64decode(raw + "==")
        if len(key) != 32:
            raise ValueError(
                f"ENCRYPTION_KEY decoded to {len(key)} bytes; expected exactly 32"
            )
        return key
    except Exception as exc:
        log.error("ENCRYPTION_KEY is invalid and will be ignored: %s", exc)
        return None


def encrypt(plaintext: str) -> str:
    """Encrypt *plaintext* to a 'gcm1:' prefixed urlsafe-base64 ciphertext.

    Returns *plaintext* unchanged when ENCRYPTION_KEY is not configured.
    Each call uses a fresh 12-byte random nonce so the same plaintext never
    produces the same ciphertext (random nonce → IND-CPA security).
    """
    key = _get_key()
    if key is None:
        return plaintext
    nonce = os.urandom(_NONCE_LEN)
    ct = AESGCM(key).encrypt(nonce, plaintext.encode("utf-8"), None)
    blob = base64.urlsafe_b64encode(nonce + ct).decode()
    return f"{_PREFIX}{blob}"


def decrypt(token: str) -> str:
    """Decrypt a 'gcm1:' prefixed value back to plaintext.

    Passthrough rules (in order):
    1. ENCRYPTION_KEY unset    → return *token* as-is (passthrough mode)
    2. No 'gcm1:' prefix       → legacy plaintext row; return as-is
    3. Decryption failure      → log warning; return raw *token* (never crash)
    """
    key = _get_key()
    if key is None:
        return token
    if not token.startswith(_PREFIX):
        # Legacy plaintext stored before encryption was enabled.
        return token
    blob = token[len(_PREFIX):]
    try:
        data = base64.urlsafe_b64decode(blob + "==")
        nonce, ct = data[:_NONCE_LEN], data[_NONCE_LEN:]
        return AESGCM(key).decrypt(nonce, ct, None).decode("utf-8")
    except Exception as exc:
        log.warning(
            "EncryptedString decrypt failed (returning raw value): %s", exc
        )
        return token


class EncryptedString(TypeDecorator):
    """SQLAlchemy column type: transparently encrypts on write, decrypts on read.

    Backed by an underlying String column — no schema change required to adopt.
    Falls back to plaintext passthrough when ENCRYPTION_KEY is unset.
    Reads of existing plaintext rows (no 'gcm1:' prefix) are returned verbatim
    so existing data continues to work after ENCRYPTION_KEY is first introduced.
    """

    impl = String
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        return encrypt(str(value))

    def process_result_value(self, value, dialect):
        if value is None:
            return value
        return decrypt(str(value))
