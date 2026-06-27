import { describe, it, expect } from 'vitest'
import { THEMES, rootCssVars } from './tokens'

describe('theme tokens', () => {
  it('exposes dark and light themes with the same keys', () => {
    expect(Object.keys(THEMES.dark).sort()).toEqual(Object.keys(THEMES.light).sort())
  })

  it('rootCssVars emits different bg per theme', () => {
    const dark = rootCssVars(undefined, 'balanced', 'dark') as Record<string, string>
    const light = rootCssVars(undefined, 'balanced', 'light') as Record<string, string>
    expect(dark['--bg']).not.toEqual(light['--bg'])
  })
})
