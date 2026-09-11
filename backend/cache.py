import time
import threading
from collections import OrderedDict

# Bounded LRU cache: caps total entries so attacker-controlled keys
# (e.g. arbitrary ?syms= / ?tf= values) cannot grow memory without limit.
MAX_ENTRIES = 2000

_store = OrderedDict()  # key -> (value, timestamp); ordered by recency
_guard = threading.RLock()
_locks = OrderedDict()  # key -> [Lock, active-and-waiting reference count]


def clear():
    with _guard:
        _store.clear()
        _locks.clear()


def _touch(key, value, now):
    _store[key] = (value, now)
    _store.move_to_end(key)
    while len(_store) > MAX_ENTRIES:
        _store.popitem(last=False)  # evict least-recently-used


def cached(key, ttl, producer):
    with _guard:
        now = time.time()
        hit = _store.get(key)
        if hit and now - hit[1] < ttl:
            _store.move_to_end(key)
            return hit[0], False
        entry = _locks.get(key)
        if entry is None:
            entry = [threading.Lock(), 0]
            _locks[key] = entry
        entry[1] += 1
        lock = entry[0]
        _locks.move_to_end(key)
        if len(_locks) > MAX_ENTRIES:
            for old_key, old_entry in list(_locks.items()):
                if old_key != key and old_entry[1] == 0:
                    _locks.pop(old_key, None)
                    if len(_locks) <= MAX_ENTRIES:
                        break

    try:
        with lock:
            with _guard:
                now = time.time()
                current = _store.get(key)
                if current and now - current[1] < ttl:
                    _store.move_to_end(key)
                    return current[0], False
                stale = current or hit
            try:
                value = producer()
                with _guard:
                    _touch(key, value, time.time())
                return value, False
            except Exception:
                if stale:
                    return stale[0], True
                raise
    finally:
        with _guard:
            current_entry = _locks.get(key)
            if current_entry is entry:
                current_entry[1] -= 1
                if current_entry[1] == 0:
                    _locks.pop(key, None)
