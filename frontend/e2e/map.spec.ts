import { test, expect } from '@playwright/test'
import { MapPage } from './pages/MapPage'

// ── Fixture helpers ───────────────────────────────────────────────────────────
// The backend API response envelope: { data, meta: { source, stale, fetched_at } }
const envelope = (data: unknown) =>
  JSON.stringify({ data, meta: { source: 'test-mock', stale: false, fetched_at: '' } })

// ── Suite ─────────────────────────────────────────────────────────────────────
test.describe('Market Map (/map)', () => {
  // Mock every boot-time API call so the suite runs without a live backend and
  // produces identical results regardless of market hours.
  test.beforeEach(async ({ page }) => {
    // Auth — anonymous session
    await page.route('**/api/auth/me', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ user: null }),
      })
    )

    // Watchlist (single + multi-list) — empty
    await page.route('**/api/watchlist', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: envelope([]) })
    )
    await page.route('**/api/watchlists', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: envelope([]) })
    )

    // Fear & Greed — used by MarketViews on mount
    await page.route('**/api/fng', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: envelope({ value: 62, label: 'Greed' }),
      })
    )

    // Quote poll and logos — return empty so no live prices leak into tests
    await page.route('**/api/quotes**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: envelope({ quotes: {}, market_status: 'Closed' }),
      })
    )
    await page.route('**/api/logos**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: envelope({}) })
    )
  })

  // ── Test 1: default state ─────────────────────────────────────────────────

  test('shows Stocks universe by default with tiles from multiple sectors', async ({ page }) => {
    const map = new MapPage(page)
    await map.goto()

    // Universe toggle: "Stocks" should be the active default
    await expect(map.stocksToggle).toBeVisible()

    // Sector chips row is visible in Stocks mode
    await expect(map.sectorChip('All')).toBeVisible()
    await expect(map.sectorChip('Technology')).toBeVisible()
    await expect(map.sectorChip('Energy')).toBeVisible()

    // "All sectors" default: both Technology (AAPL) and Energy (XOM) tiles visible.
    // AAPL market cap 3,280 B → tile covers ~9 % of the 800×460 canvas, always
    // above the 34×22 text-render threshold.
    await expect(map.tileText('AAPL')).toBeVisible()
    await expect(map.tileText('XOM')).toBeVisible()
  })

  // ── Test 2: sector chip filtering ────────────────────────────────────────

  test('Energy chip filters map to energy tickers — AAPL removed, XOM retained', async ({
    page,
  }) => {
    const map = new MapPage(page)
    await map.goto()

    // Confirm default "All sectors" render has both tickers
    await expect(map.tileText('AAPL')).toBeVisible()
    await expect(map.tileText('XOM')).toBeVisible()

    await map.sectorChip('Energy').click()

    // XOM (Energy sector) must remain visible
    await expect(map.tileText('XOM')).toBeVisible()

    // AAPL (Technology) is not in the Energy items list → its <g> is not
    // rendered at all, so assert it is absent from the DOM entirely.
    await expect(map.tileText('AAPL')).not.toBeAttached()
  })

  // ── Test 3: sector chip reset ─────────────────────────────────────────────

  test('clicking All sectors after a filter brings back cross-sector tiles', async ({ page }) => {
    const map = new MapPage(page)
    await map.goto()

    // Filter to Energy so AAPL disappears
    await map.sectorChip('Energy').click()
    await expect(map.tileText('AAPL')).not.toBeAttached()

    // Reset to All — AAPL should return
    await map.sectorChip('All').click()
    await expect(map.tileText('AAPL')).toBeVisible()
    await expect(map.tileText('XOM')).toBeVisible()
  })

  // ── Test 4: tile click navigates to ticker dashboard ─────────────────────

  test('clicking a stock tile navigates to /ticker/<SYM>', async ({ page }) => {
    // Stub downstream dashboard calls so post-navigation requests don't throw
    // unhandled errors in the console (app handles them gracefully, but keeping
    // the test environment clean is good practice).
    await page.route('**/api/fundamentals/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: envelope({}) })
    )
    await page.route('**/api/news**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: envelope([]) })
    )
    await page.route('**/api/ratings/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: envelope({ buy: 0, hold: 0, sell: 0, updatedAt: '' }),
      })
    )
    await page.route('**/api/history/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: envelope([]) })
    )
    await page.route('**/api/pulse/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: envelope({}) })
    )

    const map = new MapPage(page)
    await map.goto()

    // Confirm the tile is present before clicking
    await expect(map.tileText('AAPL')).toBeVisible()

    // Click events bubble from <text> → <g> → onTileClick → setSelected →
    // _navigate('/ticker/AAPL') in the store.
    await map.tileText('AAPL').click()

    await expect(page).toHaveURL(/\/ticker\/AAPL$/)
  })

  // ── Test 5: Crypto toggle hides sector chips ──────────────────────────────

  test('switching to Crypto universe hides sector chips and shows crypto tiles', async ({
    page,
  }) => {
    // Mock the lazy /api/crypto fetch triggered when the Crypto universe mounts.
    await page.route('**/api/crypto**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: envelope({
          coins: [
            {
              id: 'bitcoin',
              symbol: 'BTC',
              name: 'Bitcoin',
              price: 45000,
              market_cap: 880_000_000_000,
              change_pct: 2.1,
            },
            {
              id: 'ethereum',
              symbol: 'ETH',
              name: 'Ethereum',
              price: 3000,
              market_cap: 360_000_000_000,
              change_pct: 1.5,
            },
          ],
          watched: [],
        }),
      })
    )

    const map = new MapPage(page)
    await map.goto()

    // Sector chips are visible in Stocks mode
    await expect(map.sectorChip('Technology')).toBeVisible()
    await expect(map.sectorChip('Energy')).toBeVisible()

    // Switch to Crypto universe
    await map.cryptoToggle.click()

    // Sector chips are conditionally rendered only when universe === 'stocks',
    // so they should be gone from the DOM entirely.
    await expect(map.sectorChip('Technology')).not.toBeAttached()
    await expect(map.sectorChip('Energy')).not.toBeAttached()
    await expect(map.sectorChip('All')).not.toBeAttached()

    // Crypto tiles should appear once /api/crypto mock resolves.
    // BTC: 880 B / (880+360) B = 71 % of canvas → tile ~511×511 px, well above
    // the 34×22 label threshold.
    await expect(map.tileText('BTC')).toBeVisible()
    await expect(map.tileText('ETH')).toBeVisible()
  })

  // ── Test 6: hover tooltip ─────────────────────────────────────────────────

  test('hovering a stock tile reveals the data-treemap-tip tooltip', async ({ page }) => {
    const map = new MapPage(page)
    await map.goto()

    await expect(map.tileText('AAPL')).toBeVisible()

    // onMouseEnter on the <g> fires when the cursor enters the tile area.
    // Playwright moves the mouse from (0,0) into the tile, triggering mouseenter
    // on the parent <g> which sets the tip state and renders the tooltip div.
    await map.tileText('AAPL').hover()

    const tooltip = page.locator('[data-treemap-tip]')
    await expect(tooltip).toBeVisible()
    // Tooltip format: "AAPL · Apple Inc · $214.10 · +2.6%" — assert the ticker
    // appears without hard-coding the live price or change value.
    await expect(tooltip).toContainText('AAPL')
  })
})
