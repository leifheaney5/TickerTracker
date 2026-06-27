import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useStore } from './store'

beforeEach(() => {
  useStore.setState({ currentUser: null, watchlist: [], holdings: [], settings: null })
})

describe('updateWatch alert fields', () => {
  it('updateWatch with alert_active:true round-trips to watchlist state', async () => {
    // Seed a watchlist item in the store
    useStore.setState({
      watchlist: [
        { symbol: 'AAPL', position: 0, target: 0, alert_price: 0, alert_dir: 'above', alert_active: false },
      ],
    } as any)

    // Mock fetch: api.updateWatch calls PATCH /api/watchlist/AAPL — return an
    // envelope echoing the patched item (alert_active flipped to true)
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: { symbol: 'AAPL', position: 0, target: 0, alert_price: 0, alert_dir: 'above', alert_active: true },
        meta: { source: 'db', stale: false },
      }),
    }) as never

    await useStore.getState().updateWatch('AAPL', { alert_active: true })

    const item = useStore.getState().watchlist.find((w) => w.symbol === 'AAPL')
    expect(item?.alert_active).toBe(true)
  })

  it('updateWatch with alert_price and alert_dir round-trips to watchlist state', async () => {
    useStore.setState({
      watchlist: [
        { symbol: 'TSLA', position: 1, target: 0, alert_price: 0, alert_dir: 'above', alert_active: false },
      ],
    } as any)

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: { symbol: 'TSLA', position: 1, target: 0, alert_price: 250, alert_dir: 'below', alert_active: false },
        meta: { source: 'db', stale: false },
      }),
    }) as never

    await useStore.getState().updateWatch('TSLA', { alert_price: 250, alert_dir: 'below' })

    const item = useStore.getState().watchlist.find((w) => w.symbol === 'TSLA')
    expect(item?.alert_price).toBe(250)
    expect(item?.alert_dir).toBe('below')
  })

  it('updateWatch applies optimistic update immediately (before fetch resolves)', async () => {
    useStore.setState({
      watchlist: [
        { symbol: 'NVDA', position: 2, target: 0, alert_price: 0, alert_dir: 'above', alert_active: false },
      ],
    } as any)

    // Use a never-resolving fetch to confirm the optimistic update is synchronous
    let resolveFetch!: () => void
    global.fetch = vi.fn().mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = () =>
          resolve({
            ok: true,
            json: async () => ({ data: { symbol: 'NVDA', position: 2, target: 0, alert_price: 900, alert_dir: 'above', alert_active: true }, meta: {} }),
          } as never)
      })
    ) as never

    const updatePromise = useStore.getState().updateWatch('NVDA', { alert_price: 900, alert_active: true })

    // Optimistic state should be applied synchronously before await
    const itemOptimistic = useStore.getState().watchlist.find((w) => w.symbol === 'NVDA')
    expect(itemOptimistic?.alert_price).toBe(900)
    expect(itemOptimistic?.alert_active).toBe(true)

    resolveFetch()
    await updatePromise
  })
})
