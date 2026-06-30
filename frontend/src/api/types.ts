// Types mirroring the backend API contract (see backend-api-contract memory).

export interface Envelope<T> {
  data: T
  meta: { source: string; stale: boolean; fetched_at: string }
}

export interface Quote {
  price: number
  change_pct: number
  day_open: number
  day_high: number
  day_low: number
  prev_close: number
  volume: number
  // Populated client-side in pollQuotes with the batch fetchedAt timestamp so
  // KeyStats can show per-symbol staleness even if global quotesFetchedAt drifts.
  // All symbols in one poll batch share the same value (same fetch round-trip).
  fetchedAt?: string
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
  /** Bare company domain (e.g. "coca-cola.com") for the logo; "" when unknown. */
  website?: string
}

export interface Coin {
  id: string
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

export interface CryptoSearchResult {
  id: string
  symbol: string
  name: string
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

// Pulse — the transparent composite signal score. Each component is explainable
// (raw value + weight + contribution); a missing signal is omitted, never zero-filled.
export interface PulseComponent {
  key: string
  label: string
  value: number        // 0-100 sub-score
  raw: string          // human-readable underlying reading, e.g. "RSI 58"
  state: 'Bullish' | 'Bearish' | 'Neutral'
  weight: number       // renormalized over available components (sums to ~1)
  contribution?: number
}

export type PulseBandName = 'Cooling' | 'Neutral' | 'Building' | 'Hot'

export interface Pulse {
  symbol: string
  score: number        // 0-100
  band: PulseBandName
  components: PulseComponent[]
  price?: number
  asOf: string
  kind: 'stock' | 'crypto'
  disclaimer: string
}

// One day of accrued Pulse history (the durable first-party signal series).
export interface PulsePoint {
  date: string
  score: number
  band: PulseBandName
  mood?: string
  price?: number
}

// A named, explainable smart-signal condition (F4).
export interface SignalCondition {
  key: string
  title: string
  detail: string
}

export interface SignalAlerts {
  symbol: string
  pulse: { score: number; band: PulseBandName }
  conditions: SignalCondition[]
  disclaimer: string
}

export type AlertDir = 'above' | 'below'

export interface WatchlistItem {
  symbol: string
  position: number
  target: number
  alert_price: number
  alert_dir: AlertDir
  alert_active: boolean
  kind: 'stock' | 'crypto'
  coin_name?: string
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

export interface AuthUser { id: number; email: string; name: string; email_verified: boolean; plan: 'free' | 'premium' }

export interface WatchlistItemFull extends WatchlistItem {
  watchlist_id: number
  locked: boolean
}

export interface WatchlistWithItems {
  id: number
  name: string
  position: number
  share_token: string | null
  items: WatchlistItemFull[]
}

export interface SymbolHit { symbol: string; description: string; type: string }

export interface SharedWatchlistItem { symbol: string }

export interface SharedWatchlistResponse {
  owner_name: string
  list_name?: string
  items: SharedWatchlistItem[]
}

export interface EarningsRow {
  symbol: string
  date: string
  hour: string
  epsEstimate: number | null
}

export interface SavedScreen {
  id: number
  name: string
  filters: Record<string, string>
}

export interface WatchlistSentiment {
  bullish: number
  bearish: number
  neutral: number
  total: number
  mood: string
}

export interface BillingLimits {
  watchlist: number
  alerts: number
  screens: number
  digest: boolean
  compare: number
}

export interface BillingUsage {
  watchlist: number
  alerts: number
  screens: number
}

export interface BillingState {
  plan: 'free' | 'pro'
  status: string
  is_pro: boolean
  limits: BillingLimits
  usage: BillingUsage
  current_period_end: string | null
  cancel_at_period_end: boolean
}
