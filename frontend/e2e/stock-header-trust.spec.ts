// Coverage for the trust-signal changes shipped in StockHeader.tsx (commit b6c20d0):
//
//  1. Market-status pill — data-driven from backend market_status field; maps
//     "Market Open" → OPEN, "Pre-Market" → PRE-MARKET, "After-Hours" → AFTER-HOURS,
//     "Closed (Weekend)" → CLOSED.  No pill for "Unknown".
//  2. "as of HH:MM" freshness label — renders once quotesFetchedAt is set.
//  3. Price element wraps in role="status" aria-live="polite" aria-atomic="true".
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
import { StockHeaderPage } from './pages/StockHeaderPage'

// ── Boot-time mock helpers ────────────────────────────────────────────────────

type PageParam = Parameters<Parameters<typeof test.beforeEach>[0]>[0]['page']

/** Register all baseline API mocks needed for the Dashboard/StockHeader to render.
 *  The /api/quotes route is intentionally left out here so each test can supply its
 *  own market_status variant via page.route (Playwright's last-registered route wins). */
async function mockBootstrap(page: PageParam) {
  // Auth — logged-in user so watchlist + StockHeader render (not the sign-in gate).
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ user: AUTH_USER }),
    }),
  )

  // Flat watchlist (legacy endpoint loaded by App on auth).
  await page.route('**/api/watchlist', (route) => {
    if (route.request().method() !== 'GET') return route.continue()
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: envelope([AAPL_ITEM_FULL]),
    })
  })

  // Multi-list watchlists.
  await page.route('**/api/watchlists', (route) => {
    const url = route.request().url()
    if (url.includes('/items') || url.includes('/share')) return route.continue()
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: envelope(MOCK_WATCHLISTS),
    })
  })

  // Fundamentals — needed by loadFundamentals() called in Dashboard.useEffect.
  await page.route('**/api/fundamentals/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: envelope(AAPL_FUNDAMENTALS),
    }),
  )

  // History — Dashboard calls loadHistory() on symbol change.
  await page.route('**/api/history/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: envelope([]),
    }),
  )

  // News — NewsCard inside Dashboard.
  await page.route('**/api/news**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: envelope([]),
    }),
  )

  // Pulse / signal-alerts — PulseWhy inside Dashboard.
  await page.route('**/api/pulse/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: envelope(null),
    }),
  )

  // Ratings — DueDiligence inside Dashboard.
  await page.route('**/api/ratings/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: envelope(null),
    }),
  )

  // Sentiment — AtAGlance sub-tab (not visible on dashboard, but the request fires).
  await page.route('**/api/sentiment**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: envelope({ bullish: 0, bearish: 0, neutral: 0, total: 0, mood: 'Neutral' }),
    }),
  )

  // Logos — suppress external image fetches.
  await page.route('**/api/logos**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: envelope({}) }),
  )

  // Fear & Greed (App shell).
  await page.route('**/api/fng', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: envelope({ value: 62, label: 'Greed' }),
    }),
  )

  // Settings, holdings, billing.
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

/** Build a /api/quotes mock body with the given market_status.
 *  Uses a custom envelope so we can inject a non-empty fetched_at when needed. */
function quotesMockBody(marketStatus: string, fetchedAt = ''): string {
  return JSON.stringify({
    data: { quotes: { AAPL: AAPL_QUOTE }, market_status: marketStatus },
    meta: { source: 'test-mock', stale: false, fetched_at: fetchedAt },
  })
}

// ── Suite ─────────────────────────────────────────────────────────────────────

test.describe('StockHeader — trust-signal behavior (/ticker/AAPL)', () => {
  test.beforeEach(async ({ page }) => {
    await mockBootstrap(page)
  })

  // ── 1. "Market Open" → OPEN pill with correct aria-label ───────────────────

  test('market_status "Market Open" renders an OPEN pill with aria-label="Market status: OPEN"', async ({ page }) => {
    await page.route('**/api/quotes**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: quotesMockBody('Market Open'),
      }),
    )

    const header = new StockHeaderPage(page)
    await header.goto('AAPL')

    // Wait for price to confirm quotes landed (pill appears only when live === true
    // AND market_status maps to a known label).
    await expect(header.priceContainer).toBeVisible()

    // Pill text must be "OPEN".
    await expect(header.pillWithLabel('OPEN')).toBeVisible()
    await expect(header.pillWithLabel('OPEN')).toHaveText('OPEN')

    // aria-label is the machine-readable handle used by assistive tech.
    await expect(header.pillWithLabel('OPEN')).toHaveAttribute('aria-label', 'Market status: OPEN')
  })

  // ── 2. "Closed (Weekend)" → CLOSED pill — proves status is data-driven ────

  test('market_status "Closed (Weekend)" renders a CLOSED pill with aria-label="Market status: CLOSED"', async ({ page }) => {
    await page.route('**/api/quotes**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: quotesMockBody('Closed (Weekend)'),
      }),
    )

    const header = new StockHeaderPage(page)
    await header.goto('AAPL')

    await expect(header.priceContainer).toBeVisible()

    // The pill must show "CLOSED" — the label is mapped from the backend value,
    // not the backend string itself; this guards against hardcoding.
    await expect(header.pillWithLabel('CLOSED')).toBeVisible()
    await expect(header.pillWithLabel('CLOSED')).toHaveText('CLOSED')
    await expect(header.pillWithLabel('CLOSED')).toHaveAttribute('aria-label', 'Market status: CLOSED')
  })

  // ── 3. "Unknown" → no market-status pill renders ──────────────────────────

  test('market_status "Unknown" suppresses the market-status pill entirely', async ({ page }) => {
    await page.route('**/api/quotes**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: quotesMockBody('Unknown'),
      }),
    )

    const header = new StockHeaderPage(page)
    await header.goto('AAPL')

    // Wait for the price container — confirms the quote round-trip has completed
    // and the store has updated (market_status = "Unknown" is in the store now).
    // Only then is it safe to assert the pill's absence.
    await expect(header.priceContainer).toBeVisible()

    // No pill should be in the DOM — count must be exactly 0.
    await expect(header.marketStatusPill).toHaveCount(0)
  })

  // ── 4. Price element exposes correct ARIA live-region attributes ───────────

  test('price element has role="status", aria-live="polite", aria-atomic="true", and renders a dollar-format price', async ({ page }) => {
    await page.route('**/api/quotes**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: quotesMockBody('Market Open'),
      }),
    )

    const header = new StockHeaderPage(page)
    await header.goto('AAPL')

    const price = header.priceContainer
    await expect(price).toBeVisible()

    // Verify all three ARIA live-region attributes are present and correct.
    await expect(price).toHaveAttribute('role', 'status')
    await expect(price).toHaveAttribute('aria-live', 'polite')
    await expect(price).toHaveAttribute('aria-atomic', 'true')

    // Assert price format only — never assert a specific live value.
    // money() produces "$X,XXX.XX" — regex allows any dollar figure.
    await expect(price).toHaveText(/^\$[\d,]+\.\d{2}$/)
  })

  // ── 5. "as of HH:MM" freshness label appears once quotes load ─────────────

  test('"as of HH:MM" freshness label is visible after quotes load and matches a time format', async ({ page }) => {
    // Provide a real ISO timestamp so quotesFetchedAt is truthy in the store,
    // which gates the conditional {quotesFetchedAt && <span>asOf(...)}.
    const mockTimestamp = '2026-01-15T14:30:00.000Z'

    await page.route('**/api/quotes**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: quotesMockBody('Market Open', mockTimestamp),
      }),
    )

    const header = new StockHeaderPage(page)
    await header.goto('AAPL')

    await expect(header.priceContainer).toBeVisible()

    // The label should be visible now that fetched_at is non-empty.
    await expect(header.asOfLabel).toBeVisible()

    // asOf() returns "as of HH:MM" — assert the prefix + time pattern; never
    // assert the exact clock string (it's locale-formatted from the timestamp).
    await expect(header.asOfLabel).toHaveText(/^as of \d{1,2}:\d{2}/)
  })
})
