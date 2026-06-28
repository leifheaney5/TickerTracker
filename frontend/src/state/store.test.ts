import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useStore } from './store'
import type { EarningsRow } from '../api/types'

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

describe('loadEarnings', () => {
  beforeEach(() => {
    useStore.setState({ earnings: {} })
  })

  it('stores the first upcoming row at earnings[sym]', async () => {
    const row: EarningsRow = { symbol: 'AAPL', date: '2026-07-10', hour: 'amc', epsEstimate: 1.55 }
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [row], meta: { source: 'finnhub', stale: false } }),
    }) as never
    await useStore.getState().loadEarnings('AAPL')
    expect(useStore.getState().earnings['AAPL']).toEqual(row)
  })

  it('stores null (not undefined) when there is no upcoming report', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [], meta: { source: 'finnhub', stale: false } }),
    }) as never
    await useStore.getState().loadEarnings('TSLA')
    expect(useStore.getState().earnings['TSLA']).toBeNull()
  })

  it('does not re-fetch when the symbol is already cached (incl. null)', async () => {
    useStore.setState({ earnings: { TSLA: null } })
    const spy = vi.fn()
    global.fetch = spy as never
    await useStore.getState().loadEarnings('TSLA')
    expect(spy).not.toHaveBeenCalled()
  })
})

describe('logos store', () => {
  beforeEach(() => {
    useStore.setState({ logos: {} })
  })

  it('loadLogos populates the logos cache from /api/logos', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: { NVDA: 'https://logo/NVDA.png', KO: 'https://logo/KO.png' },
        meta: { source: 'finnhub', stale: false },
      }),
    }) as never
    await useStore.getState().loadLogos(['NVDA', 'KO'])
    expect(useStore.getState().logos.NVDA).toBe('https://logo/NVDA.png')
    expect(useStore.getState().logos.KO).toBe('https://logo/KO.png')
  })

  it('does not re-request symbols already attempted', async () => {
    // Use a symbol unique to this test — logosAttempted is module-level and
    // persists across tests (the dedup guard is itself session-scoped state).
    const spy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { TSLA: 'https://logo/TSLA.png' }, meta: { source: 'finnhub', stale: false } }),
    })
    global.fetch = spy as never
    await useStore.getState().loadLogos(['TSLA'])
    await useStore.getState().loadLogos(['TSLA'])
    expect(spy).toHaveBeenCalledTimes(1)
  })
})
