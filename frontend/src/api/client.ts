// Typed API client. Each call returns the unwrapped `data` plus the response
// `meta` so callers can surface source/stale hints. Network errors propagate;
// callers (the store) decide on mock fallback.

import type {
  Envelope, QuotesResponse, Bar, Fundamentals, CryptoResponse, CryptoSearchResult, Fng,
  NewsItem, Ratings, Pulse, PulsePoint, SignalAlerts, WatchlistItem, Settings, Holding, Timeframe, SymbolHit,
  SharedWatchlistResponse, EarningsRow, SavedScreen, WatchlistSentiment,
  WatchlistWithItems, WatchlistItemFull, BillingState,
} from './types'

export interface Result<T> {
  data: T
  source: string
  stale: boolean
  fetchedAt: string
}

// Carries the parsed response body so callers can inspect 402 limit errors
// ({error:"limit_exceeded", feature, limit, plan, message}).
export class ApiError extends Error {
  status: number
  body: any
  constructor(status: number, body: any, path: string) {
    super(`${path} → ${status}`)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

type RawWatchlistItem = Partial<WatchlistItem> & Pick<WatchlistItem, 'symbol'>

export function normalizeWatchlistItem<T extends RawWatchlistItem>(item: T): T & WatchlistItem {
  const sellTarget = Number(item.sell_target ?? item.target ?? 0)
  return {
    alert_active: false,
    alert_dir: 'above',
    alert_price: 0,
    kind: 'stock',
    position: 0,
    ...item,
    buy_target: Number(item.buy_target ?? 0),
    sell_target: Number.isFinite(sellTarget) ? sellTarget : 0,
    target: Number.isFinite(sellTarget) ? sellTarget : 0,
  } as T & WatchlistItem
}

function normalizeWatchlist<T extends RawWatchlistItem>(items: T[]): Array<T & WatchlistItem> {
  return items.map(normalizeWatchlistItem)
}

async function get<T>(path: string): Promise<Result<T>> {
  const r = await fetch(path, { credentials: 'include' })
  if (!r.ok) throw new ApiError(r.status, await r.json().catch(() => null), path)
  const env = (await r.json()) as Envelope<T>
  return { data: env.data, source: env.meta.source, stale: env.meta.stale, fetchedAt: env.meta.fetched_at }
}

async function send<T>(path: string, method: string, body?: unknown): Promise<Result<T>> {
  const r = await fetch(path, {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!r.ok) throw new ApiError(r.status, await r.json().catch(() => null), path)
  const env = (await r.json()) as Envelope<T>
  return { data: env.data, source: env.meta.source, stale: env.meta.stale, fetchedAt: env.meta.fetched_at }
}

export const api = {
  quotes: (syms: string[]) =>
    get<QuotesResponse>(`/api/quotes?syms=${encodeURIComponent(syms.join(','))}`),
  history: (sym: string, tf: Timeframe) =>
    get<Bar[]>(`/api/history/${encodeURIComponent(sym)}?tf=${tf}`),
  fundamentals: (sym: string) => get<Fundamentals>(`/api/fundamentals/${encodeURIComponent(sym)}`),
  logos: (syms: string[]) => get<Record<string, string>>(`/api/logos?syms=${encodeURIComponent(syms.join(','))}`),
  search: (q: string) => get<SymbolHit[]>(`/api/search?q=${encodeURIComponent(q)}`),
  crypto: (limit?: number, watchIds?: string[]) => {
    const p = new URLSearchParams()
    if (limit) p.set('limit', String(limit))
    if (watchIds && watchIds.length) p.set('watch', watchIds.join(','))
    const qs = p.toString()
    return get<CryptoResponse>(`/api/crypto${qs ? `?${qs}` : ''}`)
  },
  cryptoSearch: (q: string) =>
    get<CryptoSearchResult[]>(`/api/crypto/search?q=${encodeURIComponent(q)}`),
  fng: () => get<Fng>('/api/fng'),
  news: (sym?: string) => get<NewsItem[]>(sym ? `/api/news?sym=${encodeURIComponent(sym)}` : '/api/news?market=1'),
  ratings: (sym: string) => get<Ratings>(`/api/ratings/${encodeURIComponent(sym)}`),
  pulse: (sym: string) => get<Pulse>(`/api/pulse/${encodeURIComponent(sym)}`),
  pulseHistory: (sym: string) => get<PulsePoint[]>(`/api/pulse/${encodeURIComponent(sym)}/history`),
  signalAlerts: (sym: string) => get<SignalAlerts>(`/api/pulse/${encodeURIComponent(sym)}/signals`),

  getWatchlist: async () => {
    const result = await get<RawWatchlistItem[]>('/api/watchlist')
    return { ...result, data: normalizeWatchlist(result.data) }
  },
  addWatch: async (b: { symbol: string; buy_target?: number; sell_target?: number; alert_price?: number; alert_dir?: string; kind?: 'stock' | 'crypto'; coin_name?: string }) => {
    const result = await send<RawWatchlistItem>('/api/watchlist', 'POST', b)
    return { ...result, data: normalizeWatchlistItem(result.data) }
  },
  updateWatch: async (sym: string, b: Omit<Partial<WatchlistItem>, 'target'>) => {
    const result = await send<RawWatchlistItem>(`/api/watchlist/${encodeURIComponent(sym)}`, 'PATCH', b)
    return { ...result, data: normalizeWatchlistItem(result.data) }
  },
  removeWatch: (sym: string) =>
    send<{ removed: boolean }>(`/api/watchlist/${encodeURIComponent(sym)}`, 'DELETE'),

  getWatchlists: async () => {
    const result = await get<WatchlistWithItems[]>('/api/watchlists')
    return { ...result, data: result.data.map((list) => ({ ...list, items: normalizeWatchlist(list.items) })) }
  },
  createWatchlist: (name: string) =>
    send<WatchlistWithItems>('/api/watchlists', 'POST', { name }),
  patchWatchlist: (id: number, b: { name?: string; position?: number }) =>
    send<{ id: number; name: string; position: number }>(`/api/watchlists/${id}`, 'PATCH', b),
  deleteWatchlist: (id: number) =>
    send<{ deleted: boolean }>(`/api/watchlists/${id}`, 'DELETE'),
  addListItem: async (id: number, b: { symbol: string; buy_target?: number; sell_target?: number }) => {
    const result = await send<WatchlistItemFull>(`/api/watchlists/${id}/items`, 'POST', b)
    return { ...result, data: normalizeWatchlistItem(result.data) }
  },
  patchListItem: async (id: number, sym: string, b: Omit<Partial<WatchlistItemFull>, 'target'>) => {
    const result = await send<WatchlistItemFull>(`/api/watchlists/${id}/items/${encodeURIComponent(sym)}`, 'PATCH', b)
    return { ...result, data: normalizeWatchlistItem(result.data) }
  },
  removeListItem: (id: number, sym: string) =>
    send<{ removed: boolean }>(`/api/watchlists/${id}/items/${encodeURIComponent(sym)}`, 'DELETE'),
  shareList: (id: number) =>
    send<{ token: string }>(`/api/watchlists/${id}/share`, 'POST'),

  getSettings: () => get<Settings>('/api/settings'),
  updateSettings: (b: Partial<Settings>) => send<Settings>('/api/settings', 'PATCH', b),

  getHoldings: () => get<Holding[]>('/api/holdings'),
  setHolding: (b: { symbol: string; shares: number; avg_cost: number }) =>
    send<Holding>('/api/holdings', 'POST', b),
  removeHolding: (sym: string) =>
    send<{ removed: boolean }>(`/api/holdings/${encodeURIComponent(sym)}`, 'DELETE'),

  createShare: () => send<{ token: string }>('/api/watchlist/share', 'POST'),
  getShared: async (token: string) => {
    const result = await get<SharedWatchlistResponse>(`/api/shared/${encodeURIComponent(token)}`)
    return { ...result, data: { ...result.data, items: normalizeWatchlist(result.data.items) } }
  },

  earnings: (syms: string[]) =>
    get<EarningsRow[]>(`/api/earnings?syms=${encodeURIComponent(syms.join(','))}`),

  getScreens: () => get<SavedScreen[]>('/api/screens'),
  saveScreen: (b: { name: string; filters: Record<string, string> }) =>
    send<SavedScreen>('/api/screens', 'POST', b),
  deleteScreen: (id: number) =>
    send<{ deleted: boolean }>(`/api/screens/${id}`, 'DELETE'),

  sentiment: (syms: string[]) =>
    get<WatchlistSentiment>(`/api/sentiment?syms=${encodeURIComponent(syms.join(','))}`),

  getBilling: () => get<BillingState>('/api/billing'),
  checkout: (interval: 'monthly' | 'annual') =>
    send<{ url: string }>('/api/billing/checkout', 'POST', { interval }),
  portal: () => send<{ url: string }>('/api/billing/portal', 'POST'),
}
