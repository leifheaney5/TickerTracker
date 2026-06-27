import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Logo } from './Logo'

describe('Logo', () => {
  it('renders a favicon img for a known universe symbol', () => {
    const { container } = render(<Logo symbol="NVDA" />)
    const img = container.querySelector('img')
    expect(img).not.toBeNull()
    // Higher-quality, broader-coverage favicon source than DuckDuckGo.
    expect(img!.getAttribute('src')).toContain('google.com/s2/favicons')
    expect(img!.getAttribute('src')).toContain('nvidia.com')
  })

  it('renders monogram only (no img) for an unknown symbol — never guesses <symbol>.com', () => {
    const { container } = render(<Logo symbol="ZQXW" />)
    expect(container.querySelector('img')).toBeNull()
    expect(container.textContent).toContain('ZQ')
  })

  it('uses the domain override (company website) for an otherwise-unknown symbol', () => {
    const { container } = render(<Logo symbol="ZQXW" domain="https://www.example.com" />)
    const img = container.querySelector('img')
    expect(img).not.toBeNull()
    expect(img!.getAttribute('src')).toContain('example.com')
  })

  it('still renders a crypto icon img for crypto kind', () => {
    const { container } = render(<Logo symbol="BTC" kind="crypto" />)
    expect(container.querySelector('img')).not.toBeNull()
  })
})
