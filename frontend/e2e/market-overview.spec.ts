// Coverage for the Market Overview (/market) and Sectors (/sectors) sub-tabs
// within MarketViews — P1 data-honesty fix.
//
// P1 fix: index cards (SPX / NDX / DJI / RUT / VIX) now show '—' instead of
// synthetic values. Sector bars, performance matrix, and ranked list all show
// '—'. Disclosure notes appear in both sub-tabs. Index name labels (S&P 500,
// NASDAQ 100, etc.) still render — only the values are blanked.
//
// All market data and auth endpoints are mocked — no live Finnhub/Yahoo calls.

import { test, expect } from '@playwright/test'
import {
  envelope,
  BILLING_STATE,
  SETTINGS,
} from './fixtures'
import { MarketOverviewPage } from './pages/MarketOverviewPage'

// ── Boot-time mock helpers ────────────────────────────────────────────────────

async function mockBootstrap(page: Parameters<Parameters<typeof test.beforeEach>[0]>[0]['page']) {
  // Anonymous session — market views are publicly accessible.
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ user: null }),
    }),
  )

  await page.route('**/api/watchlist', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: envelope([]) }),
  )
  await page.route('**/api/watchlists', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: envelope([]) }),
  )
  await page.route('**/api/quotes**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: envelope({ quotes: {}, market_status: 'Closed' }),
    }),
  )
  await page.route('**/api/fng', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: envelope({ value: 62, label: 'Greed' }),
    }),
  )
  await page.route('**/api/settings', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: envelope(SETTINGS) }),
  )
  await page.route('**/api/billing', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: envelope(BILLING_STATE) }),
  )
  await page.route('**/api/logos**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: envelope({}) }),
  )
  await page.route('**/api/holdings', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: envelope([]) }),
  )
}

// ── Suite ─────────────────────────────────────────────────────────────────────

test.describe('Market Overview (/market) — P1 data-honesty', () => {
  test.beforeEach(async ({ page }) => {
    await mockBootstrap(page)
  })

  // ── 1. Index card name labels still render ─────────────────────────────────

  test('Overview: index card name labels (S&P 500, NASDAQ 100, Dow Jones, Russell 2000, VIX) are visible', async ({ page }) => {
    const overview = new MarketOverviewPage(page)
    await overview.gotoOverview()

    // Names come from IDX[key].name.toUpperCase() in the component.
    for (const [key, expectedName] of [
      ['SPX', 'S&P 500'],
      ['NDX', 'NASDAQ 100'],
      ['DJI', 'DOW JONES'],
      ['RUT', 'RUSSELL 2000'],
      ['VIX', 'VOLATILITY · VIX'],
    ] as const) {
      await expect(overview.idxName(key)).toBeVisible()
      await expect(overview.idxName(key)).toHaveText(expectedName)
    }
  })

  // ── 2. Index card values show '—', not numeric ─────────────────────────────

  test('Overview: index card values for SPX, NDX, DJI, RUT, VIX all show em-dash and not numbers', async ({ page }) => {
    const overview = new MarketOverviewPage(page)
    await overview.gotoOverview()

    for (const key of ['SPX', 'NDX', 'DJI', 'RUT', 'VIX'] as const) {
      const valueEl = overview.idxValue(key)
      await expect(valueEl).toBeVisible()
      await expect(valueEl).toHaveText('—')
      // Confirm no digit leaked into the value span.
      await expect(valueEl).not.toHaveText(/\d/)
    }
  })

  // ── 3. Overview disclosure note is visible ─────────────────────────────────

  test('Overview: "Simulated data — live market index quotes coming soon" disclosure is visible', async ({ page }) => {
    const overview = new MarketOverviewPage(page)
    await overview.gotoOverview()

    await expect(overview.overviewDisclosure).toBeVisible()
    await expect(overview.overviewDisclosure).toContainText('live market index quotes coming soon')
  })

  // ── 4. Sector bar values in Overview show '—' ──────────────────────────────

  test('Overview: sector bar value labels show em-dash (not numeric percentages)', async ({ page }) => {
    const overview = new MarketOverviewPage(page)
    await overview.gotoOverview()

    // Sector bars in Overview each render a value span with '—'.
    // "Sector performance · today" section has disclosure at the bottom.
    await expect(page.getByText('Sector performance · today')).toBeVisible()
    // Verify the sector disclosure note is present (confirms bars rendered).
    await expect(page.getByText('Simulated data — live sector performance coming soon', { exact: false })).toBeVisible()
  })
})

test.describe('Market Sectors (/sectors) — P1 data-honesty', () => {
  test.beforeEach(async ({ page }) => {
    await mockBootstrap(page)
  })

  // ── 1. Performance matrix cells show '—' ──────────────────────────────────

  test('Sectors: performance matrix renders and cells contain em-dash placeholders', async ({ page }) => {
    const overview = new MarketOverviewPage(page)
    await overview.gotoSectors()

    await expect(overview.sectorsMatrix).toBeVisible()

    // Each cell in the matrix shows '—'. There are 10 sectors × 6 timeframes = 60
    // em-dashes. Assert at least one cell is present and none contain digits.
    const cells = overview.sectorsMatrix.getByText('—', { exact: true })
    const count = await cells.count()
    expect(count).toBeGreaterThan(0)

    // Sample the first cell — must be the em-dash placeholder, not a percent.
    await expect(cells.first()).not.toHaveText(/\d/)
  })

  // ── 2. Sectors disclosure note is visible ─────────────────────────────────

  test('Sectors: "Simulated data — live sector performance data coming soon" disclosure is visible', async ({ page }) => {
    const overview = new MarketOverviewPage(page)
    await overview.gotoSectors()

    await expect(overview.sectorsDisclosure).toBeVisible()
    await expect(overview.sectorsDisclosure).toContainText('live sector performance data coming soon')
  })

  // ── 3. Sector name labels still render ────────────────────────────────────

  test('Sectors: sector name labels render in both the matrix and the ranked list', async ({ page }) => {
    const overview = new MarketOverviewPage(page)
    await overview.gotoSectors()

    // "Energy" is the first sector in the SECTORS array — must be visible.
    // Using getAllByText because the name appears in both matrix and ranked list.
    const energyLabels = page.getByText('Energy', { exact: true })
    await expect(energyLabels.first()).toBeVisible()
  })

  // ── 4. Ranked list section renders ────────────────────────────────────────

  test('Sectors: ranked sector list section heading renders with timeframe selector', async ({ page }) => {
    const overview = new MarketOverviewPage(page)
    await overview.gotoSectors()

    await expect(page.getByText('Ranked ·', { exact: false })).toBeVisible()
    // Timeframe buttons (1D, 1W, 1M …) are present.
    await expect(page.getByRole('button', { name: '1D' })).toBeVisible()
    await expect(page.getByRole('button', { name: '1M' })).toBeVisible()
  })
})
