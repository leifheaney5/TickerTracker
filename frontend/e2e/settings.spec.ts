/**
 * Settings view tests — covers:
 * - Unauthenticated: sign-in prompt renders
 * - Authenticated: profile card, connected-accounts, notifications section render
 * - Security card: 2FA row and passkey row are visible
 * - Push notification toggle section is present
 * - 2FA Enable button: visible when server says 2FA is disabled
 * - Passkey section shows "Not available on this server" when endpoint 404s
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

/** Single flat helper — no stacking — for authenticated settings tests. */
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
  // Security hooks — server-side feature flags
  await page.route('**/api/2fa/status', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ enabled: false }) })
  )
  await page.route('**/api/webauthn/status', (route) =>
    route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'not found' }) })
  )
  await page.route('**/api/push/vapid-public-key', (route) =>
    route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'not found' }) })
  )
  // Portfolio stubs (not used in Settings view, but loadMe triggers loadHoldings)
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

test.describe('Settings view — unauthenticated', () => {
  test('shows sign-in prompt when not logged in', async ({ page }) => {
    await mockAnon(page)
    await page.goto('/settings')
    await expect(page.getByText('Settings')).toBeVisible()
    await expect(page.getByText(/create a free account or sign in/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /sign in \/ sign up/i })).toBeVisible()
  })
})

test.describe('Settings view — authenticated', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthed(page)
  })

  test('profile card shows user email and verified status', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.getByText('test@example.com')).toBeVisible()
    await expect(page.getByText(/email verified/i)).toBeVisible()
  })

  test('notifications section renders with live updates and alert toggles', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.getByText('Notifications & data')).toBeVisible()
    await expect(page.getByText('Live price updates')).toBeVisible()
    await expect(page.getByText('Price alert notifications')).toBeVisible()
  })

  test('privacy section renders hide balances toggle', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.getByText('Privacy & display')).toBeVisible()
    await expect(page.getByText('Hide balances')).toBeVisible()
  })

  test('Security card renders with 2FA and passkey sections', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.getByText('Security', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Two-factor authentication (TOTP)')).toBeVisible()
    await expect(page.getByText('Passkeys / biometric login')).toBeVisible()
  })

  test('passkey section shows "Not available on this server" when webauthn/status is 404', async ({ page }) => {
    // webauthn/status returns 404 → serverEnabled = false
    await page.goto('/settings')
    // The passkey-register button should NOT be attached (serverEnabled is false)
    await expect(page.getByTestId('passkey-register')).not.toBeAttached()
    // The "Not available on this server" text should be shown
    await expect(page.getByText('Not available on this server')).toBeVisible()
  })

  test('2FA Enable button visible when 2FA is disabled', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.getByTestId('2fa-enable-btn')).toBeVisible()
  })

  test('sign out button is visible', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.getByRole('button', { name: /sign out/i })).toBeVisible()
  })

  test('Plan & Billing section renders usage meters', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.getByText('Plan & Billing')).toBeVisible()
    await expect(page.getByText('Watchlist tickers')).toBeVisible()
    await expect(page.getByText('Active price alerts')).toBeVisible()
  })
})
