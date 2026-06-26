// Types mirroring the backend API contract (see backend-api-contract memory).

export interface Envelope<T> {
  data: T
  meta: { source: string; stale: boolean }
}

export interface Quote {
  price: number
  change_pct: number
  day_open: number
  day_high: number
  day_low: number
  prev_close: number
  volume: number
}

export interface QuotesResponse {
  quotes: Record<string, Quote>
  market_status: string
}

export interface Bar {
  date: string
  o: number
  h: number
  l: number
  c: number
  v: number
}

export interface Fundamentals {
  pe: number | null
  market_cap: number
  sector: string
  industry: string
  week52_high: number
  week52_low: number
  all_time_high: number
  all_time_low: number
  beta: number
  dividend_yield: number
  eps: number
}

export interface Coin {
  symbol: string
  name: string
  price: number
  change_pct: number
  market_cap: number
}

export interface CryptoResponse {
  coins: Coin[]
  total_market_cap: number
  btc_dominance: number
}

export interface Fng {
  value: number
  label: string
}

export type Sentiment = 'Bullish' | 'Bearish' | 'Neutral'

export interface NewsItem {
  source: string
  datetime: string
  sentiment: Sentiment
  headline: string
  url: string
  symbol: string
}

export interface Ratings {
  consensus: 'Strong Buy' | 'Buy' | 'Hold' | 'Sell' | 'Strong Sell'
  distribution: { strongBuy: number; buy: number; hold: number; sell: number; strongSell: number }
  target: { low: number; high: number; mean: number; current: number }
}

export type AlertDir = 'above' | 'below'

export interface WatchlistItem {
  symbol: string
  position: number
  target: number
  alert_price: number
  alert_dir: AlertDir
}

export interface Settings {
  broker_connected: boolean
  broker_name: string
  live_updates: boolean
  alert_notifs: boolean
  news_digest: boolean
  hide_balances: boolean
  currency: string
}

export interface Holding {
  symbol: string
  shares: number
  avg_cost: number
}

export type Timeframe = '1D' | '1W' | '1M' | '3M' | '1Y' | '5Y'

export interface AuthUser { id: number; email: string; name: string; email_verified: boolean }

export interface SymbolHit { symbol: string; description: string; type: string }
