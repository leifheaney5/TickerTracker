import { describe, it, expect } from 'vitest'
import { aggregateAllocation } from './allocation'

// Minimal row shape needed by the helper
type Row = { symbol: string; value: number }

const SECTOR_LOOKUP: Record<string, string> = {
  AAPL: 'Consumer Tech',
  MSFT: 'Software',
  NVDA: 'Semiconductors',
  COIN: 'Crypto',
}

describe('aggregateAllocation', () => {
  const rows: Row[] = [
    { symbol: 'AAPL', value: 200 },
    { symbol: 'MSFT', value: 300 },
    { symbol: 'NVDA', value: 100 },
    { symbol: 'COIN', value: 50 },
  ]

  it('Position mode returns one entry per symbol with its own value', () => {
    const result = aggregateAllocation(rows, 'Position', SECTOR_LOOKUP, new Set())
    expect(result).toHaveLength(4)
    expect(result.find((r) => r.label === 'AAPL')?.value).toBe(200)
    expect(result.find((r) => r.label === 'MSFT')?.value).toBe(300)
  })

  it('Sector mode sums values by sector', () => {
    const result = aggregateAllocation(rows, 'Sector', SECTOR_LOOKUP, new Set())
    expect(result.find((r) => r.label === 'Software')?.value).toBe(300)
    expect(result.find((r) => r.label === 'Consumer Tech')?.value).toBe(200)
    expect(result.find((r) => r.label === 'Semiconductors')?.value).toBe(100)
  })

  it('Sector mode groups unknown symbols as Other', () => {
    const rowsWithUnknown: Row[] = [...rows, { symbol: 'UNKNOWN', value: 77 }]
    const result = aggregateAllocation(rowsWithUnknown, 'Sector', SECTOR_LOOKUP, new Set())
    expect(result.find((r) => r.label === 'Other')?.value).toBe(77)
  })

  it('Asset Class mode sums Crypto vs Stocks', () => {
    const cryptoSyms = new Set(['COIN'])
    const result = aggregateAllocation(rows, 'Asset Class', SECTOR_LOOKUP, cryptoSyms)
    expect(result.find((r) => r.label === 'Crypto')?.value).toBe(50)
    expect(result.find((r) => r.label === 'Stocks')?.value).toBe(600)
  })

  it('returns empty array for empty rows', () => {
    const result = aggregateAllocation([], 'Position', SECTOR_LOOKUP, new Set())
    expect(result).toHaveLength(0)
  })

  it('results are sorted by value descending', () => {
    const result = aggregateAllocation(rows, 'Position', SECTOR_LOOKUP, new Set())
    const vals = result.map((r) => r.value)
    expect(vals).toEqual([...vals].sort((a, b) => b - a))
  })
})
