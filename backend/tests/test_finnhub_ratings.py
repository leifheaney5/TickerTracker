"""Part B-3: finnhub.fetch_ratings consensus threshold coverage.

Tests monkeypatch requests.get to return recommendation distributions that
exercise each consensus label boundary in finnhub.fetch_ratings().

Consensus scoring formula (from providers/finnhub.py):
  score = (strongBuy*1 + buy*2 + hold*3 + sell*4 + strongSell*5) / max(1, total)
  < 1.6  -> "Strong Buy"
  < 2.5  -> "Buy"
  < 3.5  -> "Hold"
  < 4.5  -> "Sell"
  >= 4.5 -> "Strong Sell"
"""
import pytest
import providers.finnhub as fh


class _FakeResponse:
    """Minimal requests.Response substitute."""

    def __init__(self, payload, status=200):
        self._payload = payload
        self.status_code = status
        self.ok = (status < 400)

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(f"HTTP {self.status_code}")

    def json(self):
        return self._payload


def _make_get(rec_payload, pt_payload=None):
    """Return a fake requests.get that routes by URL fragment."""
    def _get(url, params=None, timeout=None):
        if "recommendation" in url:
            return _FakeResponse(rec_payload)
        # price-target
        return _FakeResponse(pt_payload or {"targetLow": 100, "targetHigh": 200,
                                             "targetMean": 150, "lastPrice": 140})
    return _get


def _patch(monkeypatch, rec_payload, pt_payload=None):
    """Monkeypatch both the API key and requests.get."""
    monkeypatch.setenv("FINNHUB_API_KEY", "test-key")
    monkeypatch.setattr(fh.requests, "get", _make_get(rec_payload, pt_payload))


# --- Strong Buy (score < 1.6) ---

def test_fetch_ratings_strong_buy(monkeypatch):
    """All analysts are strongBuy -> score = 1.0 -> 'Strong Buy'."""
    _patch(monkeypatch, [
        {"strongBuy": 10, "buy": 0, "hold": 0, "sell": 0, "strongSell": 0}
    ])
    result = fh.fetch_ratings("AAPL")
    assert result["consensus"] == "Strong Buy"


def test_fetch_ratings_strong_buy_near_threshold(monkeypatch):
    """strongBuy=9, buy=1 -> score = (9+2)/10 = 1.1 -> 'Strong Buy'."""
    _patch(monkeypatch, [
        {"strongBuy": 9, "buy": 1, "hold": 0, "sell": 0, "strongSell": 0}
    ])
    result = fh.fetch_ratings("AAPL")
    assert result["consensus"] == "Strong Buy"


# --- Buy (1.6 <= score < 2.5) ---

def test_fetch_ratings_buy(monkeypatch):
    """buy=10 only -> score = 20/10 = 2.0 -> 'Buy'."""
    _patch(monkeypatch, [
        {"strongBuy": 0, "buy": 10, "hold": 0, "sell": 0, "strongSell": 0}
    ])
    result = fh.fetch_ratings("MSFT")
    assert result["consensus"] == "Buy"


def test_fetch_ratings_buy_mixed(monkeypatch):
    """strongBuy=1, buy=8, hold=1 -> score=(1+16+3)/10=2.0 -> 'Buy'."""
    _patch(monkeypatch, [
        {"strongBuy": 1, "buy": 8, "hold": 1, "sell": 0, "strongSell": 0}
    ])
    result = fh.fetch_ratings("MSFT")
    assert result["consensus"] == "Buy"


# --- Hold (2.5 <= score < 3.5) ---

def test_fetch_ratings_hold(monkeypatch):
    """hold=10 only -> score = 30/10 = 3.0 -> 'Hold'."""
    _patch(monkeypatch, [
        {"strongBuy": 0, "buy": 0, "hold": 10, "sell": 0, "strongSell": 0}
    ])
    result = fh.fetch_ratings("TSLA")
    assert result["consensus"] == "Hold"


# --- Sell (3.5 <= score < 4.5) ---

def test_fetch_ratings_sell(monkeypatch):
    """sell=10 only -> score = 40/10 = 4.0 -> 'Sell'."""
    _patch(monkeypatch, [
        {"strongBuy": 0, "buy": 0, "hold": 0, "sell": 10, "strongSell": 0}
    ])
    result = fh.fetch_ratings("XYZ")
    assert result["consensus"] == "Sell"


def test_fetch_ratings_sell_mixed(monkeypatch):
    """hold=3, sell=7 -> score=(9+28)/10=3.7 -> 'Sell'."""
    _patch(monkeypatch, [
        {"strongBuy": 0, "buy": 0, "hold": 3, "sell": 7, "strongSell": 0}
    ])
    result = fh.fetch_ratings("XYZ")
    assert result["consensus"] == "Sell"


# --- Strong Sell (score >= 4.5) ---

def test_fetch_ratings_strong_sell(monkeypatch):
    """strongSell=10 only -> score = 50/10 = 5.0 -> 'Strong Sell'."""
    _patch(monkeypatch, [
        {"strongBuy": 0, "buy": 0, "hold": 0, "sell": 0, "strongSell": 10}
    ])
    result = fh.fetch_ratings("DOOM")
    assert result["consensus"] == "Strong Sell"


def test_fetch_ratings_strong_sell_mixed(monkeypatch):
    """sell=2, strongSell=8 -> score=(8+40)/10=4.8 -> 'Strong Sell'."""
    _patch(monkeypatch, [
        {"strongBuy": 0, "buy": 0, "hold": 0, "sell": 2, "strongSell": 8}
    ])
    result = fh.fetch_ratings("DOOM")
    assert result["consensus"] == "Strong Sell"


# --- Response shape ---

def test_fetch_ratings_returns_required_keys(monkeypatch):
    """Result must contain consensus, distribution, and target with expected subkeys."""
    _patch(monkeypatch, [
        {"strongBuy": 5, "buy": 5, "hold": 0, "sell": 0, "strongSell": 0}
    ], pt_payload={"targetLow": 90, "targetHigh": 150, "targetMean": 120, "lastPrice": 100})
    result = fh.fetch_ratings("AAPL")
    assert set(result.keys()) == {"consensus", "distribution", "target"}
    assert set(result["distribution"].keys()) == {"strongBuy", "buy", "hold", "sell", "strongSell"}
    assert set(result["target"].keys()) == {"low", "high", "mean", "current"}
    assert result["target"]["low"] == 90
    assert result["target"]["high"] == 150
    assert result["target"]["current"] == 100


def test_fetch_ratings_empty_recs_raises(monkeypatch):
    """Empty recommendation list -> RuntimeError (no recommendations)."""
    _patch(monkeypatch, [])
    with pytest.raises(RuntimeError, match="no recommendations"):
        fh.fetch_ratings("UNKN")
