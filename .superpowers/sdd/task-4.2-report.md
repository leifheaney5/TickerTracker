# Task 4.2 — Backend Coverage & SQLAlchemy Modernization

## Status: COMPLETE — 136 tests passing (was 118)

---

## Part A — SQLAlchemy 2.0 Modernization

Grepped `backend/` (excluding `.venv`) for the legacy `s.query(Model).get(pk)` pattern.

**Found 3 occurrences across 2 files:**

### `backend/services/alerts.py` (lines 60–61)
```python
# before
user = s.query(models.User).get(w.user_id)
settings = s.query(models.Settings).get(w.user_id)

# after
user = s.get(models.User, w.user_id)
settings = s.get(models.Settings, w.user_id)
```

### `backend/services/digest.py` (line 31)
```python
# before
user = s.query(models.User).get(st.user_id)

# after
user = s.get(models.User, st.user_id)
```

All other `.query()` calls are `.filter()` chains or `.filter_by()` lookups — left untouched per constraint.

---

## Part B — New Test Coverage

### B-1: `backend/tests/test_quotes_mock_fallback.py` (4 tests)

Covers `get_quotes` mock-fallback path when both finnhub and yahoo providers raise:
- Single-symbol: source == "mock"
- Multi-symbol: all symbols get mock quotes, overall source == "mock"
- Mock quote shape: required keys present
- Mixed-source: one real quote + one mock -> overall source is the real provider

### B-2: `backend/tests/test_search_cache.py` (3 tests)

Covers `search()` cache-hit path:
- Two calls with same query invoke provider exactly once
- Two different queries call provider twice
- Case normalization: "Apple" and "apple" share a cache slot (provider called once)

### B-3: `backend/tests/test_finnhub_ratings.py` (11 tests)

Covers `fetch_ratings` consensus label thresholds via monkeypatched `requests.get` and `FINNHUB_API_KEY`:
- Strong Buy: score=1.0 (all strongBuy) and score=1.1 (near threshold)
- Buy: score=2.0 (all buy) and mixed
- Hold: score=3.0 (all hold)
- Sell: score=4.0 (all sell) and mixed (hold+sell)
- Strong Sell: score=5.0 (all strongSell) and mixed (sell+strongSell)
- Response shape: all required keys present with correct values
- Empty recs list: raises RuntimeError("no recommendations")

**Patching note:** `fetch_ratings` calls `_key()` before `requests.get`, so tests must
`monkeypatch.setenv("FINNHUB_API_KEY", "test-key")` in addition to patching `requests.get`.

---

## Bugs Found

None. All new tests passed against existing product code without requiring any changes to
business logic.

---

## Test Counts

| Stage | Passed |
|---|---|
| Baseline (before changes) | 118 |
| After Part A | 118 |
| After Part B | 136 |
| New tests added | +18 |

---

## Warnings

Zero deprecation warnings in the test run (SQLAlchemy `.get()` modernization eliminates
the legacy Query API warnings for the affected call sites).
