"""Unit tests for services.stream — pure helpers: backoff_delay + CircuitBreaker.

No daemon threads, no WS connections, no env vars required.
An injected fake clock drives CircuitBreaker so tests are deterministic.
"""
import pytest
from services.stream import backoff_delay, CircuitBreaker


# ── backoff_delay ─────────────────────────────────────────────────────────────

class TestBackoffDelay:
    def test_attempt_zero_returns_base(self):
        assert backoff_delay(0, base=1.0) == 1.0

    def test_attempt_one_doubles(self):
        assert backoff_delay(1, base=1.0) == 2.0

    def test_attempt_two_quadruples(self):
        assert backoff_delay(2, base=1.0) == 4.0

    def test_capped_at_cap(self):
        assert backoff_delay(100, base=1.0, cap=30.0) == 30.0

    def test_cap_exact_boundary(self):
        # 2^5 = 32 > 30 → capped
        assert backoff_delay(5, base=1.0, cap=30.0) == 30.0

    def test_just_below_cap(self):
        # 2^4 = 16 < 30
        assert backoff_delay(4, base=1.0, cap=30.0) == 16.0

    def test_custom_base(self):
        assert backoff_delay(3, base=2.0, cap=100.0) == 16.0

    def test_custom_cap_smaller_than_base(self):
        assert backoff_delay(0, base=5.0, cap=3.0) == 3.0

    def test_returns_float(self):
        result = backoff_delay(0)
        assert isinstance(result, float)


# ── CircuitBreaker ────────────────────────────────────────────────────────────

class TestCircuitBreakerInitialState:
    def test_starts_closed(self):
        cb = CircuitBreaker(fail_threshold=3, reset_timeout=10.0)
        assert cb.state == CircuitBreaker.CLOSED

    def test_allows_when_closed(self):
        cb = CircuitBreaker(fail_threshold=3, reset_timeout=10.0)
        assert cb.allow(now=0.0) is True


class TestCircuitBreakerTripping:
    def test_single_failure_stays_closed_below_threshold(self):
        cb = CircuitBreaker(fail_threshold=3, reset_timeout=10.0)
        cb.record_failure(now=0.0)
        assert cb.state == CircuitBreaker.CLOSED

    def test_two_failures_stay_closed_below_threshold(self):
        cb = CircuitBreaker(fail_threshold=3, reset_timeout=10.0)
        cb.record_failure(now=0.0)
        cb.record_failure(now=0.0)
        assert cb.state == CircuitBreaker.CLOSED

    def test_threshold_failures_open_the_breaker(self):
        cb = CircuitBreaker(fail_threshold=3, reset_timeout=10.0)
        for _ in range(3):
            cb.record_failure(now=0.0)
        assert cb.state == CircuitBreaker.OPEN

    def test_open_breaker_blocks_allow(self):
        cb = CircuitBreaker(fail_threshold=3, reset_timeout=10.0)
        for _ in range(3):
            cb.record_failure(now=0.0)
        assert cb.allow(now=5.0) is False

    def test_threshold_of_one(self):
        cb = CircuitBreaker(fail_threshold=1, reset_timeout=10.0)
        cb.record_failure(now=0.0)
        assert cb.state == CircuitBreaker.OPEN


class TestCircuitBreakerHalfOpen:
    def test_open_transitions_to_half_open_after_reset_timeout(self):
        cb = CircuitBreaker(fail_threshold=3, reset_timeout=10.0)
        for _ in range(3):
            cb.record_failure(now=0.0)
        # exactly at reset_timeout
        cb.allow(now=10.0)
        assert cb.state == CircuitBreaker.HALF_OPEN

    def test_half_open_allows_one_trial(self):
        cb = CircuitBreaker(fail_threshold=3, reset_timeout=10.0)
        for _ in range(3):
            cb.record_failure(now=0.0)
        result = cb.allow(now=10.0)
        assert result is True

    def test_success_in_half_open_closes_breaker(self):
        cb = CircuitBreaker(fail_threshold=3, reset_timeout=10.0)
        for _ in range(3):
            cb.record_failure(now=0.0)
        cb.allow(now=10.0)  # transitions to half_open
        cb.record_success()
        assert cb.state == CircuitBreaker.CLOSED

    def test_failure_in_half_open_re_opens(self):
        cb = CircuitBreaker(fail_threshold=3, reset_timeout=10.0)
        for _ in range(3):
            cb.record_failure(now=0.0)
        cb.allow(now=10.0)  # transitions to half_open
        cb.record_failure(now=10.0)
        assert cb.state == CircuitBreaker.OPEN

    def test_not_yet_at_reset_timeout_stays_open(self):
        cb = CircuitBreaker(fail_threshold=3, reset_timeout=10.0)
        for _ in range(3):
            cb.record_failure(now=0.0)
        # 9.9s < 10.0s
        result = cb.allow(now=9.9)
        assert result is False
        assert cb.state == CircuitBreaker.OPEN


class TestCircuitBreakerRecordSuccess:
    def test_success_resets_closed_failure_count(self):
        """After success, failure count resets so a new run needs full threshold again."""
        cb = CircuitBreaker(fail_threshold=3, reset_timeout=10.0)
        cb.record_failure(now=0.0)
        cb.record_failure(now=0.0)
        cb.record_success()  # should reset internal count
        assert cb.state == CircuitBreaker.CLOSED
        # Now two more failures should still be below threshold
        cb.record_failure(now=0.0)
        cb.record_failure(now=0.0)
        assert cb.state == CircuitBreaker.CLOSED

    def test_success_on_closed_stays_closed(self):
        cb = CircuitBreaker(fail_threshold=3, reset_timeout=10.0)
        cb.record_success()
        assert cb.state == CircuitBreaker.CLOSED


# ── _inject_price (cache side-effect) ────────────────────────────────────────

def test_inject_price_skips_when_no_cache_entry():
    """_inject_price should not raise or write when there's no baseline entry."""
    import cache
    from services.stream import _inject_price
    cache.clear()
    _inject_price("ZZZZ", 999.0)
    assert cache._store.get("quote:ZZZZ") is None


def test_inject_price_updates_price_in_existing_entry():
    import time
    import cache
    from services.stream import _inject_price

    cache.clear()
    quote = {
        "price": 100.0,
        "change_pct": 0.0,
        "day_open": 99.0,
        "day_high": 101.0,
        "day_low": 98.0,
        "prev_close": 100.0,
        "volume": 1000,
    }
    # Seed the cache with a quote-shaped entry (mirrors services/quotes.py)
    cache._touch("quote:AAPL", (quote, "finnhub"), time.time())

    _inject_price("AAPL", 105.0)

    hit = cache._store.get("quote:AAPL")
    assert hit is not None
    updated_quote, source = hit[0]
    assert updated_quote["price"] == 105.0
    assert source == "finnhub_ws"
    # change_pct should be recalculated from prev_close=100.0
    assert updated_quote["change_pct"] == pytest.approx(5.0, abs=0.01)


def test_inject_price_preserves_prev_close_and_day_fields():
    import time
    import cache
    from services.stream import _inject_price

    cache.clear()
    quote = {
        "price": 200.0,
        "change_pct": 1.0,
        "day_open": 199.0,
        "day_high": 202.0,
        "day_low": 198.0,
        "prev_close": 198.0,
        "volume": 5000,
    }
    cache._touch("quote:MSFT", (quote, "finnhub"), time.time())

    _inject_price("MSFT", 201.0)

    hit = cache._store.get("quote:MSFT")
    updated_quote, _ = hit[0]
    assert updated_quote["day_open"] == 199.0
    assert updated_quote["day_high"] == 202.0
    assert updated_quote["day_low"] == 198.0
    assert updated_quote["prev_close"] == 198.0
    assert updated_quote["volume"] == 5000


# ── maybe_start no-op when FINNHUB_STREAM_ENABLED is absent ──────────────────

def test_maybe_start_is_noop_without_env(monkeypatch):
    """Calling maybe_start() without the env var must not spawn a thread."""
    import threading
    from services.stream import _StreamManager

    monkeypatch.delenv("FINNHUB_STREAM_ENABLED", raising=False)
    before = threading.active_count()
    m = _StreamManager()
    m.maybe_start()
    # No new thread should have been spawned
    assert threading.active_count() == before
    assert m._started is False
