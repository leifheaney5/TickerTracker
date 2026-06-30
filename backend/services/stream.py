"""Stream ingestion manager: Finnhub WS → in-process cache.

Enabled only when ``FINNHUB_STREAM_ENABLED`` is set in the environment AND
``FINNHUB_API_KEY`` is present.  Importing this module has no side effects:
no threads are started, no connections are opened.

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


# ── Pure tested helpers ───────────────────────────────────────────────────────


def backoff_delay(attempt: int, base: float = 1.0, cap: float = 30.0) -> float:
    """Deterministic exponential backoff: ``base * 2^attempt``, capped at ``cap``.

    No randomness — deterministic for predictable unit tests.  Callers may
    add jitter around the returned value if desired.

    >>> backoff_delay(0)
    1.0
    >>> backoff_delay(3)
    8.0
    >>> backoff_delay(100)
    30.0
    """
    return min(base * (2 ** attempt), cap)


class CircuitBreaker:
    """Three-state circuit breaker: closed → open → half_open → closed.

    States
    ------
    closed:    Normal; failures are counted.
    open:      Tripped; ``allow()`` returns False until ``reset_timeout``
               seconds have elapsed since the trip.
    half_open: One trial connection is allowed; success closes it; failure
               re-opens it.

    The caller must pass a monotonic/wall ``now`` float to ``allow()`` and
    ``record_failure()`` so tests can inject a fake clock without patching
    ``time.time``.
    """

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
        """Return True if a connection attempt should proceed."""
        if self._state == self.CLOSED:
            return True
        if self._state == self.OPEN:
            if (
                self._opened_at is not None
                and now - self._opened_at >= self.reset_timeout
            ):
                self._state = self.HALF_OPEN
                return True
            return False
        # HALF_OPEN: allow the pending trial
        return True

    def record_success(self) -> None:
        """Reset to closed state after a successful trial or reconnect."""
        self._state = self.CLOSED
        self._failures = 0
        self._opened_at = None

    def record_failure(self, now: Optional[float] = None) -> None:
        """Record a failure.  Trips the breaker once ``fail_threshold`` is hit."""
        self._failures += 1
        ts = now if now is not None else time.time()
        if self._state == self.HALF_OPEN or self._failures >= self.fail_threshold:
            self._state = self.OPEN
            self._opened_at = ts


# ── Cache injection ───────────────────────────────────────────────────────────


def _inject_price(sym: str, price: float, ts: int = 0) -> None:  # noqa: ARG001
    """Write a refreshed price into the quote cache for *sym*.

    Reuses the existing cache entry (preserving ``prev_close``, ``day_open``,
    etc.) and only updates ``price`` (and recomputes ``change_pct``).  If no
    entry exists yet, skips — the next REST poll will populate the full shape.

    Thread-safe at the GIL level: CPython dict operations are atomic; this is
    acceptable for the live-streaming use case.
    """
    key = f"quote:{sym}"
    now = time.time()
    hit = cache._store.get(key)
    if not hit:
        # No baseline yet from a REST call — skip rather than inject a partial quote.
        return
    val, _ts = hit
    # val is (quote_dict, source_string) — same shape that services/quotes.py stores.
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


# ── Stream manager ────────────────────────────────────────────────────────────


class _StreamManager:
    """Singleton background ingestion manager.

    ``maybe_start()`` is idempotent — safe to call multiple times.
    """

    def __init__(self) -> None:
        self._started = False
        self._symbols: List[str] = []
        self._lock = threading.Lock()
        self._cb = CircuitBreaker(fail_threshold=5, reset_timeout=60.0)

    def maybe_start(self, symbols: Optional[List[str]] = None) -> None:
        """Start the background WS thread if enabled via env.

        No-op when ``FINNHUB_STREAM_ENABLED`` is unset or when already started.
        Never raises — failure to start is logged, not propagated.
        """
        if not os.environ.get("FINNHUB_STREAM_ENABLED"):
            return
        with self._lock:
            if self._started:
                return
            self._started = True
            self._symbols = list(symbols or [])
        logger.info("stream: starting background Finnhub WS ingestion thread")
        t = threading.Thread(
            target=self._run_loop, daemon=True, name="finnhub-ws-ingestion"
        )
        t.start()

    def update_symbols(self, symbols: List[str]) -> None:
        """Update the subscription set (takes effect on next reconnect)."""
        with self._lock:
            self._symbols = list(symbols)

    def _run_loop(self) -> None:
        """Reconnect loop with exponential backoff + circuit breaker."""
        from providers.finnhub_ws import FinnhubWSClient

        attempt = 0
        while True:
            now = time.time()
            if not self._cb.allow(now):
                delay = backoff_delay(attempt, base=1.0, cap=30.0)
                logger.info(
                    "stream: circuit open; waiting %.1fs before next attempt", delay
                )
                time.sleep(delay)
                attempt += 1
                continue

            try:
                with self._lock:
                    syms = list(self._symbols)
                client = FinnhubWSClient(symbols=syms, on_trade=_inject_price)
                client.connect()  # blocks until disconnect / library absent
                # connect() returned — treat as a non-fatal disconnect
                self._cb.record_failure(time.time())
            except Exception as e:
                self._cb.record_failure(time.time())
                logger.error("stream: unexpected error: %s", e)

            delay = backoff_delay(attempt, base=1.0, cap=30.0)
            logger.info(
                "stream: reconnecting in %.1fs (attempt %d)", delay, attempt
            )
            time.sleep(delay)
            attempt += 1


# Module-level singleton — import is always safe (no side effects at import time).
manager = _StreamManager()
