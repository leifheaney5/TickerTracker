// Typed API client. Each call returns the unwrapped `data` plus the response
// `meta` so callers can surface source/stale hints. Network errors propagate;
// callers (the store) decide on mock fallback.

import type {
  Envelope, QuotesResponse, Bar, Fundamentals, CryptoResponse, Fng,
  NewsItem, Ratings, Pulse, PulsePoint, SignalAlerts, WatchlistItem, Settings, Holding, Timeframe, SymbolHit,
  SharedWatchlistResponse, EarningsRow, SavedScreen, WatchlistSentiment,
  BillingState,
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
  search: (q: string) => get<SymbolHit[]>(`/api/search?q=${encodeURIComponent(q)}`),
  crypto: () => get<CryptoResponse>('/api/crypto'),
  fng: () => get<Fng>('/api/fng'),
  news: (sym?: string) => get<NewsItem[]>(sym ? `/api/news?sym=${encodeURIComponent(sym)}` : '/api/news?market=1'),
  ratings: (sym: string) => get<Ratings>(`/api/ratings/${encodeURIComponent(sym)}`),
  pulse: (sym: string) => get<Pulse>(`/api/pulse/${encodeURIComponent(sym)}`),
  pulseHistory: (sym: string) => get<PulsePoint[]>(`/api/pulse/${encodeURIComponent(sym)}/history`),
  signalAlerts: (sym: string) => get<SignalAlerts>(`/api/pulse/${encodeURIComponent(sym)}/signals`),

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
