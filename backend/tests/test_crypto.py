"""Pure unit tests for auth.crypto — round-trip, passthrough, legacy read, tamper detection.

These tests set/unset ENCRYPTION_KEY via monkeypatch and re-import the module
functions each time so the env change takes effect (since _get_key() reads
os.environ at call time, imports are fine to reuse).
"""
import base64
import os


def _fresh_key() -> str:
    """Generate a valid urlsafe-base64 32-byte key string."""
    return base64.urlsafe_b64encode(os.urandom(32)).decode()


def test_roundtrip(monkeypatch):
    monkeypatch.setenv("ENCRYPTION_KEY", _fresh_key())
    from auth.crypto import encrypt, decrypt
    plaintext = "super secret phone number +1 555 000 1234"
    assert decrypt(encrypt(plaintext)) == plaintext


def test_different_ciphertexts_same_plaintext(monkeypatch):
    """Each encryption produces a different ciphertext (random nonce) but both decrypt."""
    monkeypatch.setenv("ENCRYPTION_KEY", _fresh_key())
    from auth.crypto import encrypt, decrypt
    plaintext = "same text"
    c1 = encrypt(plaintext)
    c2 = encrypt(plaintext)
    assert c1 != c2, "random nonce must produce different ciphertexts for same input"
    assert decrypt(c1) == plaintext
    assert decrypt(c2) == plaintext


def test_wrong_key_fails_gracefully(monkeypatch):
    """Wrong key → decrypt returns raw ciphertext, does NOT raise."""
    key1, key2 = _fresh_key(), _fresh_key()
    monkeypatch.setenv("ENCRYPTION_KEY", key1)
    from auth.crypto import encrypt, decrypt
    ct = encrypt("secret data")
    # Switch to a different key
    monkeypatch.setenv("ENCRYPTION_KEY", key2)
    result = decrypt(ct)
    # Must not raise; must not return original plaintext
    assert result != "secret data"
    # Returns the raw token rather than crashing
    assert result == ct


def test_passthrough_no_key(monkeypatch):
    """When ENCRYPTION_KEY is unset, encrypt/decrypt are identity functions."""
    monkeypatch.delenv("ENCRYPTION_KEY", raising=False)
    from auth.crypto import encrypt, decrypt
    plaintext = "my phone"
    assert encrypt(plaintext) == plaintext
    assert decrypt(plaintext) == plaintext


def test_legacy_plaintext_read(monkeypatch):
    """A stored value without the 'gcm1:' prefix is treated as legacy plaintext."""
    monkeypatch.setenv("ENCRYPTION_KEY", _fresh_key())
    from auth.crypto import decrypt
    legacy = "+1 555 000 1234"
    assert decrypt(legacy) == legacy


def test_tamper_detection(monkeypatch):
    """A modified ciphertext is handled gracefully (no exception, not original plaintext)."""
    monkeypatch.setenv("ENCRYPTION_KEY", _fresh_key())
    from auth.crypto import encrypt, decrypt
    ct = encrypt("important data")
    # Corrupt the base64 payload (flip last byte of the blob)
    prefix, blob = ct.split(":", 1)
    raw = bytearray(base64.urlsafe_b64decode(blob + "=="))
    raw[-1] ^= 0xFF
    tampered = prefix + ":" + base64.urlsafe_b64encode(bytes(raw)).decode().rstrip("=")
    result = decrypt(tampered)
    assert result != "important data", "tampered ciphertext must not decrypt to original"
    # Should not raise


def test_encrypted_prefix_marker(monkeypatch):
    """Encrypted values carry the 'gcm1:' version prefix."""
    monkeypatch.setenv("ENCRYPTION_KEY", _fresh_key())
    from auth.crypto import encrypt
    ct = encrypt("phone")
    assert ct.startswith("gcm1:"), "encrypted values must carry the gcm1: version prefix"


def test_encrypted_string_type_decorator(monkeypatch):
    """EncryptedString TypeDecorator round-trips through bind_param / result_value."""
    monkeypatch.setenv("ENCRYPTION_KEY", _fresh_key())
    from auth.crypto import EncryptedString
    col = EncryptedString()
    bound = col.process_bind_param("+1 555 123 4567", None)
    assert bound is not None and bound.startswith("gcm1:")
    result = col.process_result_value(bound, None)
    assert result == "+1 555 123 4567"


def test_encrypted_string_passthrough_none(monkeypatch):
    """EncryptedString returns None when value is None."""
    monkeypatch.setenv("ENCRYPTION_KEY", _fresh_key())
    from auth.crypto import EncryptedString
    col = EncryptedString()
    assert col.process_bind_param(None, None) is None
    assert col.process_result_value(None, None) is None
