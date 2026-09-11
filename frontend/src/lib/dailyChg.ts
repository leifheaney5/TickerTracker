// Daily dollar-change helper.
// Computes the day's P&L in dollars for a single share given the current price
// and the backend's change_pct (which is already a percentage, e.g. 2.5 = 2.5%).

/**
 * Returns the estimated daily dollar change per share.
 * Formula: price × (changePct / 100)
 * This matches the pct-derived approach described in the spec.
 * If a prevClose is available, prefer: price − prevClose (caller's choice).
 */
export function dailyChangeDollar(price: number, changePct: number): number {
  return price * (changePct / 100)
}
