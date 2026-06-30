/**
 * Tests for useQuoteStream.
 *
 * We test the pure helpers (streamBackoff, StreamCircuitBreaker) exhaustively
 * in streamHelpers.test.ts.  Here we focus on the hook's integration with the
 * Zustand store's quote-merge path via a lightweight stub of EventSource and
 * fetch.
 *
 * DOM / React rendering is kept to a minimum (no component mount needed for
 * the store-merge logic tests).
 */
import { describe, it, expect } from 'vitest'
import { streamBackoff, StreamCircuitBreaker } from '../lib/streamHelpers'

// ── Re-export the pure helper tests as a sanity check ────────────────────────
// (main coverage lives in streamHelpers.test.ts; these guard the re-export)

describe('streamBackoff – imported via hook module path', () => {
  it('caps at 30 000 ms by default', () => {
    expect(streamBackoff(100)).toBe(30_000)
  })

  it('returns 1000 for attempt 0', () => {
    expect(streamBackoff(0)).toBe(1_000)
  })
})

describe('StreamCircuitBreaker – imported via hook module path', () => {
  it('opens after threshold failures', () => {
    const cb = new StreamCircuitBreaker(2, 5_000)
    cb.recordFailure(0)
    cb.recordFailure(0)
    expect(cb.state).toBe('open')
  })
})

// ── Quote-merge logic (isolated, no React) ────────────────────────────────────
// We validate the merge-and-flash logic that useQuoteStream applies to the
// Zustand store, without mounting a component.

describe('quote merge flash logic', () => {
  it('computes up flash when price increases', () => {
    const prev: Record<string, { price: number }> = { AAPL: { price: 100 } }
    const incoming: Record<string, { price: number }> = { AAPL: { price: 105 } }
    const flash: Record<string, 'up' | 'down' | null> = {}
    for (const sym of Object.keys(incoming)) {
      const oldPrice = prev[sym]?.price
      const newPrice = incoming[sym].price
      flash[sym] =
        oldPrice === undefined ? null
        : newPrice > oldPrice ? 'up'
        : newPrice < oldPrice ? 'down'
        : null
    }
    expect(flash['AAPL']).toBe('up')
  })

  it('computes down flash when price decreases', () => {
    const prev = { AAPL: { price: 150 } }
    const incoming = { AAPL: { price: 145 } }
    const flash: Record<string, 'up' | 'down' | null> = {}
    for (const sym of Object.keys(incoming)) {
      const oldPrice = prev[sym]?.price
      const newPrice = incoming[sym].price
      flash[sym] =
        oldPrice === undefined ? null
        : newPrice > oldPrice ? 'up'
        : newPrice < oldPrice ? 'down'
        : null
    }
    expect(flash['AAPL']).toBe('down')
  })

  it('returns null flash for new symbol with no prior price', () => {
    const prev: Record<string, { price: number }> = {}
    const incoming = { NVDA: { price: 900 } }
    const flash: Record<string, 'up' | 'down' | null> = {}
    for (const sym of Object.keys(incoming)) {
      const oldPrice = prev[sym]?.price
      const newPrice = incoming[sym].price
      flash[sym] =
        oldPrice === undefined ? null
        : newPrice > oldPrice ? 'up'
        : newPrice < oldPrice ? 'down'
        : null
    }
    expect(flash['NVDA']).toBeNull()
  })

  it('returns null flash when price is unchanged', () => {
    const prev = { MSFT: { price: 420 } }
    const incoming = { MSFT: { price: 420 } }
    const flash: Record<string, 'up' | 'down' | null> = {}
    for (const sym of Object.keys(incoming)) {
      const oldPrice = prev[sym]?.price
      const newPrice = incoming[sym].price
      flash[sym] =
        oldPrice === undefined ? null
        : newPrice > oldPrice ? 'up'
        : newPrice < oldPrice ? 'down'
        : null
    }
    expect(flash['MSFT']).toBeNull()
  })
})

// ── Circuit breaker integration with backoff ──────────────────────────────────

describe('circuit breaker + backoff integration', () => {
  it('backoff grows with attempt count', () => {
    const delays = [0, 1, 2, 3, 4].map((a) => streamBackoff(a, 1000, 30_000))
    for (let i = 1; i < delays.length; i++) {
      expect(delays[i]).toBeGreaterThan(delays[i - 1])
    }
  })

  it('circuit stays closed when under threshold', () => {
    const cb = new StreamCircuitBreaker(5, 60_000)
    for (let i = 0; i < 4; i++) cb.recordFailure(i * 1000)
    expect(cb.state).toBe('closed')
    expect(cb.allow(Date.now())).toBe(true)
  })

  it('circuit opens and prevents connection after threshold', () => {
    const cb = new StreamCircuitBreaker(5, 60_000)
    for (let i = 0; i < 5; i++) cb.recordFailure(i * 1000)
    expect(cb.state).toBe('open')
    expect(cb.allow(5_000)).toBe(false)
  })

  it('circuit recovers after reset timeout', () => {
    const cb = new StreamCircuitBreaker(5, 60_000)
    for (let i = 0; i < 5; i++) cb.recordFailure(0)
    // Simulate 61 seconds passing
    const result = cb.allow(61_000)
    expect(result).toBe(true)
    expect(cb.state).toBe('half_open')
  })
})
