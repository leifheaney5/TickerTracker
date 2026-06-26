from auth.passwords import hash_password, verify_password, valid_password


def test_hash_verify_roundtrip():
    h = hash_password("hunter2hunter")
    assert h != "hunter2hunter"
    assert verify_password("hunter2hunter", h) is True
    assert verify_password("wrong", h) is False


def test_policy():
    assert valid_password("12345678") is True
    assert valid_password("short") is False
