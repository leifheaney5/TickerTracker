import { describe, it, expect } from 'vitest'
import { VIEW_TO_PATH, PATH_TO_VIEW, pathForView, viewForPath, tickerForPath } from './routes'

describe('routes', () => {
  it('VIEW_TO_PATH and PATH_TO_VIEW are inverse for every view', () => {
    for (const [view, path] of Object.entries(VIEW_TO_PATH)) {
      expect(PATH_TO_VIEW[path]).toBe(view)
      expect(pathForView(view)).toBe(path)
      expect(viewForPath(path)).toBe(view)
    }
  })

  it('pathForView falls back to /dashboard for unknown views', () => {
    expect(pathForView('nonsense')).toBe('/dashboard')
  })

  it('viewForPath returns null for non-view paths', () => {
    expect(viewForPath('/')).toBeNull()
    expect(viewForPath('/ticker/NVDA')).toBeNull()
    expect(viewForPath('/nope')).toBeNull()
  })

  it('tickerForPath parses and validates /ticker/:sym', () => {
    expect(tickerForPath('/ticker/NVDA')).toBe('NVDA')
    expect(tickerForPath('/ticker/aapl')).toBe('AAPL') // uppercased
    expect(tickerForPath('/ticker/BRK.B')).toBe('BRK.B')
    expect(tickerForPath('/ticker/')).toBeNull()
    expect(tickerForPath('/dashboard')).toBeNull()
    expect(tickerForPath('/ticker/<script>')).toBeNull() // rejects bad chars
  })
})
