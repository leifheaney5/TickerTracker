import { describe, it, expect } from 'vitest'
import { detectAlertCrossings } from './alertDetect'
import type { WatchlistItem } from '../api/types'
import type { Quote } from '../api/types'

function makeItem(sym: string, alertPrice: number, dir: 'above' | 'below'): WatchlistItem {
  return {
    symbol: sym,
    position: 0,
    target: 0,
    alert_price: alertPrice,
    alert_dir: dir,
    alert_active: true,
    kind: 'stock',
  }
}

function makeQuote(price: number): Quote {
  return { price, change_pct: 0, day_open: price, day_high: price, day_low: price, prev_close: price, volume: 0 }
}

describe('detectAlertCrossings', () => {
  it('detects a new "above" crossing', () => {
    const items = [makeItem('AAPL', 200, 'above')]
    const quotes: Record<string, Quote> = { AAPL: makeQuote(201) }
    const prevHit = new Set<string>()
    const result = detectAlertCrossings(prevHit, items, quotes)
    expect(result.newHits).toHaveLength(1)
    expect(result.newHits[0].symbol).toBe('AAPL')
  })

  it('detects a new "below" crossing', () => {
    const items = [makeItem('MSFT', 300, 'below')]
    const quotes: Record<string, Quote> = { MSFT: makeQuote(299) }
    const prevHit = new Set<string>()
    const result = detectAlertCrossings(prevHit, items, quotes)
    expect(result.newHits).toHaveLength(1)
    expect(result.newHits[0].symbol).toBe('MSFT')
  })

  it('does NOT re-fire if already in prevHit', () => {
    const items = [makeItem('AAPL', 200, 'above')]
    const quotes: Record<string, Quote> = { AAPL: makeQuote(205) }
    const prevHit = new Set<string>(['AAPL'])
    const result = detectAlertCrossings(prevHit, items, quotes)
    expect(result.newHits).toHaveLength(0)
  })

  it('does NOT fire when threshold is not crossed', () => {
    const items = [makeItem('AAPL', 200, 'above')]
    const quotes: Record<string, Quote> = { AAPL: makeQuote(199) }
    const prevHit = new Set<string>()
    const result = detectAlertCrossings(prevHit, items, quotes)
    expect(result.newHits).toHaveLength(0)
  })

  it('does NOT fire when alert_active is false', () => {
    const item = { ...makeItem('AAPL', 200, 'above'), alert_active: false }
    const quotes: Record<string, Quote> = { AAPL: makeQuote(201) }
    const result = detectAlertCrossings(new Set(), [item], quotes)
    expect(result.newHits).toHaveLength(0)
  })

  it('does NOT fire when no live quote for the symbol', () => {
    const items = [makeItem('AAPL', 200, 'above')]
    const result = detectAlertCrossings(new Set(), items, {})
    expect(result.newHits).toHaveLength(0)
  })

  it('returns an updated hitSet that includes new hits', () => {
    const items = [makeItem('AAPL', 200, 'above')]
    const quotes: Record<string, Quote> = { AAPL: makeQuote(201) }
    const result = detectAlertCrossings(new Set(), items, quotes)
    expect(result.nextHitSet.has('AAPL')).toBe(true)
  })

  it('clears a symbol from hitSet when it no longer crosses', () => {
    // AAPL was previously hit (above 200) but now drops back below
    const items = [makeItem('AAPL', 200, 'above')]
    const quotes: Record<string, Quote> = { AAPL: makeQuote(195) }
    const prevHit = new Set<string>(['AAPL'])
    const result = detectAlertCrossings(prevHit, items, quotes)
    expect(result.nextHitSet.has('AAPL')).toBe(false)
  })
})
