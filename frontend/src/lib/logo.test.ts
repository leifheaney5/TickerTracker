import { describe, it, expect } from 'vitest'
import { resolveLogoDomain } from './logo'

describe('resolveLogoDomain', () => {
  it('returns the mapped domain for a known symbol', () => {
    expect(resolveLogoDomain('NVDA')).toBe('nvidia.com')
    // KO/WMT used to guess ko.com/wmt.com; now curated to real domains.
    expect(resolveLogoDomain('KO')).toBe('coca-cola.com')
    expect(resolveLogoDomain('WMT')).toBe('walmart.com')
  })

  it('returns null for an unknown symbol with no override (never guesses <symbol>.com)', () => {
    expect(resolveLogoDomain('ZQXW')).toBeNull()
  })

  it('uses an override website over the map, normalizing scheme/www/path', () => {
    expect(resolveLogoDomain('ZQXW', 'https://www.example.com/us/en')).toBe('example.com')
    expect(resolveLogoDomain('ZQXW', 'http://corporate.example.com/')).toBe('corporate.example.com')
  })

  it('accepts an already-bare override domain', () => {
    expect(resolveLogoDomain('ZQXW', 'example.com')).toBe('example.com')
  })

  it('ignores an empty/whitespace override and falls back to the map', () => {
    expect(resolveLogoDomain('NVDA', '')).toBe('nvidia.com')
    expect(resolveLogoDomain('NVDA', '   ')).toBe('nvidia.com')
  })

  it('ignores an empty override for an unknown symbol (still null)', () => {
    expect(resolveLogoDomain('ZQXW', '')).toBeNull()
  })
})
