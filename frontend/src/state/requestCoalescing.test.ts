import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../api/client'
import { useStore } from './store'

describe('request coalescing', () => {
  beforeEach(() => useStore.setState({ history: {}, fng: null, fngFetchedAt: '' }))

  it('shares a pending history request for the same key', async () => {
    let resolve!: (value: any) => void
    const pending = new Promise((done) => { resolve = done })
    const spy = vi.spyOn(api, 'history').mockReturnValue(pending as never)
    const a = useStore.getState().loadHistory('AAPL', '1M')
    const b = useStore.getState().loadHistory('AAPL', '1M')
    expect(spy).toHaveBeenCalledTimes(1)
    resolve({ data: [], source: 'test', stale: false, fetchedAt: '' })
    await Promise.all([a, b])
  })

  it('shares Fear and Greed and stores its timestamp', async () => {
    const spy = vi.spyOn(api, 'fng').mockResolvedValue({ data: { value: 50, label: 'Neutral' }, source: 'test', stale: false, fetchedAt: '2026-09-10T00:00:00Z' })
    await Promise.all([useStore.getState().loadFng(), useStore.getState().loadFng()])
    expect(spy).toHaveBeenCalledTimes(1)
    expect(useStore.getState().fngFetchedAt).toContain('2026')
  })
})
