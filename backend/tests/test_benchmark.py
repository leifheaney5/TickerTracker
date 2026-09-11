"""Tests for services/benchmark.py — pure helpers (TDD)."""
import pytest


# ── Pure helper: normalize_pct ───────────────────────────────────────────────

from services.benchmark import normalize_pct, portfolio_value_series


class TestNormalizePct:
    def test_empty_returns_empty(self):
        assert normalize_pct([]) == []

    def test_single_value_is_zero(self):
        assert normalize_pct([100.0]) == [0.0]

    def test_basic_gain(self):
        result = normalize_pct([100.0, 110.0, 120.0])
        assert result[0] == pytest.approx(0.0)
        assert result[1] == pytest.approx(10.0)
        assert result[2] == pytest.approx(20.0)

    def test_basic_loss(self):
        result = normalize_pct([200.0, 180.0, 160.0])
        assert result[0] == pytest.approx(0.0)
        assert result[1] == pytest.approx(-10.0)
        assert result[2] == pytest.approx(-20.0)

    def test_first_value_zero_returns_all_zeros(self):
        result = normalize_pct([0.0, 100.0, 200.0])
        assert result == [0.0, 0.0, 0.0]

    def test_length_preserved(self):
        vals = [50.0, 55.0, 52.0, 60.0, 58.0]
        result = normalize_pct(vals)
        assert len(result) == len(vals)

    def test_mixed_series(self):
        result = normalize_pct([100.0, 50.0, 150.0])
        assert result[0] == pytest.approx(0.0)
        assert result[1] == pytest.approx(-50.0)
        assert result[2] == pytest.approx(50.0)

    def test_precision_rounding(self):
        # Result should be rounded to 4 decimal places
        result = normalize_pct([3.0, 4.0])
        # (4-3)/3 * 100 = 33.3333...
        assert result[1] == pytest.approx(33.3333, abs=1e-3)


# ── Pure helper: portfolio_value_series ─────────────────────────────────────

def _bar(date, close):
    return {"date": date, "o": close, "h": close, "l": close, "c": close, "v": 0}


class TestPortfolioValueSeries:
    def test_empty_holdings_returns_empty(self):
        result = portfolio_value_series([], {})
        assert result == []

    def test_single_holding_single_date(self):
        holdings = [{"symbol": "AAPL", "shares": 10.0}]
        histories = {"AAPL": [_bar("2025-01-02", 150.0)]}
        result = portfolio_value_series(holdings, histories)
        assert result == [("2025-01-02", 1500.0)]

    def test_intersection_of_dates_used(self):
        # AAPL has 3 dates, TSLA has 2; intersection is the 2 common ones.
        holdings = [
            {"symbol": "AAPL", "shares": 10.0},
            {"symbol": "TSLA", "shares": 5.0},
        ]
        histories = {
            "AAPL": [_bar("2025-01-02", 150.0), _bar("2025-01-03", 152.0), _bar("2025-01-06", 155.0)],
            "TSLA": [_bar("2025-01-02", 200.0), _bar("2025-01-03", 205.0)],
        }
        result = portfolio_value_series(holdings, histories)
        dates = [d for d, _ in result]
        assert dates == ["2025-01-02", "2025-01-03"]
        values = [v for _, v in result]
        # 2025-01-02: 10*150 + 5*200 = 1500+1000 = 2500
        assert values[0] == pytest.approx(2500.0)
        # 2025-01-03: 10*152 + 5*205 = 1520+1025 = 2545
        assert values[1] == pytest.approx(2545.0)

    def test_no_common_dates_returns_empty(self):
        holdings = [
            {"symbol": "AAPL", "shares": 10.0},
            {"symbol": "TSLA", "shares": 5.0},
        ]
        histories = {
            "AAPL": [_bar("2025-01-02", 150.0)],
            "TSLA": [_bar("2025-01-03", 200.0)],
        }
        result = portfolio_value_series(holdings, histories)
        assert result == []

    def test_missing_symbol_history_excluded(self):
        # AAPL has history, TSLA doesn't — no intersection
        holdings = [
            {"symbol": "AAPL", "shares": 10.0},
            {"symbol": "TSLA", "shares": 5.0},
        ]
        histories = {"AAPL": [_bar("2025-01-02", 150.0)]}
        result = portfolio_value_series(holdings, histories)
        assert result == []

    def test_result_sorted_by_date(self):
        holdings = [{"symbol": "AAPL", "shares": 1.0}]
        # Unsorted input
        histories = {"AAPL": [_bar("2025-01-03", 152.0), _bar("2025-01-02", 150.0)]}
        result = portfolio_value_series(holdings, histories)
        dates = [d for d, _ in result]
        assert dates == sorted(dates)

    def test_fractional_shares(self):
        holdings = [{"symbol": "AAPL", "shares": 1.5}]
        histories = {"AAPL": [_bar("2025-01-02", 200.0)]}
        result = portfolio_value_series(holdings, histories)
        assert result[0][1] == pytest.approx(300.0)

    def test_multiple_holdings_summed(self):
        holdings = [
            {"symbol": "A", "shares": 2.0},
            {"symbol": "B", "shares": 3.0},
        ]
        histories = {
            "A": [_bar("2025-01-02", 100.0)],
            "B": [_bar("2025-01-02", 50.0)],
        }
        result = portfolio_value_series(holdings, histories)
        assert result[0][1] == pytest.approx(2*100 + 3*50)
