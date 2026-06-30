// Coverage for the alert direction toggle (↑ Above / ↓ Below) in TickerRow
// inside the ManageWatchlist view (/watchlist).
//
// All market data and auth endpoints are mocked — no live Finnhub/Yahoo calls.

import { test, expect } from '@playwright/test'
import {
  envelope,
  AUTH_USER,
  BILLING_STATE,
  SETTINGS,
  AAPL_ITEM_FULL,
  MOCK_WATCHLISTS,
  AAPL_QUOTE,
} from './fixtures'
import { ManageWatchlistPage } from './pages/ManageWatchlistPage'

// ── Boot-time mock helpers ────────────────────────────────────────────────────

/** Register all API mocks that every test in this file needs.
 *  Call inside test.beforeEach — individual tests layer on top via page.route
 *  (Playwright routes registered later take priority over earlier ones). */
async function mockBootstrap(page: Parameters<Parameters<typeof test.beforeEach>[0]>[0]['page']) {
  // Auth — logged-in user so the watchlist view renders (not the sign-in gate).
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ user: AUTH_USER }),
    }),
  )

  // Flat watchlist (legacy endpoint, loaded alongside multi-list).
  await page.route('**/api/watchlist', (route) => {
    // Only intercept the base path, not PATCH /api/watchlist/AAPL.
    if (route.request().method() !== 'GET') return route.continue()
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: envelope([AAPL_ITEM_FULL]),
    })
  })

  // Multi-list watchlists (base GET only; item PATCH routes are handled per-test).
  await page.route('**/api/watchlists', (route) => {
    const url = route.request().url()
    // Let sub-resource calls (items, share) fall through to per-test mocks.
    if (url.includes('/items') || url.includes('/share')) return route.continue()
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: envelope(MOCK_WATCHLISTS),
    })
  })

  // Quotes — deterministic price data, format: $182.34.
  await page.route('**/api/quotes**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: envelope({ quotes: { AAPL: AAPL_QUOTE }, market_status: 'Closed' }),
    }),
  )

  // Logos — empty map so we don't trigger external image fetches.
  await page.route('**/api/logos**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: envelope({}),
    }),
  )

  // Fear & Greed (loaded by App shell).
  await page.route('**/api/fng', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: envelope({ value: 62, label: 'Greed' }),
    }),
  )

  // Settings, holdings, billing — required by App.tsx on auth load.
  await page.route('**/api/settings', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: envelope(SETTINGS),
    }),
  )
  await page.route('**/api/holdings', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: envelope([]),
    }),
  )
  await page.route('**/api/billing', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: envelope(BILLING_STATE),
    }),
  )
}

// ── Suite ─────────────────────────────────────────────────────────────────────

test.describe('Alert direction toggle (/watchlist TickerRow)', () => {
  test.beforeEach(async ({ page }) => {
    await mockBootstrap(page)
  })

  // ── 1. Both buttons render ──────────────────────────────────────────────────

  test('both ↑ Above and ↓ Below buttons render for a watchlist ticker', async ({ page }) => {
    const wl = new ManageWatchlistPage(page)
    await wl.goto()

    await expect(wl.alertDirAbove('AAPL')).toBeVisible()
    await expect(wl.alertDirBelow('AAPL')).toBeVisible()
  })

  // ── 2. Default state ────────────────────────────────────────────────────────

  test('default state: "above" is aria-pressed=true, "below" is aria-pressed=false', async ({ page }) => {
    const wl = new ManageWatchlistPage(page)
    await wl.goto()

    // Fixture sets alert_dir: 'above' — verify aria-pressed reflects this.
    await expect(wl.alertDirAbove('AAPL')).toHaveAttribute('aria-pressed', 'true')
    await expect(wl.alertDirBelow('AAPL')).toHaveAttribute('aria-pressed', 'false')
  })

  // ── 3. Clicking "below" toggles aria-pressed and fires PATCH ───────────────

  test('clicking "↓ Below" sets aria-pressed on below, clears above, and sends PATCH {alert_dir:"below"}', async ({ page }) => {
    // Capture the PATCH payload sent to the list-item endpoint.
    let capturedBody: Record<string, unknown> | null = null

    await page.route('**/api/watchlists/*/items/**', (route) => {
      if (route.request().method() === 'PATCH') {
        capturedBody = JSON.parse(route.request().postData() ?? '{}') as Record<string, unknown>
      }
      // Respond with the updated item reflecting alert_dir: 'below'.
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: envelope({ ...AAPL_ITEM_FULL, alert_dir: 'below' }),
      })
    })

    const wl = new ManageWatchlistPage(page)
    await wl.goto()

    // Pre-condition: 'above' is selected.
    await expect(wl.alertDirAbove('AAPL')).toHaveAttribute('aria-pressed', 'true')
    await expect(wl.alertDirBelow('AAPL')).toHaveAttribute('aria-pressed', 'false')

    await wl.alertDirBelow('AAPL').click()

    // Optimistic UI update happens synchronously before the network round-trip.
    await expect(wl.alertDirBelow('AAPL')).toHaveAttribute('aria-pressed', 'true')
    await expect(wl.alertDirAbove('AAPL')).toHaveAttribute('aria-pressed', 'false')

    // Verify the correct payload was sent to the backend.
    expect(capturedBody).toMatchObject({ alert_dir: 'below' })
  })

  // ── 4. Keyboard operability ─────────────────────────────────────────────────

  test('direction buttons are real <button> elements — keyboard focus + Space activates them', async ({ page }) => {
    let capturedBody: Record<string, unknown> | null = null

    await page.route('**/api/watchlists/*/items/**', (route) => {
      if (route.request().method() === 'PATCH') {
        capturedBody = JSON.parse(route.request().postData() ?? '{}') as Record<string, unknown>
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: envelope({ ...AAPL_ITEM_FULL, alert_dir: 'below' }),
      })
    })

    const wl = new ManageWatchlistPage(page)
    await wl.goto()

    const belowBtn = wl.alertDirBelow('AAPL')

    // Verify it is a native <button> (not a div or span masquerading as one).
    await expect(belowBtn).toHaveJSProperty('tagName', 'BUTTON')

    // Focus the button and activate via Space — the standard keyboard interaction
    // for a toggle button (aria-pressed pattern).
    await belowBtn.focus()
    await expect(belowBtn).toBeFocused()
    await page.keyboard.press('Space')

    await expect(belowBtn).toHaveAttribute('aria-pressed', 'true')
    await expect(wl.alertDirAbove('AAPL')).toHaveAttribute('aria-pressed', 'false')
    expect(capturedBody).toMatchObject({ alert_dir: 'below' })
  })
})
