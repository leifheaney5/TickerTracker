"""Brand-logo source: Finnhub profile2.logo via providers.finnhub.fetch_logo,
aggregated by services.logos.get_logos (cached per symbol, concurrent)."""
import providers.finnhub as fh
import services.logos as L


class _FakeResponse:
    def __init__(self, payload, status=200):
        self._payload = payload
        self.status_code = status

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(f"HTTP {self.status_code}")

    def json(self):
        return self._payload


# ── provider: fetch_logo ──────────────────────────────────────────────────────

def test_fetch_logo_returns_profile2_logo_url(monkeypatch):
    monkeypatch.setenv("FINNHUB_API_KEY", "test-key")
    monkeypatch.setattr(fh.requests, "get",
                        lambda url, params=None, timeout=None: _FakeResponse(
                            {"logo": "https://static.finnhub.io/logo/KO.png", "weburl": "https://www.coca-cola.com"}))
    assert fh.fetch_logo("KO") == "https://static.finnhub.io/logo/KO.png"


def test_fetch_logo_returns_empty_when_no_logo(monkeypatch):
    monkeypatch.setenv("FINNHUB_API_KEY", "test-key")
    monkeypatch.setattr(fh.requests, "get",
                        lambda url, params=None, timeout=None: _FakeResponse({"weburl": "x"}))
    assert fh.fetch_logo("ZZZZ") == ""


# ── service: get_logos ────────────────────────────────────────────────────────

def test_get_logos_maps_symbols_to_urls(monkeypatch):
    import cache
    cache.clear()
    monkeypatch.setattr(L.finnhub, "fetch_logo", lambda s: f"https://logo/{s}.png")
    data = L.get_logos(["AAPL", "NVDA"])
    assert data == {"AAPL": "https://logo/AAPL.png", "NVDA": "https://logo/NVDA.png"}


def test_get_logos_omits_empty_and_errored_symbols(monkeypatch):
    import cache
    cache.clear()

    def fake(s):
        if s == "AAPL":
            return "https://logo/AAPL.png"
        if s == "NONE":
            return ""            # Finnhub has no logo for it
        raise RuntimeError("provider down")  # BAD

    monkeypatch.setattr(L.finnhub, "fetch_logo", fake)
    data = L.get_logos(["AAPL", "NONE", "BAD"])
    assert data == {"AAPL": "https://logo/AAPL.png"}


def test_get_logos_empty_input_returns_empty():
    assert L.get_logos([]) == {}
