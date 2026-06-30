import { test, expect } from '@playwright/test'
import { MobileNavPage } from './pages/MobileNavPage'

// ── Viewport ─────────────────────────────────────────────────────────────────
// 390 × 844 = iPhone 14 logical pixels — comfortably below the 768 px
// useIsMobile breakpoint so the hamburger layout renders.
const MOBILE_VIEWPORT = { width: 390, height: 844 }

// ── Fixture helpers ───────────────────────────────────────────────────────────
// Wrap data in the standard backend response envelope.
const envelope = (data: unknown) =>
  JSON.stringify({ data, meta: { source: 'test-mock', stale: false, fetched_at: '' } })

// Mocked auth responses — shapes match AuthUser in api/types.ts.
const AUTHED_BODY = JSON.stringify({
  user: {
    id: 1,
    email: 'playwright@example.com',
    name: 'Playwright Tester',
    email_verified: true,
    plan: 'free',
  },
})
const ANON_BODY = JSON.stringify({ user: null })

// Common boot-time routes: auth check + every endpoint the store fetches on
// mount. All mocked so tests never call Finnhub / Yahoo Finance / real backend
// and produce identical results regardless of market hours.
async function mockBootstrap(
  page: Parameters<Parameters<typeof test>[1]>[0]['page'],
  authBody: string,
) {
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: authBody }),
  )
  await page.route('**/api/watchlist', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: envelope([]) }),
  )
  await page.route('**/api/watchlists', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: envelope([]) }),
  )
  await page.route('**/api/fng', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: envelope({ value: 62, label: 'Greed' }),
    }),
  )
  await page.route('**/api/quotes**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: envelope({ quotes: {}, market_status: 'Closed' }),
    }),
  )
  await page.route('**/api/logos**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: envelope({}) }),
  )
  // Settings and billing are fetched when the user is authed; 404 is fine for
  // anon but a 200 with sensible defaults is harmless for both branches.
  await page.route('**/api/settings', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: envelope({ broker_connected: false }),
    }),
  )
  await page.route('**/api/billing', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: envelope({ plan: 'free', status: 'active' }),
    }),
  )
}

// ── Suite ─────────────────────────────────────────────────────────────────────
test.describe('Mobile nav — hamburger + alerts IA', () => {
  // Force a phone-sized viewport for every test so the mobile Header branch
  // renders. Desktop layout shows a different nav; these tests are irrelevant
  // there and would fail to find the hamburger button.
  test.use({ viewport: MOBILE_VIEWPORT })

  // ── Test 1: authed user sees Alerts button in open menu ───────────────────
  test('authed: hamburger menu exposes the Alerts nav button', async ({ page }) => {
    await mockBootstrap(page, AUTHED_BODY)
    const nav = new MobileNavPage(page)
    await nav.goto()

    // Menu is collapsed initially — Alerts button not yet in DOM.
    await expect(nav.alertsNavButton).not.toBeAttached()

    await nav.openMenu()

    // After opening the menu the Alerts button must be visible.
    await expect(nav.alertsNavButton).toBeVisible()
  })

  // ── Test 2: anonymous user never sees Alerts button ───────────────────────
  test('anonymous: hamburger menu omits the Alerts nav button', async ({ page }) => {
    await mockBootstrap(page, ANON_BODY)
    const nav = new MobileNavPage(page)
    await nav.goto()
    await nav.openMenu()

    // The Alerts button is guarded by {authed && …} — must not exist in DOM.
    await expect(nav.alertsNavButton).not.toBeAttached()
  })

  // ── Test 3: clicking Alerts navigates to /alerts ──────────────────────────
  test('clicking mobile-nav-alerts navigates to the Alerts view', async ({ page }) => {
    await mockBootstrap(page, AUTHED_BODY)
    const nav = new MobileNavPage(page)
    await nav.goto()
    await nav.openMenu()
    await expect(nav.alertsNavButton).toBeVisible()

    await nav.alertsNavButton.click()

    // The route for the 'alerts' view is /alerts (routes.ts: alerts → /alerts).
    await expect(page).toHaveURL(/\/alerts$/)
  })

  // ── Test 4: alerts empty-state CTA navigates to Manage Watchlist ──────────
  test('alerts empty-state CTA is visible and navigates to /watchlist', async ({ page }) => {
    // Empty watchlist → active.length === 0 → CTA renders (authed branch).
    await mockBootstrap(page, AUTHED_BODY)
    await page.goto('/alerts')

    // The "Manage watchlist" CTA must be visible when there are no active alerts.
    const cta = page.getByTestId('alerts-empty-cta')
    await expect(cta).toBeVisible()
    await expect(cta).toHaveText(/manage watchlist/i)

    await cta.click()

    // 'managewatch' view maps to /watchlist (routes.ts).
    await expect(page).toHaveURL(/\/watchlist$/)
    // Verify the Manage Watchlists heading rendered — confirms the view mounted.
    await expect(page.getByText('Manage Watchlists')).toBeVisible()
  })
})
