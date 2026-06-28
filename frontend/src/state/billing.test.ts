import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useStore } from './store'
import { api, ApiError } from '../api/client'

describe('billing store slice', () => {
  beforeEach(() => {
    useStore.setState({ billing: null, upgradePrompt: null })
    vi.restoreAllMocks()
  })

  it('loadBilling stores fetched state', async () => {
    vi.spyOn(api, 'getBilling').mockResolvedValue({
      data: {
        plan: 'free', status: '', is_pro: false,
        limits: { watchlist: 15, alerts: 3, screens: 1, digest: false, compare: 2 },
        usage: { watchlist: 2, alerts: 0, screens: 0 },
        current_period_end: null, cancel_at_period_end: false,
      },
      source: 'db', stale: false, fetchedAt: '',
    })
    await useStore.getState().loadBilling()
    expect(useStore.getState().billing?.plan).toBe('free')
    expect(useStore.getState().billing?.usage.watchlist).toBe(2)
  })

  it('openUpgrade/closeUpgrade toggle the prompt', () => {
    useStore.getState().openUpgrade('watchlist', 'Limit reached')
    expect(useStore.getState().upgradePrompt?.feature).toBe('watchlist')
    useStore.getState().closeUpgrade()
    expect(useStore.getState().upgradePrompt).toBeNull()
  })

  it('addWatch opens upgrade prompt on 402', async () => {
    vi.spyOn(api, 'addWatch').mockRejectedValue(
      new ApiError(402, { error: 'limit_exceeded', feature: 'watchlist', message: 'Upgrade' }, '/api/watchlist'))
    await useStore.getState().addWatch('NVDA')
    expect(useStore.getState().upgradePrompt?.feature).toBe('watchlist')
  })

  it('toggleCompare caps Free users at 2 and opens upgrade prompt', () => {
    useStore.setState({
      compare: [], upgradePrompt: null,
      billing: {
        plan: 'free', status: '', is_pro: false,
        limits: { watchlist: 15, alerts: 3, screens: 1, digest: false, compare: 2 },
        usage: { watchlist: 0, alerts: 0, screens: 0 },
        current_period_end: null, cancel_at_period_end: false,
      },
    })
    const { toggleCompare } = useStore.getState()
    toggleCompare('AAPL'); toggleCompare('MSFT')
    expect(useStore.getState().compare).toHaveLength(2)
    toggleCompare('NVDA') // third -> blocked
    expect(useStore.getState().compare).toHaveLength(2)
    expect(useStore.getState().upgradePrompt?.feature).toBe('compare')
  })
})
