import { describe, it, expect } from 'vitest'
import { dailyChangeDollar } from './dailyChg'

describe('dailyChangeDollar', () => {
  it('computes dollar change from price and change percent', () => {
    // $100 price, +5% → +$5 in the prior session (price/(1+pct/100)*pct/100 ≈ $4.76)
    // But simpler definition used: price * (changePct / 100)
    const result = dailyChangeDollar(100, 5)
    expect(result).toBeCloseTo(5, 5)
  })

  it('returns a negative value for a down move', () => {
    const result = dailyChangeDollar(200, -2.5)
    expect(result).toBeCloseTo(-5, 5)
  })

  it('returns 0 when price is 0', () => {
    expect(dailyChangeDollar(0, 10)).toBe(0)
  })

  it('returns 0 when pct is 0', () => {
    expect(dailyChangeDollar(150, 0)).toBe(0)
  })
})
