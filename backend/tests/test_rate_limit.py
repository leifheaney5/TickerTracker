import auth.rate_limit as rl


def test_locks_after_five_failures():
    for _ in range(4):
        rl.record_attempt("x@b.com", "1.1.1.1", False)
    assert rl.is_locked("x@b.com") is False
    rl.record_attempt("x@b.com", "1.1.1.1", False)
    assert rl.is_locked("x@b.com") is True


def test_other_email_not_locked():
    """Locking email A must not affect email B (different identity)."""
    for _ in range(5):
        rl.record_attempt("y@b.com", "1.1.1.1", False)
    assert rl.is_locked("z@b.com") is False


def test_rotating_ip_does_not_bypass_lockout():
    """Five failures for the same email across five different IPs must still lock the email.

    This proves the XFF-rotation bypass is closed: an attacker cannot defeat the
    per-email lockout by cycling X-Forwarded-For values.
    """
    ips = ["1.1.1.1", "2.2.2.2", "3.3.3.3", "4.4.4.4", "5.5.5.5"]
    for ip in ips:
        rl.record_attempt("victim@b.com", ip, False)
    assert rl.is_locked("victim@b.com") is True
