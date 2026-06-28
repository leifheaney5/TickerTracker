import { describe, it, expect, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { Logo } from './Logo'
import { useStore } from '../state/store'

describe('Logo', () => {
  beforeEach(() => {
    useStore.setState({ logos: {} })
  })

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

  it('prefers the Finnhub brand logo from the store over the favicon', () => {
    useStore.setState({ logos: { NVDA: 'https://static.finnhub.io/logo/NVDA.png' } })
    const { container } = render(<Logo symbol="NVDA" />)
    const img = container.querySelector('img')
    expect(img!.getAttribute('src')).toBe('https://static.finnhub.io/logo/NVDA.png')
  })

  it('falls back to the Google favicon if the Finnhub logo fails to load', () => {
    useStore.setState({ logos: { NVDA: 'https://static.finnhub.io/logo/NVDA.png' } })
    const { container } = render(<Logo symbol="NVDA" />)
    const img = container.querySelector('img')!
    fireEvent.error(img)
    const after = container.querySelector('img')!
    expect(after.getAttribute('src')).toContain('google.com/s2/favicons')
    expect(after.getAttribute('src')).toContain('nvidia.com')
  })

  it('falls back to the monogram if all image sources fail', () => {
    useStore.setState({ logos: { ZQXW: 'https://static.finnhub.io/logo/ZQXW.png' } })
    const { container } = render(<Logo symbol="ZQXW" />)
    // ZQXW has a Finnhub logo but no domain → only one candidate
    fireEvent.error(container.querySelector('img')!)
    expect(container.querySelector('img')).toBeNull()
    expect(container.textContent).toContain('ZQ')
  })
})
