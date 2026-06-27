import { describe, it, expect } from 'vitest'
import { viewForKey } from './useKeyboardShortcuts'

describe('viewForKey', () => {
  it('maps d → dashboard', () => {
    expect(viewForKey('d')).toBe('dashboard')
  })

  it('maps w → managewatch', () => {
    expect(viewForKey('w')).toBe('managewatch')
  })

  it('maps s → screener', () => {
    expect(viewForKey('s')).toBe('screener')
  })

  it('maps e → earnings', () => {
    expect(viewForKey('e')).toBe('earnings')
  })

  it('maps c → crypto', () => {
    expect(viewForKey('c')).toBe('crypto')
  })

  it('maps m → market', () => {
    expect(viewForKey('m')).toBe('market')
  })

  it('returns null for unmapped key', () => {
    expect(viewForKey('z')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(viewForKey('')).toBeNull()
  })
})
