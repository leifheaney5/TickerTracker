"""Tests for the Redis-backed cache path in cache.py.

Uses an injected fake Redis client so no server is needed.
The existing in-process tests in test_cache.py remain unchanged and must
continue to pass — they don't set REDIS_URL so they always use the LRU path.
"""
import json
import time
import pytest
import cache


# ── Fake Redis client ─────────────────────────────────────────────────────────

class FakeRedis:
    """Minimal Redis double supporting get / setex / ping."""

    def __init__(self) -> None:
        self._data: dict[str, tuple[str, float]] = {}  # key -> (value, expires_at)

    def ping(self) -> bool:
        return True

    def get(self, key: str) -> "str | None":
        entry = self._data.get(key)
        if entry is None:
            return None
        value, expires_at = entry
        if time.time() > expires_at:
            del self._data[key]
            return None
        return value

    def setex(self, key: str, ttl_seconds: int, value: str) -> None:
        self._data[key] = (value, time.time() + ttl_seconds)

    def keys(self) -> list[str]:
        return list(self._data.keys())


@pytest.fixture(autouse=True)
def reset_cache():
    cache.clear()  # resets _store and _redis_client
    yield
    cache.clear()


@pytest.fixture
def fake_redis():
    rc = FakeRedis()
    cache.set_redis_client(rc)
    return rc


# ── Backend selection ─────────────────────────────────────────────────────────

def test_no_redis_client_uses_local_path():
    """Without injected client and without REDIS_URL, local path is used."""
    calls = {"n": 0}

    def producer():
        calls["n"] += 1
        return calls["n"]

    v1, s1 = cache.cached("k", 60, producer)
    v2, s2 = cache.cached("k", 60, producer)
    assert v1 == 1 and v2 == 1
    assert calls["n"] == 1


def test_injected_redis_client_is_used(fake_redis):
    calls = {"n": 0}

    def producer():
        calls["n"] += 1
        return calls["n"]

    v1, s1 = cache.cached("k", 60, producer)
    assert v1 == 1
    # Redis should have the key
    assert fake_redis.get("k") is not None


# ── Fresh hit ─────────────────────────────────────────────────────────────────

def test_redis_fresh_hit_avoids_producer(fake_redis):
    calls = {"n": 0}

    def producer():
        calls["n"] += 1
        return calls["n"]

    cache.cached("k", 60, producer)
    v2, stale = cache.cached("k", 60, producer)

    assert v2 == 1
    assert stale is False
    assert calls["n"] == 1


def test_redis_returns_not_stale_on_fresh_hit(fake_redis):
    cache.cached("k", 60, lambda: "hello")
    v, stale = cache.cached("k", 60, lambda: "world")
    assert v == "hello"
    assert stale is False


# ── Expired entry ─────────────────────────────────────────────────────────────

def test_redis_refreshes_after_ttl(fake_redis):
    calls = {"n": 0}

    def producer():
        calls["n"] += 1
        return calls["n"]

    # Seed with ttl=0 so the logical TTL is immediately expired
    cache.cached("k", 0, producer)
    time.sleep(0.01)
    v2, stale = cache.cached("k", 0, producer)
    assert v2 == 2
    assert stale is False


# ── Stale-while-error ─────────────────────────────────────────────────────────

def test_redis_serves_stale_when_producer_fails(fake_redis):
    # Seed a "good" value
    cache.cached("k", 60, lambda: "good_value")

    # Expire it logically (set a new entry with past timestamp via the envelope)
    stale_envelope = json.dumps(["good_value", time.time() - 9999])
    fake_redis.setex("k", 999, stale_envelope)
    # Also update the local LRU to simulate an old hit
    cache._touch("k", "good_value", time.time() - 9999)

    def boom():
        raise RuntimeError("provider down")

    v, stale = cache.cached("k", 1, boom)
    assert v == "good_value"
    assert stale is True


def test_redis_raises_when_no_prior_value_and_producer_fails(fake_redis):
    def boom():
        raise RuntimeError("always fails")

    with pytest.raises(RuntimeError, match="always fails"):
        cache.cached("brand_new_key", 60, boom)


# ── JSON serialisation round-trip ─────────────────────────────────────────────

def test_redis_stores_and_retrieves_dict(fake_redis):
    data = {"price": 150.5, "change_pct": 1.2, "volume": 1000}
    v, _ = cache.cached("q:AAPL", 60, lambda: data)
    # Re-read from Redis (bypass local LRU by clearing it)
    cache._store.clear()
    v2, _ = cache.cached("q:AAPL", 60, lambda: {})
    assert v2 == data


def test_redis_stores_and_retrieves_tuple_as_list(fake_redis):
    """Tuples become lists through JSON but unpack identically."""
    value = ({"price": 100.0}, "finnhub")
    cache.cached("q:TSLA", 60, lambda: value)
    cache._store.clear()
    v2, _ = cache.cached("q:TSLA", 60, lambda: None)
    # JSON round-trip: tuple → list
    assert list(v2) == list(value)
    # Unpack still works (mirrors services/quotes.py usage)
    quote_dict, source = v2
    assert quote_dict == {"price": 100.0}
    assert source == "finnhub"


def test_redis_stores_and_retrieves_nested_structure(fake_redis):
    data = [{"s": "AAPL", "bars": [1, 2, 3]}, {"s": "MSFT", "bars": [4, 5, 6]}]
    cache.cached("history:AAPL:1Y", 300, lambda: data)
    cache._store.clear()
    v2, _ = cache.cached("history:AAPL:1Y", 300, lambda: [])
    assert v2 == data


# ── Redis error degrades gracefully to local LRU ──────────────────────────────

def test_broken_redis_get_falls_back_to_producer(monkeypatch):
    """If Redis.get raises, fall back to local LRU / producer."""
    class BrokenRedis(FakeRedis):
        def get(self, key):
            raise ConnectionError("redis gone")

    cache.set_redis_client(BrokenRedis())

    calls = {"n": 0}
    def producer():
        calls["n"] += 1
        return calls["n"]

    # Should not raise; should produce a value
    v, stale = cache.cached("k", 60, producer)
    assert v == 1
    assert calls["n"] == 1


def test_broken_redis_set_does_not_raise(monkeypatch):
    """If Redis.setex raises, the value is still returned (best-effort write)."""
    class BrokenSetRedis(FakeRedis):
        def setex(self, key, ttl, value):
            raise ConnectionError("write failed")

    cache.set_redis_client(BrokenSetRedis())
    v, stale = cache.cached("k", 60, lambda: "ok")
    assert v == "ok"
    assert stale is False


# ── Existing in-process tests remain valid ────────────────────────────────────
# (They live in test_cache.py and run without REDIS_URL / injected client.)
# This file only covers the Redis branch.
