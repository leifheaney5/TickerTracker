// frontend/src/state/store.crypto.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useStore } from './store'
import { api } from '../api/client'

vi.mock('../api/client', () => ({
  api: {
    crypto: vi.fn(async () => ({ data: { coins: [], total_market_cap: 0, btc_dominance: 0 }, source: 't', stale: false, fetchedAt: '' })),
    addWatch: vi.fn(async () => ({ data: {}, source: 't', stale: false, fetchedAt: '' })),
    removeWatch: vi.fn(async () => ({ data: { removed: true }, source: 't', stale: false, fetchedAt: '' })),
    getWatchlist: vi.fn(async () => ({ data: [], source: 't', stale: false, fetchedAt: '' })),
  },
}))

describe('crypto watchlist store', () => {
  beforeEach(() => {
    useStore.setState({ cryptoLimit: 50, watchlist: [], crypto: null })
    vi.clearAllMocks()
  })

  it('setCryptoLimit updates limit and reloads crypto with it', async () => {
    await useStore.getState().setCryptoLimit(100)
    expect(useStore.getState().cryptoLimit).toBe(100)
    expect(api.crypto).toHaveBeenCalledWith(100, [])
  })

  it('addCryptoWatch posts with kind:crypto and coin_name', async () => {
    await useStore.getState().addCryptoWatch({ id: 'solana', symbol: 'SOL', name: 'Solana' })
    expect(api.addWatch).toHaveBeenCalledWith(
      expect.objectContaining({ symbol: 'solana', kind: 'crypto', coin_name: 'Solana' }))
  })

  it('cryptoWatchIds filters by kind', () => {
    useStore.setState({ watchlist: [
      { symbol: 'NVDA', position: 0, target: 0, alert_price: 0, alert_dir: 'above', alert_active: false, kind: 'stock' },
      { symbol: 'solana', position: 1, target: 0, alert_price: 0, alert_dir: 'above', alert_active: false, kind: 'crypto', coin_name: 'Solana' },
    ] })
    expect(useStore.getState().cryptoWatchIds()).toEqual(['solana'])
  })
})
