"""In-process LRU cache with an optional Redis backend.

When ``REDIS_URL`` is set and the ``redis`` package is installed, ``cached()``
uses Redis as the shared backing store (useful for multi-instance deployments).
Otherwise it falls back to the in-process OrderedDict LRU silently.

API (unchanged from original):
    cached(key, ttl, producer) -> (value, stale: bool)

Stale-while-error: if the producer raises and a prior value exists (even
expired), return it with stale=True so callers can surface a graceful degraded
state rather than propagating an error.

Redis storage: values are JSON-serialised and stored with a generous raw TTL
(10× the app TTL) so that stale-while-error works across Redis (expired-but-
still-stored semantics are emulated by embedding the cache timestamp in the
payload).  All values in this cache are dicts/lists/primitives — JSON covers
the full type set without the class-instantiation attack surface of pickle.
"""

import json
import logging
import os
import time
from collections import OrderedDict
from typing import Any, Callable, Tuple

logger = logging.getLogger(__name__)

# ── In-process LRU ───────────────────────────────────────────────────────────
# Bounded to cap attacker-controlled key growth.
MAX_ENTRIES = 2000

_store: "OrderedDict[str, Tuple[Any, float]]" = OrderedDict()


def clear() -> None:
    _store.clear()
    # Also clear redis client cache so tests can reset state cleanly.
    global _redis_client, _redis_warned
    _redis_client = None
    _redis_warned = False


def _touch(key: str, value: Any, now: float) -> None:
    _store[key] = (value, now)
    _store.move_to_end(key)
    while len(_store) > MAX_ENTRIES:
        _store.popitem(last=False)  # evict LRU


# ── Redis backend (opt-in) ────────────────────────────────────────────────────

try:
    import redis as _redis_lib  # type: ignore[import]
except ImportError:
    _redis_lib = None  # type: ignore[assignment]

# Injected or auto-resolved Redis client.  Can be set directly in tests
# via ``set_redis_client(fake_client)``.
_redis_client: Any = None
_redis_warned: bool = False

# Raw Redis TTL multiplier: store values for longer than the app TTL so
# stale-while-error can return them even after they've "logically" expired.
_REDIS_TTL_MULTIPLIER = 10


def set_redis_client(client: Any) -> None:
    """Test seam: inject a pre-configured (or fake) Redis client.

    Calling ``clear()`` resets the injected client back to None so tests are
    isolated from each other.
    """
    global _redis_client
    _redis_client = client


def _get_redis() -> Any:
    """Return a live Redis client if configured, else None.

    Auto-connects on first call; logs once on failure and returns None for
    the remainder of the process lifetime.
    """
    global _redis_client, _redis_warned

    # Already resolved (or injected by a test)
    if _redis_client is not None:
        return _redis_client

    if _redis_lib is None:
        return None

    url = os.environ.get("REDIS_URL")
    if not url:
        return None

    try:
        client = _redis_lib.from_url(  # type: ignore[union-attr]
            url,
            socket_connect_timeout=2,
            socket_timeout=2,
            decode_responses=True,  # JSON strings; no binary encoding needed
        )
        client.ping()
        _redis_client = client
        logger.info("cache: Redis backend active (%s)", url.rsplit("@", 1)[-1])
        return _redis_client
    except Exception as exc:
        if not _redis_warned:
            logger.warning(
                "cache: Redis unreachable (%s); falling back to in-process LRU", exc
            )
            _redis_warned = True
        return None


def _redis_get(
    rc: Any, key: str, ttl: float
) -> "Tuple[Any, float] | None":
    """Return ``(value, cached_at)`` from Redis, or None when the key is absent.

    Values are JSON-encoded; the envelope is ``[value, cached_at]``.  JSON
    arrays decode to Python lists, which unpack identically to tuples, so
    callers that do ``val, source = cached_value`` continue to work unchanged.
    """
    try:
        raw = rc.get(key)
        if raw is None:
            return None
        # JSON-only: all cache values are dicts/lists/primitives; no pickle needed.
        envelope = json.loads(raw)
        return envelope[0], float(envelope[1])
    except Exception as exc:
        logger.debug("cache: Redis GET error for %s: %s", key, exc)
        return None


def _redis_set(rc: Any, key: str, value: Any, now: float, ttl: float) -> None:
    """Store ``[value, now]`` in Redis with a generous raw TTL (JSON-encoded)."""
    try:
        raw = json.dumps([value, now], separators=(",", ":"))
        raw_ttl = max(1, int(ttl * _REDIS_TTL_MULTIPLIER))
        rc.setex(key, raw_ttl, raw)
    except Exception as exc:
        logger.debug("cache: Redis SET error for %s: %s", key, exc)


# ── Public API ────────────────────────────────────────────────────────────────


def cached(key: str, ttl: float, producer: Callable[[], Any]) -> Tuple[Any, bool]:
    """Return ``(value, stale)`` for *key*, calling *producer* on a miss.

    *stale* is True only when the producer raised and a prior value was returned.
    Uses Redis when available; falls back to the in-process LRU transparently.
    """
    rc = _get_redis()

    if rc is not None:
        return _cached_redis(rc, key, ttl, producer)
    return _cached_local(key, ttl, producer)


def _cached_local(
    key: str, ttl: float, producer: Callable[[], Any]
) -> Tuple[Any, bool]:
    """In-process LRU path (original implementation)."""
    now = time.time()
    hit = _store.get(key)
    if hit and now - hit[1] < ttl:
        _store.move_to_end(key)
        return hit[0], False
    try:
        value = producer()
        _touch(key, value, now)
        return value, False
    except Exception:
        if hit:
            return hit[0], True
        raise


def _cached_redis(
    rc: Any, key: str, ttl: float, producer: Callable[[], Any]
) -> Tuple[Any, bool]:
    """Redis-backed path.

    Stale-while-error: when the producer fails, returns the last known value
    (which may have logically expired but is retained in Redis via the 10× TTL).
    """
    now = time.time()

    entry = _redis_get(rc, key, ttl)
    if entry is not None:
        value, cached_at = entry
        if now - cached_at < ttl:
            # Fresh hit — also warm the local LRU as a read-through cache
            _touch(key, value, now)
            return value, False
        # Logically expired; try to refresh
        try:
            new_value = producer()
            _redis_set(rc, key, new_value, now, ttl)
            _touch(key, new_value, now)
            return new_value, False
        except Exception:
            # Return stale
            return value, True
    else:
        # Not in Redis — fall through to local LRU for stale fallback
        hit = _store.get(key)
        try:
            value = producer()
            _redis_set(rc, key, value, now, ttl)
            _touch(key, value, now)
            return value, False
        except Exception:
            if hit:
                return hit[0], True
            raise
