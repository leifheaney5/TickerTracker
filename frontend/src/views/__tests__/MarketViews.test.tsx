import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { MarketViews } from '../MarketViews'
import { useStore } from '../../state/store'
import { api } from '../../api/client'

beforeEach(() => {
  vi.restoreAllMocks()
  // Avoid network from the Fear & Greed effect.
  vi.spyOn(api, 'fng').mockResolvedValue({ value: 50, label: 'Neutral', fetchedAt: '' } as never)
  // Stub data loaders so the map view mounts without hitting the network.
  useStore.setState({ crypto: null, loadFng: async () => {}, loadCrypto: async () => {} })
})

describe('MarketViews · map', () => {
  it('filters tiles to a sector when its chip is selected', () => {
    const { getByText, queryByText } = render(<MarketViews sub="map" />)
    expect(getByText('AAPL')).toBeTruthy()       // tech ticker present in All
    expect(getByText('XOM')).toBeTruthy()        // energy ticker present in All
    fireEvent.click(getByText('Technology'))
    expect(getByText('AAPL')).toBeTruthy()        // tech ticker still present
    expect(queryByText('XOM')).toBeNull()         // energy ticker filtered out
  })

  it('clicking a stock tile selects that symbol', () => {
    const setSelected = vi.fn()
    useStore.setState({ setSelected })
    const { getByText } = render(<MarketViews sub="map" />)
    fireEvent.click(getByText('AAPL'))
    expect(setSelected).toHaveBeenCalledWith('AAPL')
  })

  it('switching to the Crypto universe hides the sector chips', () => {
    const { getByText, queryByText } = render(<MarketViews sub="map" />)
    expect(getByText('Technology')).toBeTruthy()
    fireEvent.click(getByText('Crypto'))
    expect(queryByText('Technology')).toBeNull()
  })

  // ── A: tooltip never shows a seed price (accurate-numbers rule) ───────────
  it('omits the price in the tooltip when no live quote has loaded', () => {
    useStore.setState({ quotes: {} })
    const { getByText, container } = render(<MarketViews sub="map" />)
    fireEvent.mouseEnter(getByText('AAPL').closest('g') as SVGGElement)
    const tip = container.querySelector('[data-treemap-tip]') as HTMLElement
    expect(tip).toBeTruthy()
    expect(tip.textContent).toContain('AAPL')
    expect(tip.textContent).not.toContain('$')  // no seed/placeholder price
  })

  it('shows the price in the tooltip once a real quote is present', () => {
    useStore.setState({ quotes: { AAPL: { price: 215.5, change_pct: 1.2 } } as never })
    const { getByText, container } = render(<MarketViews sub="map" />)
    fireEvent.mouseEnter(getByText('AAPL').closest('g') as SVGGElement)
    const tip = container.querySelector('[data-treemap-tip]') as HTMLElement
    expect(tip.textContent).toContain('$215.50')
  })

  // ── C: crypto tile click opens the Crypto view ───────────────────────────
  it('clicking a crypto tile navigates to the Crypto view', () => {
    const setView = vi.fn()
    useStore.setState({
      setView,
      crypto: { coins: [{ id: 'btc', symbol: 'BTC', name: 'Bitcoin', price: 60000, market_cap: 1e12, change_pct: 2 }], total_market_cap: 1e12, btc_dominance: 50 } as never,
    })
    const { getByText } = render(<MarketViews sub="map" />)
    fireEvent.click(getByText('Crypto'))      // switch universe to crypto
    fireEvent.click(getByText('BTC'))          // click the BTC tile
    expect(setView).toHaveBeenCalledWith('crypto')
  })

  // ── D: exchange filter (honest listing-venue facts) ──────────────────────
  it('filters by exchange — NASDAQ keeps AAPL, drops NYSE-listed XOM', () => {
    const { getByText, queryByText } = render(<MarketViews sub="map" />)
    expect(getByText('AAPL')).toBeTruthy()
    expect(getByText('XOM')).toBeTruthy()
    fireEvent.click(getByText('NASDAQ'))
    expect(getByText('AAPL')).toBeTruthy()     // AAPL lists on NASDAQ
    expect(queryByText('XOM')).toBeNull()       // XOM lists on NYSE → filtered out
  })
})
