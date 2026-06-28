import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useStore } from './store'
import type { Pulse, PulsePoint } from '../api/types'

const SAMPLE: Pulse = {
  symbol: 'AAPL', score: 62.3, band: 'Building',
  components: [
    { key: 'momentum', label: 'Momentum (RSI)', value: 58, raw: 'RSI 58', state: 'Neutral', weight: 0.25, contribution: 14.5 },
  ],
  asOf: '2026-06-28T00:00:00Z', kind: 'stock',
  disclaimer: 'Pulse is a transparent summary of public signals — not investment advice.',
}

function mockPulse(data: Pulse) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ data, meta: { source: 'composite', stale: false, fetched_at: '' } }),
  }) as never
}

const SERIES: PulsePoint[] = [
  { date: '2026-06-26', score: 48, band: 'Neutral' },
  { date: '2026-06-27', score: 53, band: 'Building' },
]

beforeEach(() => {
  useStore.setState({ pulse: {}, pulseHistory: {} })
})

describe('loadPulse', () => {
  it('fetches and stores the Pulse for a symbol', async () => {
    mockPulse(SAMPLE)
    await useStore.getState().loadPulse('AAPL')
    expect(useStore.getState().pulse['AAPL']?.score).toBe(62.3)
    expect(useStore.getState().pulse['AAPL']?.band).toBe('Building')
  })

  it('does not refetch when already loaded', async () => {
    useStore.setState({ pulse: { AAPL: SAMPLE } })
    const spy = vi.fn()
    global.fetch = spy as never
    await useStore.getState().loadPulse('AAPL')
    expect(spy).not.toHaveBeenCalled()
  })

  it('swallows errors and leaves the entry unset', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('down')) as never
    await useStore.getState().loadPulse('NVDA')
    expect(useStore.getState().pulse['NVDA']).toBeUndefined()
  })
})

describe('loadPulseHistory', () => {
  it('fetches and stores the Pulse series for a symbol', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: SERIES, meta: { source: 'signal_history', stale: false, fetched_at: '' } }),
    }) as never
    await useStore.getState().loadPulseHistory('AAPL')
    expect(useStore.getState().pulseHistory['AAPL']).toHaveLength(2)
    expect(useStore.getState().pulseHistory['AAPL'][1].band).toBe('Building')
  })

  it('does not refetch when already loaded', async () => {
    useStore.setState({ pulseHistory: { AAPL: SERIES } })
    const spy = vi.fn()
    global.fetch = spy as never
    await useStore.getState().loadPulseHistory('AAPL')
    expect(spy).not.toHaveBeenCalled()
  })
})

describe('loadSignalAlerts', () => {
  it('fetches and stores the active smart-signal conditions', async () => {
    const payload = {
      symbol: 'AAPL', pulse: { score: 80, band: 'Hot' },
      conditions: [{ key: 'near_target', title: 'Near analyst target', detail: '...' }],
      disclaimer: 'not advice',
    }
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: payload, meta: { source: 'signal_alerts', stale: false, fetched_at: '' } }),
    }) as never
    await useStore.getState().loadSignalAlerts('AAPL')
    expect(useStore.getState().signalAlerts['AAPL']?.conditions[0].key).toBe('near_target')
  })
})
