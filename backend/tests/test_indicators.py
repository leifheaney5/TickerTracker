"""
TDD: Technical indicators service (F1 — foundation for the Pulse signal layer).

Written BEFORE the implementation so they fail first. These are PURE functions over
close/volume arrays (the shape produced by services/history.py bars: o/h/l/c/v).
Every value is hand-computable so the test proves the math, not the implementation.

Covered: sma, ema, rsi (Wilder seed), macd, bollinger (+ %B), range_position,
volume_ratio, sma_trend. Insufficient-data inputs return None (never raise).
"""
import math
import pytest

import services.indicators as ind


# ─── sma ─────────────────────────────────────────────────────────────────────

def test_sma_of_last_n():
    assert ind.sma([1, 2, 3, 4, 5], 5) == 3.0


def test_sma_uses_only_last_n():
    # last 3 of [10, 1, 2, 3] -> mean(1,2,3) = 2.0
    assert ind.sma([10, 1, 2, 3], 3) == 2.0


def test_sma_insufficient_returns_none():
    assert ind.sma([1, 2], 5) is None


# ─── ema ─────────────────────────────────────────────────────────────────────

def test_ema_of_constant_series_is_constant():
    assert ind.ema([4, 4, 4, 4, 4], 3) == pytest.approx(4.0)


def test_ema_insufficient_returns_none():
    assert ind.ema([1.0], 3) is None


# ─── rsi (Wilder; with exactly period+1 closes the seed == simple avg) ────────

def test_rsi_all_gains_is_100():
    assert ind.rsi([1, 2, 3], period=2) == pytest.approx(100.0)


def test_rsi_all_losses_is_0():
    assert ind.rsi([3, 2, 1], period=2) == pytest.approx(0.0)


def test_rsi_known_value():
    # closes [10, 11, 10.5], period=2: changes +1 (gain), -0.5 (loss)
    # avg gain = 0.5, avg loss = 0.25 -> RS = 2 -> RSI = 100 - 100/3 = 66.6667
    assert ind.rsi([10, 11, 10.5], period=2) == pytest.approx(66.6667, abs=1e-3)


def test_rsi_insufficient_returns_none():
    assert ind.rsi([10, 11], period=14) is None


# ─── macd ─────────────────────────────────────────────────────────────────────

def test_macd_flat_series_is_zero():
    closes = [5.0] * 40
    out = ind.macd(closes, fast=12, slow=26, signal=9)
    assert out["macd"] == pytest.approx(0.0, abs=1e-9)
    assert out["signal"] == pytest.approx(0.0, abs=1e-9)
    assert out["hist"] == pytest.approx(0.0, abs=1e-9)


def test_macd_insufficient_returns_none():
    assert ind.macd([1.0, 2.0, 3.0], fast=12, slow=26, signal=9) is None


# ─── bollinger ────────────────────────────────────────────────────────────────

def test_bollinger_flat_series_band_collapses():
    out = ind.bollinger([7.0] * 20, n=20, k=2)
    assert out["mid"] == pytest.approx(7.0)
    assert out["upper"] == pytest.approx(7.0)
    assert out["lower"] == pytest.approx(7.0)
    # zero-width band -> neutral %B by convention
    assert out["pct_b"] == pytest.approx(50.0)


def test_bollinger_mid_and_ordering():
    closes = [4, 4, 4, 6]
    out = ind.bollinger(closes, n=4, k=2)
    assert out["mid"] == pytest.approx(4.5)
    assert out["upper"] > out["mid"] > out["lower"]
    assert 0.0 <= out["pct_b"] <= 100.0


def test_bollinger_insufficient_returns_none():
    assert ind.bollinger([1, 2, 3], n=20, k=2) is None


# ─── range_position ───────────────────────────────────────────────────────────

def test_range_position_midpoint():
    assert ind.range_position(50, 0, 100) == pytest.approx(50.0)


def test_range_position_clamps():
    assert ind.range_position(-5, 0, 100) == pytest.approx(0.0)
    assert ind.range_position(150, 0, 100) == pytest.approx(100.0)


def test_range_position_degenerate_range_returns_none():
    assert ind.range_position(10, 10, 10) is None


# ─── volume_ratio ─────────────────────────────────────────────────────────────

def test_volume_ratio_latest_vs_prior_average():
    # prior 20 are all 10 -> avg 10; latest 20 -> ratio 2.0
    vols = [10] * 20 + [20]
    assert ind.volume_ratio(vols, n=20) == pytest.approx(2.0)


def test_volume_ratio_insufficient_returns_none():
    assert ind.volume_ratio([10, 20], n=20) is None


# ─── sma_trend (price vs SMA50/SMA200) ────────────────────────────────────────

def test_sma_trend_uptrend_above_both():
    closes = list(range(1, 220))  # strictly increasing -> price above both SMAs
    out = ind.sma_trend(closes)
    assert out["above_sma50"] is True
    assert out["above_sma200"] is True
    assert out["sma50"] is not None and out["sma200"] is not None


def test_sma_trend_short_series_partial_none():
    closes = list(range(1, 60))  # enough for SMA50, not SMA200
    out = ind.sma_trend(closes)
    assert out["sma50"] is not None
    assert out["sma200"] is None
    assert out["above_sma200"] is None
