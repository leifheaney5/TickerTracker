"""Tests for services/dividends.py — pure helpers first (TDD)."""
import datetime
import pytest


# ── Pure helper: project_dividends ──────────────────────────────────────────

from services.dividends import project_dividends, annual_income_estimate


TODAY = datetime.date(2025, 6, 30)


class TestProjectDividends:
    def _holding(self, symbol, shares):
        return {"symbol": symbol, "shares": shares}

    def test_empty_holdings_returns_empty(self):
        result = project_dividends([], {}, TODAY)
        assert result == []

    def test_symbol_with_no_dividend_events_skipped(self):
        holdings = [self._holding("AAPL", 10.0)]
        result = project_dividends(holdings, {"AAPL": []}, TODAY)
        assert result == []

    def test_missing_symbol_in_events_dict_skipped(self):
        holdings = [self._holding("AAPL", 10.0)]
        result = project_dividends(holdings, {}, TODAY)
        assert result == []

    def test_past_ex_date_status_paid(self):
        events = {"AAPL": [{"ex_date": "2025-05-09", "pay_date": "2025-05-15", "amount": 0.25}]}
        holdings = [self._holding("AAPL", 10.0)]
        result = project_dividends(holdings, events, TODAY)
        assert len(result) == 1
        row = result[0]
        assert row["status"] == "paid"
        assert row["symbol"] == "AAPL"
        assert row["per_share"] == 0.25
        assert row["shares"] == 10.0
        assert row["total"] == pytest.approx(2.50)
        assert row["ex_date"] == "2025-05-09"
        assert row["pay_date"] == "2025-05-15"

    def test_future_ex_date_status_upcoming(self):
        events = {"AAPL": [{"ex_date": "2025-08-12", "pay_date": "2025-08-18", "amount": 0.26}]}
        holdings = [self._holding("AAPL", 20.0)]
        result = project_dividends(holdings, events, TODAY)
        assert result[0]["status"] == "upcoming"
        assert result[0]["total"] == pytest.approx(5.20)

    def test_same_day_ex_date_is_upcoming(self):
        events = {"AAPL": [{"ex_date": TODAY.isoformat(), "pay_date": None, "amount": 0.25}]}
        holdings = [self._holding("AAPL", 4.0)]
        result = project_dividends(holdings, events, TODAY)
        assert result[0]["status"] == "upcoming"

    def test_fractional_shares_total(self):
        events = {"JNJ": [{"ex_date": "2025-02-18", "pay_date": "2025-03-04", "amount": 1.30}]}
        holdings = [self._holding("JNJ", 3.5)]
        result = project_dividends(holdings, events, TODAY)
        assert result[0]["total"] == pytest.approx(4.55)

    def test_pay_date_none_preserved(self):
        events = {"AAPL": [{"ex_date": "2025-05-09", "pay_date": None, "amount": 0.25}]}
        holdings = [self._holding("AAPL", 10.0)]
        result = project_dividends(holdings, events, TODAY)
        assert result[0]["pay_date"] is None

    def test_multiple_holdings_and_events_sorted_by_ex_date(self):
        events = {
            "AAPL": [
                {"ex_date": "2025-08-12", "pay_date": None, "amount": 0.26},
                {"ex_date": "2025-02-07", "pay_date": None, "amount": 0.25},
            ],
            "KO": [
                {"ex_date": "2025-03-14", "pay_date": "2025-04-01", "amount": 0.51},
            ],
        }
        holdings = [self._holding("AAPL", 10.0), self._holding("KO", 5.0)]
        result = project_dividends(holdings, events, TODAY)
        assert len(result) == 3
        dates = [r["ex_date"] for r in result]
        assert dates == sorted(dates)

    def test_symbol_not_in_holdings_has_no_row(self):
        # dividend_events has MSFT but holdings don't
        events = {"MSFT": [{"ex_date": "2025-08-01", "pay_date": None, "amount": 0.75}]}
        holdings = [self._holding("AAPL", 5.0)]
        result = project_dividends(holdings, events, TODAY)
        assert result == []


# ── Pure helper: annual_income_estimate ─────────────────────────────────────

class TestAnnualIncomeEstimate:
    def _holding(self, symbol, shares):
        return {"symbol": symbol, "shares": shares}

    def test_empty_returns_zero(self):
        assert annual_income_estimate([], {}, TODAY) == 0.0

    def test_no_events_in_trailing_year_returns_zero(self):
        # All events are outside the trailing 12-month window
        events = {"AAPL": [{"ex_date": "2023-01-01", "pay_date": None, "amount": 0.23}]}
        result = annual_income_estimate([self._holding("AAPL", 10.0)], events, TODAY)
        assert result == 0.0

    def test_future_events_excluded(self):
        events = {"AAPL": [{"ex_date": "2026-01-01", "pay_date": None, "amount": 0.26}]}
        result = annual_income_estimate([self._holding("AAPL", 10.0)], events, TODAY)
        assert result == 0.0

    def test_trailing_year_events_summed(self):
        # 4 quarterly dividends @ $0.25 × 10 shares = $10
        events = {
            "AAPL": [
                {"ex_date": "2024-08-12", "pay_date": None, "amount": 0.25},
                {"ex_date": "2024-11-08", "pay_date": None, "amount": 0.25},
                {"ex_date": "2025-02-07", "pay_date": None, "amount": 0.25},
                {"ex_date": "2025-05-09", "pay_date": None, "amount": 0.25},
            ]
        }
        result = annual_income_estimate([self._holding("AAPL", 10.0)], events, TODAY)
        assert result == pytest.approx(10.0)

    def test_fractional_shares_included(self):
        events = {"JNJ": [{"ex_date": "2025-02-18", "pay_date": None, "amount": 1.30}]}
        result = annual_income_estimate([self._holding("JNJ", 3.5)], events, TODAY)
        assert result == pytest.approx(4.55)

    def test_multiple_holdings_summed(self):
        events = {
            "AAPL": [{"ex_date": "2025-05-09", "pay_date": None, "amount": 0.25}],
            "KO": [{"ex_date": "2025-03-14", "pay_date": None, "amount": 0.51}],
        }
        holdings = [self._holding("AAPL", 10.0), self._holding("KO", 5.0)]
        result = annual_income_estimate(holdings, events, TODAY)
        # AAPL: 0.25*10 = 2.50 + KO: 0.51*5 = 2.55 → 5.05
        assert result == pytest.approx(5.05)

    def test_holding_not_in_events_contributes_zero(self):
        holdings = [self._holding("XYZ", 100.0)]
        result = annual_income_estimate(holdings, {}, TODAY)
        assert result == 0.0
