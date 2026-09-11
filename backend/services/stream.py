"""Stream ingestion manager: Finnhub WS → in-process cache.

Enabled only when ``FINNHUB_STREAM_ENABLED`` is explicitly truthy and a
``FINNHUB_API_KEY`` is present. Importing this module has no side effects: no
threads are started, no connections are opened.

Usage:
    from services import stream as _stream
    _stream.manager.maybe_start()   # call once during app init; no-op when disabled
"""
import logging
import os
import threading
import time
from typing import List, Optional

import cache

logger = logging.getLogger(__name__)


def backoff_delay(attempt: int, base: float = 1.0, cap: float = 30.0) -> float:
    """Deterministic exponential backoff: ``base * 2^attempt``, capped at ``cap``."""
    return min(base * (2 ** attempt), cap)


class CircuitBreaker:
    """Three-state circuit breaker: closed → open → half_open → closed."""

    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"

    def __init__(self, fail_threshold: int, reset_timeout: float) -> None:
        self.fail_threshold = fail_threshold
        self.reset_timeout = reset_timeout
        self._state: str = self.CLOSED
        self._failures: int = 0
        self._opened_at: Optional[float] = None

    @property
    def state(self) -> str:
        return self._state

    def allow(self, now: float) -> bool:
        if self._state == self.CLOSED:
            return True
        if self._state == self.OPEN:
            if self._opened_at is not None and now - self._opened_at >= self.reset_timeout:
                self._state = self.HALF_OPEN
                return True
            return False
        return True

    def record_success(self) -> None:
        self._state = self.CLOSED
        self._failures = 0
        self._opened_at = None

    def record_failure(self, now: Optional[float] = None) -> None:
        self._failures += 1
        ts = now if now is not None else time.time()
        if self._state == self.HALF_OPEN or self._failures >= self.fail_threshold:
            self._state = self.OPEN
            self._opened_at = ts


def _inject_price(sym: str, price: float, ts: int = 0) -> None:  # noqa: ARG001
    key = f"quote:{sym}"
    now = time.time()
    hit = cache._store.get(key)
    if not hit:
        return
    val, _ts = hit
    try:
        quote_dict, _source = val
    except (TypeError, ValueError):
        return
    updated = dict(quote_dict)
    updated["price"] = round(float(price), 2)
    prev_close = updated.get("prev_close") or 0.0
    if prev_close:
        pct = (float(price) - prev_close) / prev_close * 100
        updated["change_pct"] = round(pct, 2)
    cache._touch(key, (updated, "finnhub_ws"), now)


class _StreamManager:
    """Singleton background ingestion manager."""

    def __init__(self) -> None:
        self._started = False
        self._symbols: List[str] = []
        self._lock = threading.Lock()
        self._cb = CircuitBreaker(fail_threshold=5, reset_timeout=60.0)

    def maybe_start(self, symbols: Optional[List[str]] = None) -> None:
        """Start the background WS thread only when explicitly configured.

        Accepted truthy values are ``1``, ``true``, ``yes`` and ``on``.
        A missing Finnhub API key is also treated as disabled; this prevents a
        useless reconnect loop from keeping a low-traffic Railway service awake.
        """
        enabled = os.environ.get("FINNHUB_STREAM_ENABLED", "").strip().lower()
        api_key = os.environ.get("FINNHUB_API_KEY", "").strip()
        if enabled not in {"1", "true", "yes", "on"} or not api_key:
            return
        with self._lock:
            if self._started:
                return
            self._started = True
            self._symbols = list(symbols or [])
        logger.info("stream: starting background Finnhub WS ingestion thread")
        t = threading.Thread(target=self._run_loop, daemon=True, name="finnhub-ws-ingestion")
        t.start()

    def update_symbols(self, symbols: List[str]) -> None:
        with self._lock:
            self._symbols = list(symbols)

    def _run_loop(self) -> None:
        from providers.finnhub_ws import FinnhubWSClient

        attempt = 0
        while True:
            now = time.time()
            if not self._cb.allow(now):
                delay = backoff_delay(attempt, base=1.0, cap=30.0)
                logger.info("stream: circuit open; waiting %.1fs before next attempt", delay)
                time.sleep(delay)
                attempt += 1
                continue

            try:
                with self._lock:
                    syms = list(self._symbols)
                client = FinnhubWSClient(symbols=syms, on_trade=_inject_price)
                client.connect()
                self._cb.record_failure(time.time())
            except Exception as e:
                self._cb.record_failure(time.time())
                logger.error("stream: unexpected error: %s", e)

            delay = backoff_delay(attempt, base=1.0, cap=30.0)
            logger.info("stream: reconnecting in %.1fs (attempt %d)", delay, attempt)
            time.sleep(delay)
            attempt += 1


manager = _StreamManager()
