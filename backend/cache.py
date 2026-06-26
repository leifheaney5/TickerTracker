import time
from collections import OrderedDict

# Bounded LRU cache: caps total entries so attacker-controlled keys
# (e.g. arbitrary ?syms= / ?tf= values) cannot grow memory without limit.
MAX_ENTRIES = 2000

_store = OrderedDict()  # key -> (value, timestamp); ordered by recency


def clear():
    _store.clear()


def _touch(key, value, now):
    _store[key] = (value, now)
    _store.move_to_end(key)
    while len(_store) > MAX_ENTRIES:
        _store.popitem(last=False)  # evict least-recently-used


def cached(key, ttl, producer):
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
