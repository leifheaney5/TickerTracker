"""
TDD: Earnings calendar — backend tests.

Written BEFORE the implementation so they fail first.
Tests:
  1. fetch_earnings maps Finnhub response to the expected shape.
  2. get_earnings filters to requested symbols.
  3. A second call to get_earnings is served from cache (producer not called twice).
  4. get_earnings with no syms returns all rows.
  5. get_earnings falls back to ([], "mock") when the provider raises.
"""
import types as _types
import cache
import providers.finnhub as fh
import services.earnings as earnings_svc


_FAKE_CALENDAR = {
    "earningsCalendar": [
        {"symbol": "AAPL", "date": "2026-07-10", "hour": "amc", "epsEstimate": 1.55},
        {"symbol": "MSFT", "date": "2026-07-15", "hour": "bmo", "epsEstimate": 2.88},
        {"symbol": "", "date": "2026-07-20", "hour": "dmh", "epsEstimate": None},  # no symbol → skip
    ]
}


def _fake_response(data: dict):
    """Return a minimal requests.Response-like object."""
    resp = _types.SimpleNamespace()
    resp.raise_for_status = lambda: None
    resp.json = lambda: data
    return resp


# ─── fetch_earnings ──────────────────────────────────────────────────────────

def test_fetch_earnings_maps_fields(monkeypatch):
    """fetch_earnings returns mapped rows and skips symbol-less entries."""
    monkeypatch.setenv("FINNHUB_API_KEY", "test-key")
    monkeypatch.setattr(fh.requests, "get",
                        lambda url, params=None, timeout=None: _fake_response(_FAKE_CALENDAR))

    rows = fh.fetch_earnings("2026-07-01", "2026-07-31")

    assert len(rows) == 2, "Row without symbol must be skipped"
    aapl = next(r for r in rows if r["symbol"] == "AAPL")
    assert aapl["date"] == "2026-07-10"
    assert aapl["hour"] == "amc"
    assert aapl["epsEstimate"] == 1.55


def test_fetch_earnings_missing_eps(monkeypatch):
    """epsEstimate can be None."""
    monkeypatch.setenv("FINNHUB_API_KEY", "test-key")
    data = {"earningsCalendar": [
        {"symbol": "GOOG", "date": "2026-07-25", "hour": "bmo", "epsEstimate": None},
    ]}
    monkeypatch.setattr(fh.requests, "get",
                        lambda url, params=None, timeout=None: _fake_response(data))

    rows = fh.fetch_earnings("2026-07-01", "2026-07-31")
    assert rows[0]["epsEstimate"] is None


# ─── get_earnings (service) ───────────────────────────────────────────────────

def test_get_earnings_filters_to_syms(monkeypatch):
    """get_earnings(['AAPL']) returns only AAPL rows."""
    cache.clear()
    call_count = [0]

    def fake_fetch(frm, to):
        call_count[0] += 1
        return [
            {"symbol": "AAPL", "date": "2026-07-10", "hour": "amc", "epsEstimate": 1.55},
            {"symbol": "MSFT", "date": "2026-07-15", "hour": "bmo", "epsEstimate": 2.88},
        ]

    monkeypatch.setattr(earnings_svc, "fetch_earnings", fake_fetch)

    rows, source = earnings_svc.get_earnings(["AAPL"])

    assert source == "finnhub"
    assert len(rows) == 1
    assert rows[0]["symbol"] == "AAPL"


def test_get_earnings_cache_hit(monkeypatch):
    """A second call does NOT invoke the producer again (cache hit)."""
    cache.clear()
    call_count = [0]

    def fake_fetch(frm, to):
        call_count[0] += 1
        return [
            {"symbol": "AAPL", "date": "2026-07-10", "hour": "amc", "epsEstimate": 1.55},
        ]

    monkeypatch.setattr(earnings_svc, "fetch_earnings", fake_fetch)

    earnings_svc.get_earnings(["AAPL"])
    earnings_svc.get_earnings(["AAPL"])

    assert call_count[0] == 1, "Producer should be called only once; second call uses cache"


def test_get_earnings_no_syms_returns_all(monkeypatch):
    """get_earnings([]) returns the full list (no filter)."""
    cache.clear()
    monkeypatch.setattr(earnings_svc, "fetch_earnings", lambda frm, to: [
        {"symbol": "AAPL", "date": "2026-07-10", "hour": "amc", "epsEstimate": 1.55},
        {"symbol": "MSFT", "date": "2026-07-15", "hour": "bmo", "epsEstimate": 2.88},
    ])

    rows, source = earnings_svc.get_earnings([])

    assert len(rows) == 2
    assert source == "finnhub"


def test_get_earnings_fallback_on_error(monkeypatch):
    """If the provider raises, get_earnings returns ([], 'mock')."""
    cache.clear()
    monkeypatch.setattr(earnings_svc, "fetch_earnings",
                        lambda frm, to: (_ for _ in ()).throw(RuntimeError("no key")))

    rows, source = earnings_svc.get_earnings(["AAPL"])

    assert rows == []
    assert source == "mock"


# ─── diagnostics ──────────────────────────────────────────────────────────────

def test_get_earnings_logs_coverage(monkeypatch, caplog):
    """get_earnings logs which requested symbols had upcoming earnings and
    which had none — so 'spotty' calendars can be explained from the logs.

    AAPL has an upcoming report; TSLA does not (no row in the window). The
    diagnostic must name TSLA as missing without flagging it as an error.
    """
    cache.clear()
    monkeypatch.setattr(earnings_svc, "fetch_earnings", lambda frm, to: [
        {"symbol": "AAPL", "date": "2026-07-10", "hour": "amc", "epsEstimate": 1.55},
        {"symbol": "MSFT", "date": "2026-07-15", "hour": "bmo", "epsEstimate": 2.88},
    ])

    with caplog.at_level("INFO", logger="services.earnings"):
        rows, source = earnings_svc.get_earnings(["AAPL", "TSLA"])

    assert source == "finnhub"
    assert {r["symbol"] for r in rows} == {"AAPL"}
    # The diagnostic line names the requested symbol with no upcoming report.
    msg = "\n".join(r.getMessage() for r in caplog.records)
    assert "TSLA" in msg
    assert "1/2" in msg or "1 of 2" in msg  # matched count surfaced
