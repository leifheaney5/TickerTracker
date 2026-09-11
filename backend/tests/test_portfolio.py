"""Tests for portfolio.py — pure helpers first (TDD), then integration."""
import pytest


# ── Pure accounting helpers ──────────────────────────────────────────────────

from services.portfolio import apply_buy, apply_sell, position_pnl


class TestApplyBuy:
    def test_first_buy_no_fees(self):
        shares, avg = apply_buy(0.0, 0.0, 10.0, 100.0, 0.0)
        assert shares == 10.0
        assert avg == 100.0

    def test_second_buy_averages_cost(self):
        # Start: 10 shares @ $100 = $1000
        # Buy: 5 shares @ $120 = $600
        # New avg = (1000 + 600) / 15 = $106.67
        shares, avg = apply_buy(10.0, 100.0, 5.0, 120.0, 0.0)
        assert shares == 15.0
        assert round(avg, 4) == round(1600.0 / 15.0, 4)

    def test_fees_included_in_avg_cost(self):
        # Buy 10 shares @ $100 + $10 fees → cost = $1010 / 10 = $101
        shares, avg = apply_buy(0.0, 0.0, 10.0, 100.0, 10.0)
        assert shares == 10.0
        assert avg == pytest.approx(101.0)

    def test_fractional_shares(self):
        shares, avg = apply_buy(1.5, 200.0, 0.25, 210.0, 0.0)
        expected_avg = (1.5 * 200.0 + 0.25 * 210.0) / 1.75
        assert shares == pytest.approx(1.75)
        assert avg == pytest.approx(expected_avg)

    def test_add_to_existing_with_fees(self):
        # 10 @ $50 = $500; buy 10 @ $60 + $5 fees = $605; total $1105 / 20 = $55.25
        shares, avg = apply_buy(10.0, 50.0, 10.0, 60.0, 5.0)
        assert shares == 20.0
        assert avg == pytest.approx(1105.0 / 20.0)


class TestApplySell:
    def test_sell_partial(self):
        # Sell 5 of 10 @ $120; avg_cost=$100; realized = 5*(120-100) - 0 = $100
        new_shares, realized = apply_sell(10.0, 100.0, 5.0, 120.0, 0.0)
        assert new_shares == 5.0
        assert realized == pytest.approx(100.0)

    def test_sell_to_zero(self):
        new_shares, realized = apply_sell(10.0, 100.0, 10.0, 110.0, 0.0)
        assert new_shares == 0.0
        assert realized == pytest.approx(100.0)

    def test_sell_with_fees(self):
        # Sell 5 @ $120, avg=$100, fees=$10 → realized = 5*(120-100) - 10 = $90
        new_shares, realized = apply_sell(10.0, 100.0, 5.0, 120.0, 10.0)
        assert new_shares == 5.0
        assert realized == pytest.approx(90.0)

    def test_sell_at_loss(self):
        # Sell 5 @ $80, avg=$100 → realized = 5*(80-100) - 0 = -$100
        new_shares, realized = apply_sell(10.0, 100.0, 5.0, 80.0, 0.0)
        assert new_shares == 5.0
        assert realized == pytest.approx(-100.0)

    def test_oversell_raises(self):
        with pytest.raises(ValueError, match="oversell"):
            apply_sell(5.0, 100.0, 10.0, 120.0, 0.0)

    def test_zero_fee_sell(self):
        new_shares, realized = apply_sell(100.0, 50.0, 10.0, 55.0, 0.0)
        assert new_shares == 90.0
        assert realized == pytest.approx(50.0)

    def test_fractional_sell(self):
        new_shares, realized = apply_sell(1.75, 200.0, 0.25, 220.0, 0.0)
        assert new_shares == pytest.approx(1.5)
        assert realized == pytest.approx(0.25 * (220.0 - 200.0))


class TestPositionPnl:
    def test_basic_unrealized(self):
        result = position_pnl(10.0, 100.0, 120.0, 115.0, 0.0, 0.0)
        assert result["shares"] == 10.0
        assert result["avg_cost"] == 100.0
        assert result["price"] == 120.0
        assert result["cost_basis"] == pytest.approx(1000.0)
        assert result["market_value"] == pytest.approx(1200.0)
        assert result["unrealized"] == pytest.approx(200.0)
        assert result["unrealized_pct"] == pytest.approx(20.0)
        assert result["prev_close"] == 115.0
        assert result["daily_pnl"] == pytest.approx((120.0 - 115.0) * 10.0)  # $50

    def test_daily_pnl_with_prev_close(self):
        result = position_pnl(5.0, 200.0, 210.0, 205.0, 0.0, 0.0)
        assert result["daily_pnl"] == pytest.approx((210.0 - 205.0) * 5.0)  # $25

    def test_realized_and_fees(self):
        result = position_pnl(10.0, 100.0, 120.0, 115.0, 50.0, 10.0)
        assert result["realized_pnl"] == pytest.approx(50.0)
        assert result["fees_paid"] == pytest.approx(10.0)

    def test_zero_cost_basis(self):
        # Edge: shares == 0 (position closed)
        result = position_pnl(0.0, 100.0, 120.0, 115.0, 200.0, 5.0)
        assert result["cost_basis"] == 0.0
        assert result["market_value"] == 0.0
        assert result["unrealized_pct"] == 0.0

    def test_prev_close_none_daily_pnl_zero(self):
        # When prev_close is None/0, daily_pnl should be 0 (no fallback)
        result = position_pnl(10.0, 100.0, 120.0, None, 0.0, 0.0)
        assert result["daily_pnl"] == pytest.approx(0.0)


# ── Integration: record_transaction + compute_pnl ────────────────────────────

class TestRecordTransaction:
    def test_buy_creates_holding(self, seed_user):
        from services.portfolio import record_transaction
        import db, models
        result = record_transaction(1, "AAPL", "buy", 10.0, 150.0, 0.0)
        assert result["holding"]["shares"] == 10.0
        assert result["holding"]["avg_cost"] == 150.0
        assert result["realized"] == 0.0
        with db.get_session() as s:
            h = s.query(models.Holding).filter_by(user_id=1, symbol="AAPL").first()
            assert h is not None
            assert h.shares == 10.0

    def test_buy_then_sell_updates_holding(self, seed_user):
        from services.portfolio import record_transaction
        record_transaction(1, "AAPL", "buy", 10.0, 150.0, 0.0)
        result = record_transaction(1, "AAPL", "sell", 5.0, 160.0, 0.0)
        assert result["holding"]["shares"] == 5.0
        assert result["realized"] == pytest.approx(50.0)

    def test_oversell_raises(self, seed_user):
        from services.portfolio import record_transaction
        record_transaction(1, "AAPL", "buy", 5.0, 100.0, 0.0)
        with pytest.raises(ValueError, match="oversell"):
            record_transaction(1, "AAPL", "sell", 10.0, 110.0, 0.0)

    def test_fees_added_to_avg_cost_on_buy(self, seed_user):
        from services.portfolio import record_transaction
        # 10 shares @ $100 + $10 fees → avg_cost = $101
        result = record_transaction(1, "TSLA", "buy", 10.0, 100.0, 10.0)
        assert result["holding"]["avg_cost"] == pytest.approx(101.0)

    def test_sell_fees_reduce_realized(self, seed_user):
        from services.portfolio import record_transaction
        record_transaction(1, "AAPL", "buy", 10.0, 100.0, 0.0)
        result = record_transaction(1, "AAPL", "sell", 5.0, 120.0, 5.0)
        # realized = 5*(120-100) - 5 = $95
        assert result["realized"] == pytest.approx(95.0)

    def test_transaction_recorded_in_db(self, seed_user):
        from services.portfolio import record_transaction
        import db, models
        record_transaction(1, "AAPL", "buy", 10.0, 150.0, 2.50, note="first buy")
        with db.get_session() as s:
            txns = s.query(models.Transaction).filter_by(user_id=1).all()
            assert len(txns) == 1
            assert txns[0].symbol == "AAPL"
            assert txns[0].kind == "buy"
            assert txns[0].quantity == 10.0
            assert txns[0].price == 150.0
            assert txns[0].fees == 2.50
            assert txns[0].note == "first buy"

    def test_multiple_buys_average_correctly(self, seed_user):
        from services.portfolio import record_transaction
        import db, models
        record_transaction(1, "AAPL", "buy", 10.0, 100.0, 0.0)
        record_transaction(1, "AAPL", "buy", 10.0, 120.0, 0.0)
        with db.get_session() as s:
            h = s.query(models.Holding).filter_by(user_id=1, symbol="AAPL").first()
            assert h.shares == pytest.approx(20.0)
            assert h.avg_cost == pytest.approx(110.0)

    def test_sell_to_zero_removes_shares(self, seed_user):
        from services.portfolio import record_transaction
        record_transaction(1, "AAPL", "buy", 5.0, 100.0, 0.0)
        result = record_transaction(1, "AAPL", "sell", 5.0, 110.0, 0.0)
        assert result["holding"]["shares"] == 0.0
        assert result["realized"] == pytest.approx(50.0)


class TestComputePnl:
    def test_basic_portfolio(self, seed_user):
        from services.portfolio import record_transaction, compute_pnl
        record_transaction(1, "AAPL", "buy", 10.0, 100.0, 0.0)

        def mock_quote(sym):
            return {"price": 110.0, "prev_close": 105.0}

        result = compute_pnl(1, mock_quote)
        assert len(result["positions"]) == 1
        pos = result["positions"][0]
        assert pos["symbol"] == "AAPL"
        assert pos["shares"] == 10.0
        assert pos["avg_cost"] == 100.0
        assert pos["cost_basis"] == pytest.approx(1000.0)
        assert pos["market_value"] == pytest.approx(1100.0)
        assert pos["unrealized"] == pytest.approx(100.0)
        assert pos["unrealized_pct"] == pytest.approx(10.0)
        assert pos["prev_close"] == 105.0
        assert pos["daily_pnl"] == pytest.approx(50.0)  # (110-105)*10

        totals = result["totals"]
        assert totals["market_value"] == pytest.approx(1100.0)
        assert totals["unrealized"] == pytest.approx(100.0)

    def test_empty_holdings(self, seed_user):
        from services.portfolio import compute_pnl
        result = compute_pnl(1, lambda sym: {"price": 100.0, "prev_close": 99.0})
        assert result["positions"] == []
        assert result["totals"]["market_value"] == 0.0

    def test_totals_aggregate_correctly(self, seed_user):
        from services.portfolio import record_transaction, compute_pnl
        record_transaction(1, "AAPL", "buy", 10.0, 100.0, 0.0)
        record_transaction(1, "TSLA", "buy", 5.0, 200.0, 0.0)

        def mock_quote(sym):
            prices = {"AAPL": (110.0, 105.0), "TSLA": (210.0, 200.0)}
            p, pc = prices[sym]
            return {"price": p, "prev_close": pc}

        result = compute_pnl(1, mock_quote)
        assert len(result["positions"]) == 2
        totals = result["totals"]
        # AAPL: value=1100, cost=1000; TSLA: value=1050, cost=1000
        assert totals["market_value"] == pytest.approx(2150.0)
        assert totals["cost_basis"] == pytest.approx(2000.0)
        assert totals["unrealized"] == pytest.approx(150.0)
        # daily: (110-105)*10 + (210-200)*5 = 50 + 50 = 100
        assert totals["daily_pnl"] == pytest.approx(100.0)

    def test_realized_pnl_in_totals(self, seed_user):
        from services.portfolio import record_transaction, compute_pnl
        record_transaction(1, "AAPL", "buy", 10.0, 100.0, 0.0)
        record_transaction(1, "AAPL", "sell", 5.0, 120.0, 0.0)  # realized = $100

        result = compute_pnl(1, lambda sym: {"price": 125.0, "prev_close": 120.0})
        totals = result["totals"]
        assert totals["realized_pnl"] == pytest.approx(100.0)
