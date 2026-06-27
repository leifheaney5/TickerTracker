"""Part B-2: search service cache-hit path.

Two consecutive search() calls with the same query must invoke the
underlying provider only once — the second call is served from cache.
"""
import cache
import services.search as search_svc


_SAMPLE = [{"symbol": "AAPL", "description": "Apple Inc", "type": "Common Stock"}]


def test_search_second_call_hits_cache(monkeypatch):
    cache.clear()
    call_count = {"n": 0}

    def counting_provider(q):
        call_count["n"] += 1
        return list(_SAMPLE)

    monkeypatch.setattr(search_svc.finnhub, "search_symbols", counting_provider)

    results1, source1 = search_svc.search("apple")
    results2, source2 = search_svc.search("apple")

    assert call_count["n"] == 1, (
        f"Provider was called {call_count['n']} times; expected exactly 1 (cache miss + hit)"
    )
    assert results1 == results2
    assert results1[0]["symbol"] == "AAPL"
    assert source1 == "finnhub"
    assert source2 == "finnhub"


def test_search_different_queries_call_provider_separately(monkeypatch):
    cache.clear()
    call_count = {"n": 0}

    def counting_provider(q):
        call_count["n"] += 1
        return [{"symbol": q.upper(), "description": "desc", "type": "Stock"}]

    monkeypatch.setattr(search_svc.finnhub, "search_symbols", counting_provider)

    search_svc.search("apple")
    search_svc.search("msft")

    assert call_count["n"] == 2, (
        f"Expected 2 provider calls for 2 distinct queries, got {call_count['n']}"
    )


def test_search_cache_is_case_insensitive(monkeypatch):
    """Cache key normalises to lowercase so 'Apple' and 'apple' share a slot."""
    cache.clear()
    call_count = {"n": 0}

    def counting_provider(q):
        call_count["n"] += 1
        return list(_SAMPLE)

    monkeypatch.setattr(search_svc.finnhub, "search_symbols", counting_provider)

    search_svc.search("Apple")
    search_svc.search("apple")   # same normalised key -> cache hit

    assert call_count["n"] == 1, (
        f"Case variants should share a cache slot; got {call_count['n']} provider calls"
    )
