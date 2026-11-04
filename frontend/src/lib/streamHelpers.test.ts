import { describe, it, expect } from 'vitest'
import { streamBackoff, StreamCircuitBreaker } from './streamHelpers'

// ── streamBackoff ─────────────────────────────────────────────────────────────

describe('streamBackoff', () => {
  it('returns base on attempt 0', () => {
    expect(streamBackoff(0, 1000, 30_000)).toBe(1_000)
  })

  it('doubles on each attempt', () => {
    expect(streamBackoff(1, 1000, 30_000)).toBe(2_000)
    expect(streamBackoff(2, 1000, 30_000)).toBe(4_000)
    expect(streamBackoff(3, 1000, 30_000)).toBe(8_000)
  })

  it('caps at cap value', () => {
    expect(streamBackoff(100, 1000, 30_000)).toBe(30_000)
  })

  it('caps at exactly cap when base * 2^n > cap', () => {
    // 1000 * 2^5 = 32000 > 30000
    expect(streamBackoff(5, 1000, 30_000)).toBe(30_000)
  })

  it('returns base value when cap < base', () => {
    expect(streamBackoff(0, 5000, 2000)).toBe(2_000)
  })

  it('uses default parameters', () => {
    const v = streamBackoff(0)
    expect(v).toBe(1_000)
  })

  it('is monotonically non-decreasing (before cap)', () => {
    const values = [0, 1, 2, 3, 4].map((a) => streamBackoff(a, 100, Infinity))
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThanOrEqual(values[i - 1])
    }
  })
})

// ── StreamCircuitBreaker ──────────────────────────────────────────────────────

describe('StreamCircuitBreaker — initial state', () => {
  it('starts closed', () => {
    const cb = new StreamCircuitBreaker(3, 10_000)
    expect(cb.state).toBe('closed')
  })

  it('allows connection when closed', () => {
    const cb = new StreamCircuitBreaker(3, 10_000)
    expect(cb.allow(0)).toBe(true)
  })
})

describe('StreamCircuitBreaker — tripping', () => {
  it('stays closed below threshold', () => {
    const cb = new StreamCircuitBreaker(3, 10_000)
    cb.recordFailure(0)
    cb.recordFailure(0)
    expect(cb.state).toBe('closed')
  })

  it('opens after failThreshold failures', () => {
    const cb = new StreamCircuitBreaker(3, 10_000)
    cb.recordFailure(0)
    cb.recordFailure(0)
    cb.recordFailure(0)
    expect(cb.state).toBe('open')
  })

  it('blocks allow when open', () => {
    const cb = new StreamCircuitBreaker(3, 10_000)
    cb.recordFailure(0)
    cb.recordFailure(0)
    cb.recordFailure(0)
    expect(cb.allow(5_000)).toBe(false)
  })

  it('trips on a threshold of 1', () => {
    const cb = new StreamCircuitBreaker(1, 10_000)
    cb.recordFailure(0)
    expect(cb.state).toBe('open')
  })
})

describe('StreamCircuitBreaker — half_open transition', () => {
  it('transitions to half_open after resetTimeout ms', () => {
    const cb = new StreamCircuitBreaker(3, 10_000)
    cb.recordFailure(0)
    cb.recordFailure(0)
    cb.recordFailure(0)
    cb.allow(10_000)
    expect(cb.state).toBe('half_open')
  })

  it('allows one trial when half_open', () => {
    const cb = new StreamCircuitBreaker(3, 10_000)
    cb.recordFailure(0)
    cb.recordFailure(0)
    cb.recordFailure(0)
    expect(cb.allow(10_000)).toBe(true)
  })

  it('closes on success after half_open trial', () => {
    const cb = new StreamCircuitBreaker(3, 10_000)
    cb.recordFailure(0)
    cb.recordFailure(0)
    cb.recordFailure(0)
    cb.allow(10_000)
    cb.recordSuccess()
    expect(cb.state).toBe('closed')
  })

  it('re-opens on failure during half_open', () => {
    const cb = new StreamCircuitBreaker(3, 10_000)
    cb.recordFailure(0)
    cb.recordFailure(0)
    cb.recordFailure(0)
    cb.allow(10_000)
    cb.recordFailure(10_000)
    expect(cb.state).toBe('open')
  })

  it('stays open before resetTimeout elapses', () => {
    const cb = new StreamCircuitBreaker(3, 10_000)
    cb.recordFailure(0)
    cb.recordFailure(0)
    cb.recordFailure(0)
    expect(cb.allow(9_999)).toBe(false)
    expect(cb.state).toBe('open')
  })
})

describe('StreamCircuitBreaker — recordSuccess', () => {
  it('resets failure count so threshold must be hit again', () => {
    const cb = new StreamCircuitBreaker(3, 10_000)
    cb.recordFailure(0)
    cb.recordFailure(0)
    cb.recordSuccess()
    // Two more failures should still be below threshold
    cb.recordFailure(0)
    cb.recordFailure(0)
    expect(cb.state).toBe('closed')
  })

  it('recordSuccess on closed state stays closed', () => {
    const cb = new StreamCircuitBreaker(3, 10_000)
    cb.recordSuccess()
    expect(cb.state).toBe('closed')
  })
})
