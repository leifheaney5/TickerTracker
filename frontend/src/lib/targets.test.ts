import { describe, expect, it } from 'vitest'
import { compareTargetDistance, targetDistancePct, targetReached } from './targets'

describe('targetDistancePct', () => {
  it('calculates literal buy and sell distances from the current price', () => {
    expect(targetDistancePct(200, 180, 'buy')).toBe(10)
    expect(targetDistancePct(200, 250, 'sell')).toBe(25)
  })

  it('clamps the distance to zero once a target is reached', () => {
    expect(targetDistancePct(175, 180, 'buy')).toBe(0)
    expect(targetDistancePct(250, 240, 'sell')).toBe(0)
  })

  it.each([
    [0, 100],
    [100, 0],
    [-1, 100],
    [100, -1],
    [Number.NaN, 100],
    [100, Number.POSITIVE_INFINITY],
    [null, 100],
    [100, undefined],
  ])('returns unknown for invalid inputs (%s, %s)', (price, target) => {
    expect(targetDistancePct(price, target, 'buy')).toBeNull()
  })
})

describe('targetReached', () => {
  it('uses at-or-below for buy targets and at-or-above for sell targets', () => {
    expect(targetReached(185, 185, 'buy')).toBe(true)
    expect(targetReached(184, 185, 'buy')).toBe(true)
    expect(targetReached(186, 185, 'buy')).toBe(false)
    expect(targetReached(240, 240, 'sell')).toBe(true)
    expect(targetReached(241, 240, 'sell')).toBe(true)
    expect(targetReached(239, 240, 'sell')).toBe(false)
  })

  it('does not report a reached state for invalid inputs', () => {
    expect(targetReached(0, 185, 'buy')).toBe(false)
    expect(targetReached(185, 0, 'sell')).toBe(false)
    expect(targetReached(Number.NaN, 185, 'buy')).toBe(false)
  })
})

describe('compareTargetDistance', () => {
  const quotes = {
    REACHED_LATE: { price: 175 },
    REACHED_EARLY: { price: 170 },
    CLOSE: { price: 200 },
    FAR: { price: 200 },
    NO_TARGET: { price: 200 },
  }
  const rows = [
    { symbol: 'NO_QUOTE', position: 0, buy_target: 190, sell_target: 260 },
    { symbol: 'FAR', position: 1, buy_target: 160, sell_target: 280 },
    { symbol: 'REACHED_LATE', position: 4, buy_target: 180, sell_target: 170 },
    { symbol: 'NO_TARGET', position: 2, buy_target: 0, sell_target: 0 },
    { symbol: 'CLOSE', position: 3, buy_target: 190, sell_target: 220 },
    { symbol: 'REACHED_EARLY', position: 2, buy_target: 180, sell_target: 160 },
  ]

  it('puts reached buy targets first, then ascending distance, then missing data', () => {
    expect(rows.slice().sort((a, b) => compareTargetDistance(a, b, quotes, 'buy')).map((r) => r.symbol)).toEqual([
      'REACHED_EARLY',
      'REACHED_LATE',
      'CLOSE',
      'FAR',
      'NO_QUOTE',
      'NO_TARGET',
    ])
  })

  it('uses stable manual position for equal distance and missing-data ties', () => {
    const tied = [
      { symbol: 'B', position: 5, buy_target: 90, sell_target: 110 },
      { symbol: 'A', position: 1, buy_target: 90, sell_target: 110 },
      { symbol: 'MISSING_B', position: 8, buy_target: 0, sell_target: 0 },
      { symbol: 'MISSING_A', position: 3, buy_target: 0, sell_target: 0 },
    ]
    const tiedQuotes = { A: { price: 100 }, B: { price: 100 }, MISSING_A: { price: 100 }, MISSING_B: { price: 100 } }
    expect(tied.slice().sort((a, b) => compareTargetDistance(a, b, tiedQuotes, 'sell')).map((r) => r.symbol)).toEqual([
      'A', 'B', 'MISSING_A', 'MISSING_B',
    ])
  })
})
