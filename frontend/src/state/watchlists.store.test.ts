// frontend/src/state/watchlists.store.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../api/client', () => ({
  api: {
    getWatchlists: vi.fn(async () => ({ data: [
      { id: 1, name: 'My Watchlist', position: 0, share_token: null, items: [
        { symbol: 'NVDA', position: 0, target: 0, alert_price: 0, alert_dir: 'above', alert_active: false, watchlist_id: 1, locked: false },
        { symbol: 'AAPL', position: 1, target: 0, alert_price: 0, alert_dir: 'above', alert_active: false, watchlist_id: 1, locked: true },
      ] },
    ], source: 'db', stale: false, fetchedAt: '' })),
  },
}))

import { useStore } from './store'

describe('store.loadWatchlists', () => {
  beforeEach(() => { useStore.setState({ watchlists: [], watchlist: [] }) })

  it('loads lists and derives flat active watchlist', async () => {
    await useStore.getState().loadWatchlists()
    expect(useStore.getState().watchlists.length).toBe(1)
    // locked AAPL excluded from flat watchlist
    expect(useStore.getState().watchlist.map((w) => w.symbol)).toEqual(['NVDA'])
  })
})
