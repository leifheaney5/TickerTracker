"""Regression tests for Finnhub stream enablement parsing."""

import threading

from services.stream import _StreamManager


def _assert_does_not_start(manager: _StreamManager, before: int):
    assert manager._started is False
    assert threading.active_count() == before


def test_false_string_does_not_start_stream(monkeypatch):
    monkeypatch.setenv("FINNHUB_STREAM_ENABLED", "false")
    monkeypatch.setenv("FINNHUB_API_KEY", "test-key")
    before = threading.active_count()
    manager = _StreamManager()
    manager.maybe_start()
    _assert_does_not_start(manager, before)


def test_zero_string_does_not_start_stream(monkeypatch):
    monkeypatch.setenv("FINNHUB_STREAM_ENABLED", "0")
    monkeypatch.setenv("FINNHUB_API_KEY", "test-key")
    before = threading.active_count()
    manager = _StreamManager()
    manager.maybe_start()
    _assert_does_not_start(manager, before)


def test_truthy_without_api_key_does_not_start_stream(monkeypatch):
    monkeypatch.setenv("FINNHUB_STREAM_ENABLED", "true")
    monkeypatch.delenv("FINNHUB_API_KEY", raising=False)
    before = threading.active_count()
    manager = _StreamManager()
    manager.maybe_start()
    _assert_does_not_start(manager, before)
