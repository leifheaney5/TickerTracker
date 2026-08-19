"""Regression tests for FINNHUB_STREAM_ENABLED parsing."""

import threading

from services.stream import _StreamManager


def test_false_string_does_not_start_stream(monkeypatch):
    monkeypatch.setenv("FINNHUB_STREAM_ENABLED", "false")
    before = threading.active_count()
    manager = _StreamManager()
    manager.maybe_start()
    assert manager._started is False
    assert threading.active_count() == before


def test_zero_string_does_not_start_stream(monkeypatch):
    monkeypatch.setenv("FINNHUB_STREAM_ENABLED", "0")
    before = threading.active_count()
    manager = _StreamManager()
    manager.maybe_start()
    assert manager._started is False
    assert threading.active_count() == before
