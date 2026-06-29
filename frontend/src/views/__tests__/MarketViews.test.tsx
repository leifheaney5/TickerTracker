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
})
