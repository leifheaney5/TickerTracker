import type { WatchlistWithItems, WatchlistItem } from '../api/types'

function renumber(items: WatchlistWithItems['items']) {
  return items.map((it, i) => ({ ...it, position: i }))
}

export function reorderLists(lists: WatchlistWithItems[], activeId: number, overId: number): WatchlistWithItems[] {
  const from = lists.findIndex((l) => l.id === activeId)
  const to = lists.findIndex((l) => l.id === overId)
  if (from === -1 || to === -1 || from === to) return lists
  const next = lists.slice()
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next.map((l, i) => ({ ...l, position: i }))
}

export function moveItem(
  lists: WatchlistWithItems[], symbol: string, fromListId: number, toListId: number, toIndex: number,
): WatchlistWithItems[] {
  const src = lists.find((l) => l.id === fromListId)
  const dst = lists.find((l) => l.id === toListId)
  if (!src || !dst) return lists
  const item = src.items.find((i) => i.symbol === symbol)
  if (!item) return lists
  return lists.map((l) => {
    if (l.id === fromListId && fromListId !== toListId) {
      return { ...l, items: renumber(l.items.filter((i) => i.symbol !== symbol)) }
    }
    if (l.id === toListId) {
      const without = l.items.filter((i) => i.symbol !== symbol)
      const moved = { ...item, watchlist_id: toListId }
      const clamped = Math.max(0, Math.min(toIndex, without.length))
      without.splice(clamped, 0, moved)
      return { ...l, items: renumber(without) }
    }
    return l
  })
}

export function reorderWithinList(
  lists: WatchlistWithItems[], listId: number, fromIndex: number, toIndex: number,
): WatchlistWithItems[] {
  return lists.map((l) => {
    if (l.id !== listId) return l
    const items = l.items.slice()
    const [moved] = items.splice(fromIndex, 1)
    items.splice(toIndex, 0, moved)
    return { ...l, items: renumber(items) }
  })
}

export function flattenActive(lists: WatchlistWithItems[]): WatchlistItem[] {
  const seen = new Set<string>()
  const out: WatchlistItem[] = []
  for (const l of lists) {
    for (const it of l.items) {
      if (it.locked || seen.has(it.symbol)) continue
      seen.add(it.symbol)
      out.push({
        symbol: it.symbol, position: out.length, target: it.target,
        alert_price: it.alert_price, alert_dir: it.alert_dir, alert_active: it.alert_active,
      })
    }
  }
  return out
}
