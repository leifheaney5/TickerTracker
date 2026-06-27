// Typed API client. Each call returns the unwrapped `data` plus the response
// `meta` so callers can surface source/stale hints. Network errors propagate;
// callers (the store) decide on mock fallback.

import type {
  Envelope, QuotesResponse, Bar, Fundamentals, CryptoResponse, Fng,
  NewsItem, Ratings, WatchlistItem, Settings, Holding, Timeframe, SymbolHit,
  SharedWatchlistResponse,
} from './types'

export interface Result<T> {
  data: T
  source: string
  stale: boolean
  fetchedAt: string
}

async function get<T>(path: string): Promise<Result<T>> {
  const r = await fetch(path, { credentials: 'include' })
  if (!r.ok) throw new Error(`${path} → ${r.status}`)
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
  if (!r.ok) throw new Error(`${path} → ${r.status}`)
  const env = (await r.json()) as Envelope<T>
  return { data: env.data, source: env.meta.source, stale: env.meta.stale, fetchedAt: env.meta.fetched_at }
}

export const api = {
  quotes: (syms: string[]) =>
    get<QuotesResponse>(`/api/quotes?syms=${encodeURIComponent(syms.join(','))}`),
  history: (sym: string, tf: Timeframe) =>
    get<Bar[]>(`/api/history/${encodeURIComponent(sym)}?tf=${tf}`),
  fundamentals: (sym: string) => get<Fundamentals>(`/api/fundamentals/${encodeURIComponent(sym)}`),
  search: (q: string) => get<SymbolHit[]>(`/api/search?q=${encodeURIComponent(q)}`),
  crypto: () => get<CryptoResponse>('/api/crypto'),
  fng: () => get<Fng>('/api/fng'),
  news: (sym?: string) => get<NewsItem[]>(sym ? `/api/news?sym=${encodeURIComponent(sym)}` : '/api/news?market=1'),
  ratings: (sym: string) => get<Ratings>(`/api/ratings/${encodeURIComponent(sym)}`),

  getWatchlist: () => get<WatchlistItem[]>('/api/watchlist'),
  addWatch: (b: { symbol: string; target?: number; alert_price?: number; alert_dir?: string }) =>
    send<WatchlistItem>('/api/watchlist', 'POST', b),
  updateWatch: (sym: string, b: Partial<WatchlistItem>) =>
    send<WatchlistItem>(`/api/watchlist/${encodeURIComponent(sym)}`, 'PATCH', b),
  removeWatch: (sym: string) =>
    send<{ removed: boolean }>(`/api/watchlist/${encodeURIComponent(sym)}`, 'DELETE'),

  getSettings: () => get<Settings>('/api/settings'),
  updateSettings: (b: Partial<Settings>) => send<Settings>('/api/settings', 'PATCH', b),

  getHoldings: () => get<Holding[]>('/api/holdings'),
  setHolding: (b: { symbol: string; shares: number; avg_cost: number }) =>
    send<Holding>('/api/holdings', 'POST', b),
  removeHolding: (sym: string) =>
    send<{ removed: boolean }>(`/api/holdings/${encodeURIComponent(sym)}`, 'DELETE'),

  createShare: () => send<{ token: string }>('/api/watchlist/share', 'POST'),
  getShared: (token: string) => get<SharedWatchlistResponse>(`/api/shared/${encodeURIComponent(token)}`),
}
