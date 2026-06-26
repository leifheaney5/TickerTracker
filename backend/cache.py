import time

_store = {}  # key -> (value, timestamp)


def clear():
    _store.clear()


def cached(key, ttl, producer):
    now = time.time()
    hit = _store.get(key)
    if hit and now - hit[1] < ttl:
        return hit[0], False
    try:
        value = producer()
        _store[key] = (value, now)
        return value, False
    except Exception:
        if hit:
            return hit[0], True
        raise
