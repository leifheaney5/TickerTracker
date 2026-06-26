import time
import cache


def setup_function():
    cache.clear()


def test_caches_within_ttl():
    calls = {"n": 0}

    def producer():
        calls["n"] += 1
        return calls["n"]
    v1, s1 = cache.cached("k", 60, producer)
    v2, s2 = cache.cached("k", 60, producer)
    assert v1 == 1 and v2 == 1
    assert s1 is False and s2 is False
    assert calls["n"] == 1


def test_recomputes_after_ttl():
    calls = {"n": 0}

    def producer():
        calls["n"] += 1
        return calls["n"]
    cache.cached("k", 0, producer)
    time.sleep(0.01)
    v2, _ = cache.cached("k", 0, producer)
    assert v2 == 2


def test_serves_stale_on_producer_error():
    cache.cached("k", 0, lambda: "good")
    time.sleep(0.01)

    def boom():
        raise RuntimeError("provider down")
    v, stale = cache.cached("k", 0, boom)
    assert v == "good"
    assert stale is True
