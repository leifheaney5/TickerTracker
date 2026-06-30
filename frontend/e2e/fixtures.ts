// Shared test fixtures and mock-fulfillment helpers used across e2e specs.
// Keep this file free of Playwright test imports — it is a pure data/helper module.

/** Wrap any data value in the backend API response envelope. */
export const envelope = (data: unknown): string =>
  JSON.stringify({ data, meta: { source: 'test-mock', stale: false, fetched_at: '' } })

/** A logged-in free-tier user returned by /api/auth/me. */
export const AUTH_USER = {
  id: 1,
  email: 'test@example.com',
  name: 'Test User',
  email_verified: true,
  plan: 'free' as const,
}

/** Default mock billing state. */
export const BILLING_STATE = {
  plan: 'free',
  status: 'active',
  is_pro: false,
  limits: { watchlist: 15, alerts: 5, screens: 3, digest: false, compare: 2 },
  usage: { watchlist: 1, alerts: 0, screens: 0 },
  current_period_end: null,
  cancel_at_period_end: false,
}

/** Default mock settings. */
export const SETTINGS = {
  broker_connected: false,
  broker_name: '',
  live_updates: false,
  alert_notifs: false,
  news_digest: false,
  hide_balances: false,
  currency: 'USD',
}

/** A single AAPL watchlist item with alert_dir: 'above' (the default). */
export const AAPL_ITEM_FULL = {
  symbol: 'AAPL',
  position: 0,
  target: 0,
  alert_price: 0,
  alert_dir: 'above' as const,
  alert_active: false,
  kind: 'stock' as const,
  watchlist_id: 1,
  locked: false,
}

/** A single multi-list watchlist containing AAPL with alert_dir 'above'. */
export const MOCK_WATCHLISTS = [
  {
    id: 1,
    name: 'My Watchlist',
    position: 0,
    share_token: null,
    items: [AAPL_ITEM_FULL],
  },
]

/** Mocked AAPL quote data (price format: $182.34 territory). */
export const AAPL_QUOTE = {
  price: 182.34,
  change_pct: 0.68,
  day_open: 181.0,
  day_high: 184.1,
  day_low: 181.2,
  prev_close: 181.11,
  volume: 52341000,
}

/** Mocked AAPL fundamentals — P/E populated, no extended ratios. */
export const AAPL_FUNDAMENTALS = {
  pe: 28.5,
  market_cap: 2_800_000_000_000,
  sector: 'Technology',
  industry: 'Consumer Electronics',
  week52_high: 199.62,
  week52_low: 164.08,
  all_time_high: 199.62,
  all_time_low: 0.49,
  beta: 1.24,
  dividend_yield: 0.0055,
  eps: 6.43,
  website: 'apple.com',
}
