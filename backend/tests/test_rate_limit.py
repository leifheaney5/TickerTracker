import auth.rate_limit as rl


def test_locks_after_five_failures():
    for _ in range(4):
        rl.record_attempt("x@b.com", "1.1.1.1", False)
    assert rl.is_locked("x@b.com", "1.1.1.1") is False
    rl.record_attempt("x@b.com", "1.1.1.1", False)
    assert rl.is_locked("x@b.com", "1.1.1.1") is True


def test_other_identity_not_locked():
    for _ in range(5):
        rl.record_attempt("y@b.com", "1.1.1.1", False)
    assert rl.is_locked("z@b.com", "9.9.9.9") is False
