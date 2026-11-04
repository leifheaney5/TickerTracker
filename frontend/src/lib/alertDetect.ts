// Alert crossing detector — pure function, no side effects.
// Used by pollQuotes to identify first-transition alert fires (no spam).

import type { WatchlistItem, Quote } from '../api/types'

export interface AlertHit {
  symbol: string
  dir: 'above' | 'below'
  price: number
  alertPrice: number
}

export interface CrossingResult {
  /** Alerts that just crossed for the first time (not in prevHit). */
  newHits: AlertHit[]
  /** Updated set for next poll cycle: currently-crossed alerts. */
  nextHitSet: Set<string>
}

/**
 * Detect alert threshold crossings.
 *
 * @param prevHit  Set of symbol keys that were already in a "hit" state last poll.
 * @param items    Watchlist items with alert configs.
 * @param quotes   Current live quotes keyed by symbol.
 * @returns        newHits (first-transition only) + nextHitSet (for persisting).
 */
export function detectAlertCrossings(
  prevHit: Set<string>,
  items: WatchlistItem[],
  quotes: Record<string, Quote>,
): CrossingResult {
  const newHits: AlertHit[] = []
  const nextHitSet = new Set<string>()

  for (const item of items) {
    if (!item.alert_active || item.alert_price <= 0) continue
    const quote = quotes[item.symbol]
    if (!quote) continue

    const cur = quote.price
    const crossed =
      item.alert_dir === 'above' ? cur >= item.alert_price : cur <= item.alert_price

    if (crossed) {
      nextHitSet.add(item.symbol)
      // Only fire on the transition (was not hit last poll).
      if (!prevHit.has(item.symbol)) {
        newHits.push({
          symbol: item.symbol,
          dir: item.alert_dir,
          price: cur,
          alertPrice: item.alert_price,
        })
      }
    }
    // If not crossed, symbol is simply omitted from nextHitSet — auto-resets.
  }

  return { newHits, nextHitSet }
}
