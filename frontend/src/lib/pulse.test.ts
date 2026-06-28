import { describe, it, expect } from 'vitest'
import { pulseBand, pulseColor, pulseArc, type PulseBand } from './pulse'

describe('pulseBand (quartile bands, matches backend + brand dial)', () => {
  it('maps scores to bands at quartile boundaries', () => {
    expect(pulseBand(0)).toBe('Cooling')
    expect(pulseBand(24.9)).toBe('Cooling')
    expect(pulseBand(25)).toBe('Neutral')
    expect(pulseBand(49.9)).toBe('Neutral')
    expect(pulseBand(50)).toBe('Building')
    expect(pulseBand(74.9)).toBe('Building')
    expect(pulseBand(75)).toBe('Hot')
    expect(pulseBand(100)).toBe('Hot')
  })
})

describe('pulseColor (brand token ramp, no red — never reads as "sell")', () => {
  const bands: PulseBand[] = ['Cooling', 'Neutral', 'Building', 'Hot']
  it('returns a token-based color for every band', () => {
    for (const b of bands) {
      const c = pulseColor(b)
      expect(typeof c).toBe('string')
      expect(c.length).toBeGreaterThan(0)
    }
  })
  it('uses the warm/up tokens for Building/Hot and never --down', () => {
    expect(pulseColor('Building')).toContain('--warn')
    expect(pulseColor('Hot')).toContain('--up')
    for (const b of bands) expect(pulseColor(b)).not.toContain('--down')
  })
})

describe('pulseArc (0..100 -> sweep fraction of a 270° gauge)', () => {
  it('0 score sweeps nothing, 100 sweeps the full arc', () => {
    expect(pulseArc(0)).toBeCloseTo(0, 5)
    expect(pulseArc(100)).toBeCloseTo(1, 5)
  })
  it('is monotonic and clamps out-of-range input', () => {
    expect(pulseArc(50)).toBeCloseTo(0.5, 5)
    expect(pulseArc(-10)).toBe(0)
    expect(pulseArc(150)).toBe(1)
  })
})
