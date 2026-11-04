// Coverage for the Deep Dive "Fundamentals" tab in AtAGlance (/deep-dive).
//
// P0 fix: extended ratio columns (P/S, P/B, PEG, EBITDA, FCF Yld, ROIC,
// Gr. Margin, Net Debt/EBITDA) now render '—' instead of fabricated values,
// and a disclosure footer is shown. Only P/E has a real backend source.
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
  AAPL_FUNDAMENTALS,
} from './fixtures'
import { DeepDivePage } from './pages/DeepDivePage'

// ── Boot-time mock helpers ────────────────────────────────────────────────────

async function mockBootstrap(page: Parameters<Parameters<typeof test.beforeEach>[0]>[0]['page']) {
  // Auth — logged-in user so watchSymbols() returns the user's watchlist.
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ user: AUTH_USER }),
    }),
  )

  // Flat watchlist (App.tsx loads this on auth; AtAGlance uses watchSymbols()).
  await page.route('**/api/watchlist', (route) => {
    if (route.request().method() !== 'GET') return route.continue()
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: envelope([AAPL_ITEM_FULL]),
    })
  })

  // Multi-list watchlists (base GET).
  await page.route('**/api/watchlists', (route) => {
    const url = route.request().url()
    if (url.includes('/items') || url.includes('/share')) return route.continue()
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: envelope(MOCK_WATCHLISTS),
    })
  })

  // Fundamentals — AAPL with a real P/E; no extended ratio fields in the payload
  // (they don't exist on the backend yet — the fix renders '—' for them).
  await page.route('**/api/fundamentals/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: envelope(AAPL_FUNDAMENTALS),
    }),
  )

  // Quotes — required so price/chg functions don't throw on unknown symbols.
  await page.route('**/api/quotes**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: envelope({ quotes: { AAPL: AAPL_QUOTE }, market_status: 'Closed' }),
    }),
  )

  // Sentiment pill shown under the sub-toggle when watchlist has symbols.
  await page.route('**/api/sentiment**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: envelope({ bullish: 1, bearish: 0, neutral: 0, total: 1, mood: 'Bullish' }),
    }),
  )

  // Logos, fng, settings, holdings, billing — suppress external/unrelated calls.
  await page.route('**/api/logos**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: envelope({}) }),
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
  await page.route('**/api/holdings', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: envelope([]) }),
  )
  await page.route('**/api/billing', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: envelope(BILLING_STATE) }),
  )
}

// ── Suite ─────────────────────────────────────────────────────────────────────

test.describe('Deep Dive — Fundamentals tab (/deep-dive)', () => {
  test.beforeEach(async ({ page }) => {
    await mockBootstrap(page)
  })

  // ── 1. Extended ratio cells show '—' and are not numeric ───────────────────

  test('extended ratio columns (P/S through Net Debt/EBITDA) render em-dash and not numbers', async ({ page }) => {
    const dd = new DeepDivePage(page)
    await dd.goto()

    const row = dd.row('AAPL')
    await expect(row).toBeVisible()

    // The 8 extended-ratio columns (everything except P/E) must all show '—'.
    // Exact-text match ensures we do not accidentally match partial text
    // inside numbers or labels.
    const dashCells = dd.extendedRatioCells('AAPL')
    await expect(dashCells).toHaveCount(8)

    // None of the extended cells should contain a digit — confirming no numeric
    // value was fabricated.
    for (let i = 0; i < 8; i++) {
      await expect(dashCells.nth(i)).not.toHaveText(/\d/)
    }
  })

  // ── 2. Disclosure footer is visible ────────────────────────────────────────

  test('disclosure footer "Extended ratios require a premium data feed" is visible', async ({ page }) => {
    const dd = new DeepDivePage(page)
    await dd.goto()

    await expect(dd.disclosureFooter).toBeVisible()
    // Full fixture text from the source.
    await expect(dd.disclosureFooter).toContainText('coming soon')
  })

  // ── 3. P/E renders normally (not '—') ──────────────────────────────────────

  test('P/E column renders a numeric value from the mocked fundamentals payload', async ({ page }) => {
    const dd = new DeepDivePage(page)
    await dd.goto()

    const peCell = dd.peCell('AAPL')
    await expect(peCell).toBeVisible()

    // Assert the cell contains digits — format check, not a hardcoded value.
    // The mock returns pe: 28.5, so the rendered text will be "28.5".
    await expect(peCell).toHaveText(/\d+\.?\d*/)

    // Crucially, P/E must NOT be the em-dash placeholder.
    await expect(peCell).not.toHaveText('—')
  })

  // ── 4. Column headers are present ──────────────────────────────────────────

  test('all Deep Dive column headers render in the table', async ({ page }) => {
    const dd = new DeepDivePage(page)
    await dd.goto()

    const expectedHeaders = ['P/E', 'P/S', 'P/B', 'PEG', 'EBITDA', 'FCF Yld', 'ROIC', 'Gr. Margin', 'Net Debt/EBITDA']
    for (const header of expectedHeaders) {
      await expect(page.getByText(header, { exact: true }).first()).toBeVisible()
    }
  })
})
