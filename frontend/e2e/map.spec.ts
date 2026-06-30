import { test, expect } from '@playwright/test'
import { MapPage } from './pages/MapPage'

// ── Fixture helpers ───────────────────────────────────────────────────────────
// The backend API response envelope: { data, meta: { source, stale, fetched_at } }
const envelope = (data: unknown) =>
  JSON.stringify({ data, meta: { source: 'test-mock', stale: false, fetched_at: '' } })

const CRYPTO_BODY = envelope({
  coins: [
    { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', price: 45000, market_cap: 880_000_000_000, change_pct: 2.1 },
    { id: 'ethereum', symbol: 'ETH', name: 'Ethereum', price: 3000, market_cap: 360_000_000_000, change_pct: 1.5 },
  ],
  watched: [],
})

// ── Suite ─────────────────────────────────────────────────────────────────────
test.describe('Market Map (/map)', () => {
  // Mock every boot-time API call so the suite runs without a live backend and
  // produces identical results regardless of market hours.
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/auth/me', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: null }) })
    )
    await page.route('**/api/watchlist', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: envelope([]) })
    )
    await page.route('**/api/watchlists', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: envelope([]) })
    )
    await page.route('**/api/fng', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: envelope({ value: 62, label: 'Greed' }) })
    )
    await page.route('**/api/quotes**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: envelope({ quotes: {}, market_status: 'Closed' }) })
    )
    await page.route('**/api/logos**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: envelope({}) })
    )
  })

  // ── Default state ─────────────────────────────────────────────────────────
  test('shows Stocks universe by default with tiles from multiple sectors', async ({ page }) => {
    const map = new MapPage(page)
    await map.goto()

    await expect(map.stocksToggle).toBeVisible()
    await expect(map.sectorChips).toBeVisible()
    await expect(map.exchangeFilter).toBeVisible()

    // "All sectors" default: both Technology (AAPL) and Energy (XOM) tiles render.
    await expect(map.tile('AAPL')).toBeVisible()
    await expect(map.tile('XOM')).toBeVisible()
  })

  // ── Sector chip filtering ──────────────────────────────────────────────────
  test('Energy chip filters map to energy tickers — AAPL removed, XOM retained', async ({ page }) => {
    const map = new MapPage(page)
    await map.goto()

    await expect(map.tile('AAPL')).toBeVisible()
    await expect(map.tile('XOM')).toBeVisible()

    await map.sectorChip('Energy').click()

    await expect(map.tile('XOM')).toBeVisible()
    await expect(map.tile('AAPL')).not.toBeAttached()
  })

  // ── Sector chip reset ───────────────────────────────────────────────────────
  test('clicking All sectors after a filter brings back cross-sector tiles', async ({ page }) => {
    const map = new MapPage(page)
    await map.goto()

    await map.sectorChip('Energy').click()
    await expect(map.tile('AAPL')).not.toBeAttached()

    await map.sectorChip('All').click()
    await expect(map.tile('AAPL')).toBeVisible()
    await expect(map.tile('XOM')).toBeVisible()
  })

  // ── Exchange filter (honest listing-venue facts) ───────────────────────────
  test('NASDAQ exchange filter keeps NASDAQ-listed AAPL, drops NYSE-listed XOM', async ({ page }) => {
    const map = new MapPage(page)
    await map.goto()

    await expect(map.tile('AAPL')).toBeVisible()
    await expect(map.tile('XOM')).toBeVisible()

    await map.exchangeButton('NASDAQ').click()
    await expect(map.tile('AAPL')).toBeVisible()      // AAPL lists on NASDAQ
    await expect(map.tile('XOM')).not.toBeAttached()   // XOM lists on NYSE

    // Switch to NYSE — the inverse now holds.
    await map.exchangeButton('NYSE').click()
    await expect(map.tile('XOM')).toBeVisible()
    await expect(map.tile('AAPL')).not.toBeAttached()
  })

  // ── Stock tile drill-down ───────────────────────────────────────────────────
  test('clicking a stock tile navigates to /ticker/<SYM>', async ({ page }) => {
    await page.route('**/api/fundamentals/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: envelope({}) })
    )
    await page.route('**/api/news**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: envelope([]) })
    )
    await page.route('**/api/ratings/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: envelope({ buy: 0, hold: 0, sell: 0, updatedAt: '' }) })
    )
    await page.route('**/api/history/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: envelope([]) })
    )
    await page.route('**/api/pulse/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: envelope({}) })
    )

    const map = new MapPage(page)
    await map.goto()

    await expect(map.tile('AAPL')).toBeVisible()
    await map.tile('AAPL').click()
    await expect(page).toHaveURL(/\/ticker\/AAPL$/)
  })

  // ── Crypto universe ─────────────────────────────────────────────────────────
  test('switching to Crypto universe hides sector chips and shows crypto tiles', async ({ page }) => {
    await page.route('**/api/crypto**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: CRYPTO_BODY })
    )

    const map = new MapPage(page)
    await map.goto()

    await expect(map.sectorChips).toBeVisible()
    await expect(map.exchangeFilter).toBeVisible()

    await map.cryptoToggle.click()

    await expect(map.sectorChips).not.toBeAttached()
    await expect(map.exchangeFilter).not.toBeAttached()

    await expect(map.tile('BTC')).toBeVisible()
    await expect(map.tile('ETH')).toBeVisible()
  })

  // ── Crypto tile drill-down → Crypto view ───────────────────────────────────
  test('clicking a crypto tile opens the Crypto view', async ({ page }) => {
    await page.route('**/api/crypto**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: CRYPTO_BODY })
    )

    const map = new MapPage(page)
    await map.goto()
    await map.cryptoToggle.click()
    await expect(map.tile('BTC')).toBeVisible()

    await map.tile('BTC').click()
    await expect(page).toHaveURL(/\/crypto$/)
  })

  // ── Hover tooltip ───────────────────────────────────────────────────────────
  test('hovering a stock tile reveals the data-treemap-tip tooltip without a seed price', async ({ page }) => {
    const map = new MapPage(page)
    await map.goto()

    await expect(map.tile('AAPL')).toBeVisible()
    await map.tile('AAPL').hover()

    const tooltip = page.locator('[data-treemap-tip]')
    await expect(tooltip).toBeVisible()
    await expect(tooltip).toContainText('AAPL')
    // Accurate-numbers rule: with quotes mocked empty, no seed price is shown.
    await expect(tooltip).not.toContainText('$')
  })
})
