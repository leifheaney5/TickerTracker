/**
 * Holdings view tests — covers:
 * - Unauthenticated: "Sign in to track your portfolio" prompt shown
 * - Authenticated + connected: benchmark panel renders with mocked data
 * - Benchmark panel disclaimer is visible
 * - Benchmark timeframe toggle buttons all present
 * - Benchmark index toggle SPY/QQQ present
 * - Dividends panel renders with mocked data
 * - Dividends panel shows correct status labels
 * - Allocation toggle switches between Position / Sector / Asset Class modes
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

/** Settings: broker connected so Holdings shows main content. */
const MOCK_SETTINGS = {
  live_updates: true,
  alert_notifs: true,
  news_digest: false,
  hide_balances: false,
  broker_connected: true,
  broker_name: 'Demo Brokerage',
}

/** Holdings: two positions so the view has data to display. */
const MOCK_HOLDINGS = [
  { symbol: 'AAPL', shares: 10, avg_cost: 150.0 },
  { symbol: 'MSFT', shares: 5, avg_cost: 280.0 },
]

const MOCK_BILLING = {
  is_pro: false,
  usage: { watchlist: 2, alerts: 0, screens: 0 },
  limits: { watchlist: 15, alerts: 5, screens: 3 },
}

const MOCK_BENCHMARK = {
  dates: ['2024-01-01', '2024-02-01', '2024-03-01'],
  portfolio_pct: [0, 5.2, 8.1],
  benchmark_pct: [0, 3.1, 5.4],
  index: 'SPY',
  disclaimer: 'Benchmark comparison is for informational purposes only. Past performance does not guarantee future results.',
}

const MOCK_DIVIDENDS = {
  annual_income_estimate: 142.5,
  rows: [
    { symbol: 'AAPL', ex_date: '2024-02-09', pay_date: '2024-02-15', per_share: 0.24, total: 2.4, status: 'paid' },
    { symbol: 'MSFT', ex_date: '2024-05-15', pay_date: '2024-06-13', per_share: 0.75, total: 3.75, status: 'upcoming' },
  ],
}

const MOCK_PNL = {
  totals: {
    market_value: 3250.0,
    cost_basis: 2900.0,
    daily_pnl: 42.5,
    realized_pnl: 120.0,
    fees_paid: 0,
  },
}

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

/** Single flat helper for authenticated Holdings tests. */
async function mockAuthed(page: import('@playwright/test').Page) {
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: MOCK_USER }) })
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
    route.fulfill({ status: 200, contentType: 'application/json', body: envelope({ value: 60, label: 'Greed' }) })
  )
  await page.route('**/api/quotes**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: envelope({ quotes: {}, market_status: 'Closed' }) })
  )
  await page.route('**/api/logos**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: envelope({}) })
  )
  await page.route('**/api/settings', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: envelope(MOCK_SETTINGS) })
  )
  await page.route('**/api/holdings', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: envelope(MOCK_HOLDINGS) })
  )
  await page.route('**/api/billing', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: envelope(MOCK_BILLING) })
  )
  await page.route('**/api/portfolio/pnl', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: envelope(MOCK_PNL) })
  )
  await page.route('**/api/portfolio/dividends', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: envelope(MOCK_DIVIDENDS) })
  )
  await page.route('**/api/portfolio/benchmark**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: envelope(MOCK_BENCHMARK) })
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
}

// ── Suite ─────────────────────────────────────────────────────────────────────

test.describe('Holdings view — unauthenticated', () => {
  test('shows sign-in prompt when not logged in', async ({ page }) => {
    await mockAnon(page)
    await page.goto('/holdings')
    await expect(page.getByText('Sign in to track your portfolio')).toBeVisible()
    await expect(page.getByRole('button', { name: /sign up free/i })).toBeVisible()
  })
})

test.describe('Holdings view — authenticated + connected', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthed(page)
  })

  test('benchmark panel renders with mocked data', async ({ page }) => {
    await page.goto('/holdings')
    await expect(page.getByTestId('benchmark-panel')).toBeVisible()
    await expect(page.getByText('Portfolio vs Benchmark')).toBeVisible()
  })

  test('benchmark disclaimer is visible inside the chart', async ({ page }) => {
    await page.goto('/holdings')
    await expect(page.getByTestId('benchmark-panel')).toBeVisible()
    await expect(page.getByText(/informational purposes/i)).toBeVisible()
  })

  test('benchmark timeframe toggle buttons all present', async ({ page }) => {
    await page.goto('/holdings')
    await expect(page.getByTestId('benchmark-panel')).toBeVisible()

    for (const tf of ['1m', '3m', '1y', '5y']) {
      await expect(page.getByTestId(`benchmark-tf-${tf}`)).toBeVisible()
    }

    // Clicking 3M keeps the panel visible (re-fetches with new timeframe)
    await page.getByTestId('benchmark-tf-3m').click()
    await expect(page.getByTestId('benchmark-panel')).toBeVisible()
  })

  test('benchmark index toggle SPY/QQQ present, switching index keeps panel visible', async ({ page }) => {
    await page.goto('/holdings')
    await expect(page.getByTestId('benchmark-panel')).toBeVisible()

    await expect(page.getByTestId('benchmark-index-spy')).toBeVisible()
    await expect(page.getByTestId('benchmark-index-qqq')).toBeVisible()

    await page.getByTestId('benchmark-index-qqq').click()
    await expect(page.getByTestId('benchmark-panel')).toBeVisible()
  })

  test('dividends panel renders with estimated annual income', async ({ page }) => {
    await page.goto('/holdings')

    await expect(page.getByTestId('dividends-panel')).toBeVisible()
    await expect(page.getByText('Dividends')).toBeVisible()
    await expect(page.getByTestId('dividend-annual-estimate')).toBeVisible()
    await expect(page.getByTestId('dividend-annual-estimate')).toHaveText(/\$[\d,]+\.\d{2}/)
  })

  test('dividends panel shows dividend rows with correct status labels', async ({ page }) => {
    await page.goto('/holdings')

    await expect(page.getByTestId('dividends-panel')).toBeVisible()
    await expect(page.getByText('Paid')).toBeVisible()
    await expect(page.getByText('Upcoming')).toBeVisible()
  })

  test('allocation toggle switches between Position, Sector, and Asset Class modes', async ({ page }) => {
    await page.goto('/holdings')

    // All three mode buttons should be visible
    await expect(page.getByTestId('alloc-mode-position')).toBeVisible()
    await expect(page.getByTestId('alloc-mode-sector')).toBeVisible()
    await expect(page.getByTestId('alloc-mode-asset-class')).toBeVisible()

    // Default: Position mode — donut center label reads "positions"
    await expect(page.getByTestId('alloc-center-label')).toHaveText('positions')

    // Switch to Sector
    await page.getByTestId('alloc-mode-sector').click()
    await expect(page.getByTestId('alloc-center-label')).toHaveText('groups')

    // Switch to Asset Class
    await page.getByTestId('alloc-mode-asset-class').click()
    await expect(page.getByTestId('alloc-center-label')).toHaveText('groups')

    // Switch back to Position
    await page.getByTestId('alloc-mode-position').click()
    await expect(page.getByTestId('alloc-center-label')).toHaveText('positions')
  })
})
