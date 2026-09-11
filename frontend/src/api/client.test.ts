import { describe, expect, it } from 'vitest'
import { normalizeWatchlistItem } from './client'

describe('normalizeWatchlistItem', () => {
  it('maps a legacy target to sell_target without inventing a buy target', () => {
    expect(normalizeWatchlistItem({ symbol: 'AAPL', position: 2, target: 240 })).toMatchObject({
      symbol: 'AAPL',
      position: 2,
      buy_target: 0,
      sell_target: 240,
      target: 240,
    })
  })

  it('prefers explicit sell_target over the legacy alias', () => {
    expect(normalizeWatchlistItem({ symbol: 'AAPL', sell_target: 250, target: 240 }).sell_target).toBe(250)
  })
})
