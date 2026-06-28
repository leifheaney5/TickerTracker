// frontend/src/state/watchlistReducers.test.ts
import { describe, it, expect } from 'vitest'
import { reorderLists, moveItem, reorderWithinList, flattenActive } from './watchlistReducers'
import type { WatchlistWithItems } from '../api/types'

const mk = (id: number, name: string, syms: string[], locked: string[] = []): WatchlistWithItems => ({
  id, name, position: id, share_token: null,
  items: syms.map((symbol, i) => ({
    symbol, position: i, target: 0, alert_price: 0, alert_dir: 'above', alert_active: false,
    watchlist_id: id, locked: locked.includes(symbol),
  })),
})

describe('watchlistReducers', () => {
  it('reorders list cards', () => {
    const lists = [mk(1, 'A', []), mk(2, 'B', []), mk(3, 'C', [])]
    const out = reorderLists(lists, 3, 1) // move C before A
    expect(out.map((l) => l.id)).toEqual([3, 1, 2])
  })

  it('moves an item between lists', () => {
    const lists = [mk(1, 'A', ['NVDA', 'AAPL']), mk(2, 'B', ['MSFT'])]
    const out = moveItem(lists, 'NVDA', 1, 2, 0)
    expect(out[0].items.map((i) => i.symbol)).toEqual(['AAPL'])
    expect(out[1].items.map((i) => i.symbol)).toEqual(['NVDA', 'MSFT'])
    expect(out[1].items[0].watchlist_id).toBe(2)
  })

  it('reorders within a list', () => {
    const lists = [mk(1, 'A', ['NVDA', 'AAPL', 'MSFT'])]
    const out = reorderWithinList(lists, 1, 0, 2)
    expect(out[0].items.map((i) => i.symbol)).toEqual(['AAPL', 'MSFT', 'NVDA'])
  })

  it('flattens active union excluding locked + dupes', () => {
    const lists = [mk(1, 'A', ['NVDA', 'AAPL'], ['AAPL']), mk(2, 'B', ['NVDA', 'MSFT'])]
    expect(flattenActive(lists).map((i) => i.symbol)).toEqual(['NVDA', 'MSFT'])
  })
})
