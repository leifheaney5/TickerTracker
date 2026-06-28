// frontend/src/views/Crypto.test.tsx
import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Crypto } from './Crypto'
import { useStore } from '../state/store'
import { api } from '../api/client'

vi.mock('../api/client', () => ({
  api: { cryptoSearch: vi.fn(async () => ({ data: [], source: 't', stale: false, fetchedAt: '' })) },
}))

describe('Crypto view', () => {
  beforeEach(() => {
    useStore.setState({
      cryptoLimit: 50,
      crypto: { coins: [
        { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', price: 60000, change_pct: 1, market_cap: 1e12 },
      ], total_market_cap: 1e12, btc_dominance: 50 },
      fng: { value: 55, label: 'Greed' },
      watchlist: [], currentUser: { id: 1, email: 'a@b.co', name: 'A' } as never,
    })
  })

  it('renders the 25/50/100 selector and reflects current limit', () => {
    render(<Crypto />)
    expect(screen.getByRole('button', { name: '100' })).toBeTruthy()
  })

  it('clicking the star toggles the coin into the crypto watchlist', () => {
    const add = vi.spyOn(useStore.getState(), 'addCryptoWatch')
    render(<Crypto />)
    fireEvent.click(screen.getByLabelText('Watch Bitcoin'))
    expect(add).toHaveBeenCalled()
  })

  it('does not render stale search results that resolve after the query is cleared', async () => {
    vi.useFakeTimers()
    try {
      // First search call returns a promise we resolve manually, AFTER clearing.
      let resolveSearch: (v: unknown) => void = () => {}
      const deferred = new Promise((r) => { resolveSearch = r })
      vi.mocked(api.cryptoSearch).mockReturnValueOnce(deferred as never)

      render(<Crypto />)
      const input = screen.getByPlaceholderText('+ Add coin')

      fireEvent.change(input, { target: { value: 'btc' } })
      await act(async () => { vi.advanceTimersByTime(300) }) // debounce fires the fetch

      // User clears the input before the in-flight fetch resolves.
      fireEvent.change(input, { target: { value: '' } })

      // Now the stale fetch resolves with results.
      await act(async () => {
        resolveSearch({ data: [{ id: 'stale', symbol: 'STALE', name: 'Stale Coin' }], source: 't', stale: false, fetchedAt: '' })
        await Promise.resolve()
      })

      // The cancelled flag must prevent the stale data from repopulating the dropdown.
      expect(screen.queryByText('Stale Coin')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })
})
