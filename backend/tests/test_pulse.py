"""
TDD: Pulse composite score (F2 — the named moat metric).

Pulse is a transparent 0-100 score blending independent, real signal types (momentum, trend,
52-week positioning, analyst, news-headline sentiment) with PUBLISHED weights. These tests assert
the *behavior and honesty contract*, not a single opaque number:

  - strong-bull inputs -> high score, "Hot" band; strong-bear -> low score, "Cooling".
  - every component is explainable: carries a label, raw value, weight, contribution.
  - a failing/missing input degrades to omitting that component and renormalizing — never crashes.
  - the sentiment component is honestly labeled as headline-based; output carries a not-advice note.

Real services are monkeypatched (the unit under test is the *composition*, not the providers).
"""
import pytest

import services.pulse as pulse


def _closes_to_bars(closes):
    return [{"date": str(i), "o": c, "h": c, "l": c, "c": c, "v": 1000} for i, c in enumerate(closes)]


def _patch(monkeypatch, *, closes, fundamentals, ratings, news):
    monkeypatch.setattr(pulse.history_svc, "get_history",
                        lambda sym, tf: (_closes_to_bars(closes), "yahoo"))
    monkeypatch.setattr(pulse.fundamentals_svc, "get_fundamentals",
                        lambda sym: (fundamentals, "yahoo"))
    monkeypatch.setattr(pulse.ratings_svc, "get_ratings",
                        lambda sym: (ratings, "finnhub"))
    monkeypatch.setattr(pulse.news_svc, "get_news",
                        lambda sym=None: (news, "finnhub"))


_BULL_FUND = {"week52_low": 1.0, "week52_high": 260.0, "pe": 20.0, "eps": 5.0}
_BULL_RATINGS = {"consensus": "Strong Buy",
                 "distribution": {"strongBuy": 20, "buy": 5, "hold": 1, "sell": 0, "strongSell": 0},
                 "target": {"low": 270, "mean": 300, "high": 330, "current": 260}}
_BULL_NEWS = [{"sentiment": "Bullish"}, {"sentiment": "Bullish"}, {"sentiment": "Bullish"}]

_BEAR_FUND = {"week52_low": 1.0, "week52_high": 260.0, "pe": 90.0, "eps": 0.2}
_BEAR_RATINGS = {"consensus": "Strong Sell",
                 "distribution": {"strongBuy": 0, "buy": 0, "hold": 1, "sell": 5, "strongSell": 20},
                 "target": {"low": 1, "mean": 2, "high": 3, "current": 5}}
_BEAR_NEWS = [{"sentiment": "Bearish"}, {"sentiment": "Bearish"}, {"sentiment": "Bearish"}]


# ─── happy paths: directionality ──────────────────────────────────────────────

def test_strong_bull_is_hot(monkeypatch):
    _patch(monkeypatch, closes=list(range(1, 261)),
           fundamentals=_BULL_FUND, ratings=_BULL_RATINGS, news=_BULL_NEWS)
    out = pulse.compute_pulse("AAA")
    assert out["symbol"] == "AAA"
    assert out["score"] >= 75
    assert out["band"] == "Hot"


def test_strong_bear_is_cooling(monkeypatch):
    _patch(monkeypatch, closes=list(range(260, 0, -1)),
           fundamentals=_BEAR_FUND, ratings=_BEAR_RATINGS, news=_BEAR_NEWS)
    out = pulse.compute_pulse("BBB")
    assert out["score"] <= 25
    assert out["band"] == "Cooling"


def test_score_is_bounded(monkeypatch):
    _patch(monkeypatch, closes=list(range(1, 261)),
           fundamentals=_BULL_FUND, ratings=_BULL_RATINGS, news=_BULL_NEWS)
    out = pulse.compute_pulse("AAA")
    assert 0 <= out["score"] <= 100


# ─── explainability contract ──────────────────────────────────────────────────

def test_components_are_explainable(monkeypatch):
    _patch(monkeypatch, closes=list(range(1, 261)),
           fundamentals=_BULL_FUND, ratings=_BULL_RATINGS, news=_BULL_NEWS)
    out = pulse.compute_pulse("AAA")
    keys = {c["key"] for c in out["components"]}
    assert {"momentum", "trend", "positioning", "analyst", "sentiment"} <= keys
    for c in out["components"]:
        assert set(["key", "label", "raw", "value", "state", "weight"]).issubset(c.keys())
        assert 0 <= c["value"] <= 100
        assert c["weight"] > 0


def test_positioning_raw_is_top_of_range(monkeypatch):
    # last close 260 with 52w range [1, 260] -> positioning value == 100
    _patch(monkeypatch, closes=list(range(1, 261)),
           fundamentals=_BULL_FUND, ratings=_BULL_RATINGS, news=_BULL_NEWS)
    out = pulse.compute_pulse("AAA")
    pos = next(c for c in out["components"] if c["key"] == "positioning")
    assert pos["value"] == pytest.approx(100.0)


# ─── honesty contract ─────────────────────────────────────────────────────────

def test_sentiment_labeled_headline_based(monkeypatch):
    _patch(monkeypatch, closes=list(range(1, 261)),
           fundamentals=_BULL_FUND, ratings=_BULL_RATINGS, news=_BULL_NEWS)
    out = pulse.compute_pulse("AAA")
    sent = next(c for c in out["components"] if c["key"] == "sentiment")
    assert "headline" in sent["label"].lower()


def test_output_carries_not_advice_note(monkeypatch):
    _patch(monkeypatch, closes=list(range(1, 261)),
           fundamentals=_BULL_FUND, ratings=_BULL_RATINGS, news=_BULL_NEWS)
    out = pulse.compute_pulse("AAA")
    assert "advice" in out["disclaimer"].lower()
    assert out.get("asOf")


# ─── graceful degradation ─────────────────────────────────────────────────────

def test_missing_component_is_omitted_and_renormalized(monkeypatch):
    _patch(monkeypatch, closes=list(range(1, 261)),
           fundamentals=_BULL_FUND, ratings=_BULL_RATINGS, news=_BULL_NEWS)

    def _boom(sym=None):
        raise RuntimeError("news provider down")

    monkeypatch.setattr(pulse.news_svc, "get_news", _boom)
    out = pulse.compute_pulse("AAA")
    keys = {c["key"] for c in out["components"]}
    assert "sentiment" not in keys          # omitted, not faked
    assert 0 <= out["score"] <= 100         # still computes from remaining components
    # weights of present components renormalize to ~1.0
    assert sum(c["weight"] for c in out["components"]) == pytest.approx(1.0, abs=1e-6)


def test_empty_history_still_returns_score(monkeypatch):
    _patch(monkeypatch, closes=[],
           fundamentals=_BULL_FUND, ratings=_BULL_RATINGS, news=_BULL_NEWS)
    out = pulse.compute_pulse("AAA")
    assert 0 <= out["score"] <= 100
    assert isinstance(out["components"], list)
