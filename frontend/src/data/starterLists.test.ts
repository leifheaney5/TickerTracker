import { describe, it, expect } from 'vitest'
import { STARTER_LISTS } from './starterLists'

describe('STARTER_LISTS', () => {
  it('has the expected four lists', () => {
    const ids = STARTER_LISTS.map((l) => l.id)
    expect(ids).toContain('bigtech')
    expect(ids).toContain('ai')
    expect(ids).toContain('crypto')
    expect(ids).toContain('dividend')
    expect(STARTER_LISTS).toHaveLength(4)
  })

  it('every list has a non-empty label and at least one symbol', () => {
    for (const list of STARTER_LISTS) {
      expect(typeof list.id).toBe('string')
      expect(list.id.length).toBeGreaterThan(0)
      expect(typeof list.label).toBe('string')
      expect(list.label.length).toBeGreaterThan(0)
      expect(Array.isArray(list.symbols)).toBe(true)
      expect(list.symbols.length).toBeGreaterThan(0)
    }
  })

  it('all symbols match the backend valid_symbol pattern ^[A-Z0-9.-]{1,12}$', () => {
    const re = /^[A-Z0-9.\-]{1,12}$/
    for (const list of STARTER_LISTS) {
      for (const sym of list.symbols) {
        expect(re.test(sym), `${list.id}: symbol "${sym}" fails valid_symbol`).toBe(true)
      }
    }
  })
})
