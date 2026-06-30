"""Portfolio P&L engine — average-cost accounting + per-position analytics.

Design decisions
----------------
* **Running Holding row** (not replay): Each transaction atomically updates the
  Holding row in the same DB transaction, so reads of /api/holdings are O(1) per
  position. Realized P&L and fees are accumulated on the Holding row as well,
  so compute_pnl doesn't need to replay the ledger.

* **prev_close-based daily P&L**: daily_pnl = (price - prev_close) * shares.
  The `pc` field from Finnhub's /quote response is already surfaced by
  `providers/finnhub.py` and passed through `services/quotes.py`, so
  quote_fn("SYM") is expected to return a dict with at least {"price", "prev_close"}.
  If prev_close is absent/None/0, daily_pnl is 0 (no fallback to day_%).

* **Oversell guard**: sell qty > current shares raises ValueError("oversell ...").
  The caller (route handler) should return 400.
"""

import datetime as _dt
import db
import models


# ── Pure accounting helpers (no I/O; unit-tested independently) ──────────────

def apply_buy(shares: float, avg_cost: float, qty: float, price: float,
              fees: float) -> tuple[float, float]:
    """Compute new (shares, avg_cost) after a buy, using the average-cost method.

    Fees are included in the cost basis:
        new_avg = (old_shares * old_avg + qty * price + fees) / new_shares
    """
    new_shares = shares + qty
    if new_shares == 0:
        return 0.0, 0.0
    new_avg = (shares * avg_cost + qty * price + fees) / new_shares
    return new_shares, new_avg


def apply_sell(shares: float, avg_cost: float, qty: float, price: float,
               fees: float) -> tuple[float, float]:
    """Compute new (shares, realized_pnl) after a sell.

    Average-cost method: avg_cost is unchanged by a sell; only shares decrease.
    Realized P&L for this sell = qty * (sell_price - avg_cost) - fees.

    Raises ValueError if qty > shares (oversell).
    """
    if qty > shares + 1e-9:  # tolerance for floating-point imprecision
        raise ValueError(
            f"oversell: attempted to sell {qty} but only {shares} held"
        )
    new_shares = max(0.0, shares - qty)
    realized = qty * (price - avg_cost) - fees
    return new_shares, realized


def position_pnl(shares: float, avg_cost: float, price: float,
                 prev_close: float | None, realized: float,
                 fees: float) -> dict:
    """Compute all P&L fields for a single position. Pure — no DB or I/O.

    Returns a dict with:
        cost_basis, market_value, unrealized, unrealized_pct,
        prev_close, daily_pnl, realized_pnl, fees_paid
    """
    cost_basis = shares * avg_cost
    market_value = shares * price
    unrealized = market_value - cost_basis
    unrealized_pct = (unrealized / cost_basis * 100.0) if cost_basis else 0.0

    # daily P&L uses the real previous close from the quote provider.
    # Falls back to 0 when prev_close is absent or zero to avoid fabricating data.
    pc = prev_close if (prev_close and prev_close > 0) else None
    daily_pnl = (price - pc) * shares if pc is not None else 0.0

    return {
        "shares": shares,
        "avg_cost": avg_cost,
        "price": price,
        "cost_basis": cost_basis,
        "market_value": market_value,
        "unrealized": unrealized,
        "unrealized_pct": unrealized_pct,
        "prev_close": prev_close,
        "daily_pnl": daily_pnl,
        "realized_pnl": realized,
        "fees_paid": fees,
    }


# ── Transactional ledger operations ─────────────────────────────────────────

def record_transaction(user_id: int, symbol: str, kind: str, quantity: float,
                       price: float, fees: float = 0.0,
                       executed_at: _dt.datetime | None = None,
                       note: str | None = None) -> dict:
    """Append a Transaction and update the Holding atomically.

    Returns {"holding": <holding dict>, "realized": <float>} where `realized`
    is the P&L realised by THIS transaction (0 for buys).

    Raises ValueError on oversell.
    """
    symbol = symbol.upper()
    if kind not in ("buy", "sell"):
        raise ValueError(f"kind must be 'buy' or 'sell', got {kind!r}")

    fees = float(fees or 0.0)
    realized_this = 0.0

    with db.get_session() as s:
        h = s.query(models.Holding).filter_by(user_id=user_id, symbol=symbol).first()
        if h is None:
            h = models.Holding(
                user_id=user_id, symbol=symbol,
                shares=0.0, avg_cost=0.0,
                realized_pnl=0.0, fees_paid=0.0,
            )
            s.add(h)
            s.flush()

        cur_shares = h.shares or 0.0
        cur_avg = h.avg_cost or 0.0
        cur_realized = h.realized_pnl or 0.0
        cur_fees = h.fees_paid or 0.0

        if kind == "buy":
            new_shares, new_avg = apply_buy(cur_shares, cur_avg, quantity, price, fees)
            h.shares = new_shares
            h.avg_cost = new_avg
            # Fees are folded into avg_cost on buys; also accumulate in fees_paid
            # so total_fees_paid = buy_fees + sell_fees across the position's life.
            h.fees_paid = cur_fees + fees
        else:
            new_shares, realized_this = apply_sell(cur_shares, cur_avg, quantity, price, fees)
            h.shares = new_shares
            # avg_cost unchanged on sells (average-cost method)
            h.realized_pnl = cur_realized + realized_this
            h.fees_paid = cur_fees + fees

        txn = models.Transaction(
            user_id=user_id,
            symbol=symbol,
            kind=kind,
            quantity=quantity,
            price=price,
            fees=fees,
            executed_at=executed_at or _dt.datetime.now(_dt.timezone.utc),
            note=note,
        )
        s.add(txn)
        s.commit()

        holding_dict = {
            "symbol": h.symbol,
            "shares": h.shares,
            "avg_cost": h.avg_cost,
            "realized_pnl": h.realized_pnl,
            "fees_paid": h.fees_paid,
        }

    return {"holding": holding_dict, "realized": realized_this}


def list_transactions(user_id: int, symbol: str | None = None) -> list[dict]:
    """Return all transactions for a user, optionally filtered by symbol.
    Ordered newest-first.
    """
    with db.get_session() as s:
        q = s.query(models.Transaction).filter_by(user_id=user_id)
        if symbol:
            q = q.filter_by(symbol=symbol.upper())
        txns = q.order_by(models.Transaction.executed_at.desc()).all()
        return [
            {
                "id": t.id,
                "symbol": t.symbol,
                "kind": t.kind,
                "quantity": t.quantity,
                "price": t.price,
                "fees": t.fees or 0.0,
                "executed_at": t.executed_at.isoformat() if t.executed_at else None,
                "note": t.note,
            }
            for t in txns
        ]


# ── P&L engine ───────────────────────────────────────────────────────────────

def compute_pnl(user_id: int, quote_fn) -> dict:
    """Compute full portfolio P&L for a user.

    `quote_fn(symbol)` must return a dict with at least {"price", "prev_close"}.
    It is called once per holding; callers should pass a cached wrapper.

    Returns:
        {
          "positions": [{ symbol, shares, avg_cost, cost_basis, price,
                          market_value, unrealized, unrealized_pct,
                          prev_close, daily_pnl, realized_pnl, fees_paid }],
          "totals":    { market_value, cost_basis, unrealized, unrealized_pct,
                         daily_pnl, realized_pnl, fees_paid }
        }
    """
    with db.get_session() as s:
        holdings = s.query(models.Holding).filter_by(user_id=user_id).all()
        rows = [
            {
                "symbol": h.symbol,
                "shares": h.shares or 0.0,
                "avg_cost": h.avg_cost or 0.0,
                "realized_pnl": h.realized_pnl or 0.0,
                "fees_paid": h.fees_paid or 0.0,
            }
            for h in holdings
        ]

    positions = []
    for row in rows:
        sym = row["symbol"]
        try:
            q = quote_fn(sym) or {}
            price = float(q.get("price") or 0.0)
            prev_close = q.get("prev_close")
            if prev_close is not None:
                prev_close = float(prev_close)
        except Exception:
            price = 0.0
            prev_close = None

        pnl = position_pnl(
            row["shares"], row["avg_cost"], price, prev_close,
            row["realized_pnl"], row["fees_paid"],
        )
        pnl["symbol"] = sym
        positions.append(pnl)

    # Portfolio totals
    total_mv = sum(p["market_value"] for p in positions)
    total_cost = sum(p["cost_basis"] for p in positions)
    total_unreal = total_mv - total_cost
    total_unreal_pct = (total_unreal / total_cost * 100.0) if total_cost else 0.0
    total_daily = sum(p["daily_pnl"] for p in positions)
    total_realized = sum(p["realized_pnl"] for p in positions)
    total_fees = sum(p["fees_paid"] for p in positions)

    return {
        "positions": positions,
        "totals": {
            "market_value": total_mv,
            "cost_basis": total_cost,
            "unrealized": total_unreal,
            "unrealized_pct": total_unreal_pct,
            "daily_pnl": total_daily,
            "realized_pnl": total_realized,
            "fees_paid": total_fees,
        },
    }
