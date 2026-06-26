import providers.email as email


def test_no_key_is_noop(monkeypatch):
    monkeypatch.delenv("RESEND_API_KEY", raising=False)
    assert email.send_verify_email("a@b.com", "http://x/verify?token=1") is False


def test_send_calls_resend(monkeypatch):
    monkeypatch.setenv("RESEND_API_KEY", "test")
    monkeypatch.setenv("MAIL_FROM", "noreply@x.com")
    calls = {}
    def fake_send(payload):
        calls.update(payload); return {"id": "1"}
    monkeypatch.setattr(email, "_resend_send", fake_send)
    ok = email.send_reset_email("a@b.com", "http://x/reset?token=2")
    assert ok is True and calls["to"] == ["a@b.com"] and "reset" in calls["html"]


def test_send_failure_returns_false(monkeypatch):
    monkeypatch.setenv("RESEND_API_KEY", "test")
    monkeypatch.setattr(email, "_resend_send", lambda p: (_ for _ in ()).throw(RuntimeError("down")))
    assert email.send_verify_email("a@b.com", "http://x") is False
