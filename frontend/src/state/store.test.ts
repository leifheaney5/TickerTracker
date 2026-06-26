import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useStore } from './store'

beforeEach(() => {
  useStore.setState({ currentUser: null, watchlist: [], holdings: [], settings: null })
})

// Helper: mock fetch for login success followed by subsequent data-load calls.
// login() calls loadWatchlist → GET /api/watchlist (envelope), loadSettings → GET /api/settings (envelope),
// loadHoldings → GET /api/holdings (envelope). We return minimal valid envelopes for those.
function mockLoginSuccess(user = { id: 1, email: 'a@b.com', name: '', email_verified: true }) {
  const envelopeMock = { ok: true, json: async () => ({ data: [], meta: { source: 'db', stale: false } }) }
  let callCount = 0
  global.fetch = vi.fn().mockImplementation(async () => {
    callCount++
    if (callCount === 1) {
      // First call: login POST
      return { ok: true, json: async () => ({ user }) }
    }
    // Subsequent calls: watchlist / settings / holdings GETs
    return envelopeMock
  }) as never
}

describe('auth store', () => {
  it('login sets currentUser', async () => {
    mockLoginSuccess()
    const res = await useStore.getState().login('a@b.com', 'password123')
    expect(res.ok).toBe(true)
    expect(useStore.getState().currentUser?.email).toBe('a@b.com')
  })

  it('login applies ?? null guard when user is missing', async () => {
    const envelopeMock = { ok: true, json: async () => ({ data: [], meta: { source: 'db', stale: false } }) }
    let callCount = 0
    global.fetch = vi.fn().mockImplementation(async () => {
      callCount++
      if (callCount === 1) return { ok: true, json: async () => ({}) } // no .user field
      return envelopeMock
    }) as never
    await useStore.getState().login('a@b.com', 'password123')
    expect(useStore.getState().currentUser).toBeNull()
  })

  it('login failure returns error', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'invalid email or password' }) }) as never
    const res = await useStore.getState().login('a@b.com', 'x')
    expect(res.ok).toBe(false)
    expect(useStore.getState().currentUser).toBeNull()
  })

  it('logout clears currentUser, watchlist, holdings, and settings', async () => {
    useStore.setState({
      currentUser: { id: 1, email: 'a@b.com', name: '', email_verified: true },
      watchlist: [{ symbol: 'AAPL', position: 0, target: 0, alert_price: 0, alert_dir: 'above' }],
      holdings: [{ symbol: 'AAPL', shares: 10, avg_cost: 150 }],
      settings: { broker_connected: false, broker_name: '', live_updates: true, alert_notifs: true, news_digest: false, hide_balances: false, currency: 'USD' },
    })
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as never
    await useStore.getState().logout()
    const state = useStore.getState()
    expect(state.currentUser).toBeNull()
    expect(state.watchlist).toEqual([])
    expect(state.holdings).toEqual([])
    expect(state.settings).toBeNull()
  })

  it('forgot returns ok:true on 200', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true }) as never
    const res = await useStore.getState().forgot('a@b.com')
    expect(res.ok).toBe(true)
  })

  it('forgot returns ok:false on non-200', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false }) as never
    const res = await useStore.getState().forgot('a@b.com')
    expect(res.ok).toBe(false)
  })

  it('reset returns ok:true on 200', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as never
    const res = await useStore.getState().reset('tok123', 'newpass')
    expect(res.ok).toBe(true)
  })

  it('reset returns ok:false with error on non-200', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'invalid token' }) }) as never
    const res = await useStore.getState().reset('badtok', 'newpass')
    expect(res.ok).toBe(false)
    expect(res.error).toBe('invalid token')
  })
})
