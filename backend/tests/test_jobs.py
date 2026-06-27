import jobs


def test_main_dispatches_check_alerts(monkeypatch):
    called = {}
    monkeypatch.setattr(jobs, "check_alerts", lambda: called.setdefault("a", 1) or 3)
    rc = jobs.main(["check-alerts"])
    assert rc == 0 and called.get("a") == 1


def test_main_dispatches_weekly_digest(monkeypatch):
    called = {}
    monkeypatch.setattr(jobs, "send_weekly_digest", lambda: called.setdefault("d", 1) or 2)
    rc = jobs.main(["weekly-digest"])
    assert rc == 0 and called.get("d") == 1


def test_main_unknown_command_returns_nonzero():
    assert jobs.main(["nope"]) != 0
