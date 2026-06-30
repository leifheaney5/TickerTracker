/**
 * ManageWatchlist tests — covers:
 * - Unauthenticated: sign-in prompt renders
 * - Authenticated: list header renders, new CHG $ column header present
 * - CHG $ cell renders for a ticker row (format-checked, not value-checked)
 * - Sparkline cell is attached in the DOM for each ticker row
 * - Remove button present on ticker rows
 * - Add ticker form is present
 *
 * Route: /watchlist (managewatch view)
 */

import { test, expect } from '@playwright/test'

// ── Fixture helpers ──────────────────────────────────────────────────────────

const envelope = (data: unknown) =>
  JSON.stringify({ data, meta: { source: 'test-mock', stale: false, fetched_at: '' } })

const MOCK_USER = {
  id: 1,
  email: 'test@example.com',
  name: 'Test User',
  email_verified: true,
}

const MOCK_SETTINGS = {
  live_updates: true,
  alert_notifs: true,
  news_digest: false,
  hide_balances: false,
  broker_connected: false,
  broker_name: '',
}

const MOCK_BILLING = {
  is_pro: false,
  usage: { watchlist: 2, alerts: 0, screens: 0 },
  limits: { watchlist: 15, alerts: 5, screens: 3 },
}

/** A watchlist with two tickers so the grid columns are exercised. */
const MOCK_WATCHLISTS = [
  {
    id: 1,
    name: 'My List',
    items: [
      {
        symbol: 'AAPL',
        target: null,
        alert_price: 0,
        alert_active: false,
        locked: false,
        position: 0,
      },
      {
        symbol: 'MSFT',
        target: null,
        alert_price: 0,
        alert_active: false,
        locked: false,
        position: 1,
      },
    ],
  },
]

const MOCK_QUOTES = {
  AAPL: { price: 182.34, change_pct: 0.68, day_open: 181.0, day_high: 184.1, day_low: 181.2, prev_close: 181.1, volume: 52341000 },
  MSFT: { price: 415.20, change_pct: -0.42, day_open: 416.5, day_high: 417.0, day_low: 413.8, prev_close: 416.95, volume: 18230000 },
}

/** All mocks for an anonymous (unauthenticated) session. */
async function mockAnon(page: import('@playwright/test').Page) {
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: null }) })
  )
  await page.route('**/api/auth/providers', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ google: false, apple: false }) })
  )
  await page.route('**/api/watchlist', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: envelope([]) })
  )
  await page.route('**/api/watchlists', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: envelope([]) })
  )
  await page.route('**/api/fng', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: envelope({ value: 50, label: 'Neutral' }) })
  )
  await page.route('**/api/quotes**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: envelope({ quotes: {}, market_status: 'Closed' }) })
  )
  await page.route('**/api/logos**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: envelope({}) })
  )
  await page.route('**/api/history/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: envelope([]) })
  )
}

/** All mocks for an authenticated session with watchlist data. */
async function mockAuthed(page: import('@playwright/test').Page) {
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: MOCK_USER }) })
  )
  await page.route('**/api/auth/providers', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ google: false, apple: false }) })
  )
  await page.route('**/api/watchlist', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: envelope([{ symbol: 'AAPL' }, { symbol: 'MSFT' }]) })
  )
  await page.route('**/api/watchlists', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: envelope(MOCK_WATCHLISTS) })
  )
  await page.route('**/api/quotes**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: envelope({ quotes: MOCK_QUOTES, market_status: 'Open' }),
    })
  )
  await page.route('**/api/fng', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: envelope({ value: 62, label: 'Greed' }) })
  )
  await page.route('**/api/logos**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: envelope({}) })
  )
  await page.route('**/api/settings', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: envelope(MOCK_SETTINGS) })
  )
  await page.route('**/api/holdings', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: envelope([]) })
  )
  await page.route('**/api/billing', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: envelope(MOCK_BILLING) })
  )
  await page.route('**/api/history/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: envelope([]) })
  )
  await page.route('**/api/ratings/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: envelope({ buy: 0, hold: 0, sell: 0, updatedAt: '' }) })
  )
  await page.route('**/api/pulse/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: envelope({}) })
  )
  await page.route('**/api/news**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: envelope([]) })
  )
  await page.route('**/api/fundamentals/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: envelope({}) })
  )
  await page.route('**/api/earnings**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: envelope(null) })
  )
  await page.route('**/api/2fa/status', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ enabled: false }) })
  )
  await page.route('**/api/webauthn/status', (route) =>
    route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'not found' }) })
  )
  await page.route('**/api/push/vapid-public-key', (route) =>
    route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'not found' }) })
  )
  await page.route('**/api/portfolio/pnl', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: envelope(null) })
  )
  await page.route('**/api/portfolio/dividends', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: envelope(null) })
  )
  await page.route('**/api/portfolio/benchmark**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: envelope(null) })
  )
}

// ── Suite ─────────────────────────────────────────────────────────────────────

test.describe('ManageWatchlist — unauthenticated', () => {
  test('shows sign-in prompt when not logged in', async ({ page }) => {
    await mockAnon(page)
    // ManageWatchlist view URL is /watchlist (routes.ts: managewatch → /watchlist)
    await page.goto('/watchlist')
    await expect(page.getByText('Your Watchlist')).toBeVisible()
    await expect(page.getByText(/create a free account/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /sign in \/ sign up/i })).toBeVisible()
  })
})

test.describe('ManageWatchlist — authenticated, grid columns', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthed(page)
  })

  test('watchlist board renders with Manage Watchlists heading', async ({ page }) => {
    await page.goto('/watchlist')
    await expect(page.getByText('Manage Watchlists')).toBeVisible()
  })

  test('grid column headers include CHG $ and CHART (new columns)', async ({ page }) => {
    await page.goto('/watchlist')
    // The list "My List" should render
    await expect(page.getByText('My List')).toBeVisible()
    // New CHG $ and CHART column headers (9-column grid). Use exact matches:
    // 'TICKER' is otherwise a substring of "N tickers" / "Ticker Tracker™".
    await expect(page.getByText('CHG $', { exact: true })).toBeVisible()
    await expect(page.getByText('CHART', { exact: true })).toBeVisible()
    // Pre-existing columns
    await expect(page.getByText('TICKER', { exact: true })).toBeVisible()
    await expect(page.getByText('PRICE', { exact: true })).toBeVisible()
    await expect(page.getByText('TARGET', { exact: true })).toBeVisible()
    await expect(page.getByText('ALERT', { exact: true })).toBeVisible()
  })

  test('CHG $ cells are attached in the DOM for each ticker row', async ({ page }) => {
    await page.goto('/watchlist')
    await expect(page.getByText('My List')).toBeVisible()

    // With live quotes mocked, CHG $ cells should be in the DOM
    await expect(page.getByTestId('chg-dollar-AAPL')).toBeAttached()
    await expect(page.getByTestId('chg-dollar-MSFT')).toBeAttached()
  })

  test('CHG $ cell for positive-change ticker shows + prefix', async ({ page }) => {
    await page.goto('/watchlist')
    await expect(page.getByText('My List')).toBeVisible()

    // AAPL has positive change_pct (0.68%).
    // money(positive) → '$1.24', prepended with '+' → '+$1.24'
    await expect(page.getByTestId('chg-dollar-AAPL')).toHaveText(/^\+\$[\d,]+\.\d{2}$/)
  })

  test('CHG $ cell for negative-change ticker shows dollar-minus format', async ({ page }) => {
    await page.goto('/watchlist')
    await expect(page.getByText('My List')).toBeVisible()

    // MSFT has negative change_pct (-0.42%).
    // money(negative) → '$-1.74' (no extra prefix for negative in this component)
    await expect(page.getByTestId('chg-dollar-MSFT')).toHaveText(/^\$-[\d,]+\.\d{2}$/)
  })

  test('sparkline cells are attached for each ticker row', async ({ page }) => {
    await page.goto('/watchlist')
    await expect(page.getByText('My List')).toBeVisible()

    await expect(page.getByTestId('sparkline-AAPL')).toBeAttached()
    await expect(page.getByTestId('sparkline-MSFT')).toBeAttached()
  })

  test('remove button present on each ticker row', async ({ page }) => {
    await page.goto('/watchlist')
    await expect(page.getByText('My List')).toBeVisible()

    await expect(page.getByRole('button', { name: 'Remove AAPL' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Remove MSFT' })).toBeVisible()
  })

  test('add ticker form is present in each watchlist card', async ({ page }) => {
    await page.goto('/watchlist')
    await expect(page.getByText('My List')).toBeVisible()

    // The add-ticker input
    await expect(page.getByPlaceholder('Add ticker…')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add' })).toBeVisible()
  })

  test('+ New list button is visible', async ({ page }) => {
    await page.goto('/watchlist')
    await expect(page.getByRole('button', { name: '+ New list' })).toBeVisible()
  })
})
