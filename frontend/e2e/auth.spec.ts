/**
 * Auth surface tests — covers:
 * - AuthScreen OAuth buttons hidden when /api/auth/providers returns all false
 * - TOTP challenge step renders after login responds with two_factor_required
 * - Login form basics (field validation, error display)
 */

import { test, expect } from '@playwright/test'

// ── Shared mock helpers ────────────────────────────────────────────────────────

const envelope = (data: unknown) =>
  JSON.stringify({ data, meta: { source: 'test-mock', stale: false, fetched_at: '' } })

/** Standard boot mocks — no auth, empty watchlists, empty quotes. */
async function mockBootRoutes(page: import('@playwright/test').Page) {
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
    route.fulfill({ status: 200, contentType: 'application/json', body: envelope({ value: 50, label: 'Neutral' }) })
  )
  await page.route('**/api/quotes**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: envelope({ quotes: {}, market_status: 'Closed' }) })
  )
  await page.route('**/api/logos**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: envelope({}) })
  )
  // Silence history/ratings/etc.
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
}

/** Open the auth modal.
 *
 * The header sign-in button churns as boot data streams in (skeletons → real
 * content), which detaches it mid-click and makes it flaky. Instead, open via the
 * STABLE in-page "Sign in / Sign up" button on the Settings unauth prompt — that
 * panel doesn't re-render on quote polls. Navigates to /settings regardless of the
 * caller's current page; the modal is page-agnostic. */
async function openAuthModal(page: import('@playwright/test').Page) {
  await page.goto('/settings')
  const btn = page.getByRole('button', { name: /sign in \/ sign up/i })
  await expect(btn).toBeVisible()
  await btn.click()
  await expect(page.getByText('Welcome back')).toBeVisible()
}

// ── Suite ─────────────────────────────────────────────────────────────────────

test.describe('AuthScreen — OAuth buttons', () => {
  test.beforeEach(async ({ page }) => {
    await mockBootRoutes(page)
    // No OAuth providers configured (test environment)
    await page.route('**/api/auth/providers', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ google: false, apple: false }),
      })
    )
  })

  test('Google and Apple login buttons are absent when providers returns all false', async ({ page }) => {
    await page.goto('/')
    await openAuthModal(page)

    // The auth modal should be open (contains the "Log in" heading)
    await expect(page.getByText('Welcome back')).toBeVisible()

    // Neither OAuth button should be in the DOM when the server says both are unconfigured
    await expect(page.getByTestId('google-login')).not.toBeAttached()
    await expect(page.getByTestId('apple-login')).not.toBeAttached()
  })

  test('Google button appears when providers returns google: true', async ({ page }) => {
    // Override to enable Google only
    await page.route('**/api/auth/providers', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ google: true, apple: false }),
      })
    )

    await page.goto('/')
    await openAuthModal(page)

    await expect(page.getByText('Welcome back')).toBeVisible()
    await expect(page.getByTestId('google-login')).toBeVisible()
    await expect(page.getByTestId('apple-login')).not.toBeAttached()
  })

  test('Apple button appears when providers returns apple: true', async ({ page }) => {
    await page.route('**/api/auth/providers', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ google: false, apple: true }),
      })
    )

    await page.goto('/')
    await openAuthModal(page)

    await expect(page.getByText('Welcome back')).toBeVisible()
    await expect(page.getByTestId('google-login')).not.toBeAttached()
    await expect(page.getByTestId('apple-login')).toBeVisible()
  })
})

test.describe('AuthScreen — TOTP challenge step', () => {
  test.beforeEach(async ({ page }) => {
    await mockBootRoutes(page)
    await page.route('**/api/auth/providers', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ google: false, apple: false }),
      })
    )
  })

  test('TOTP challenge renders when login returns two_factor_required', async ({ page }) => {
    // Mock the login endpoint to indicate 2FA is required
    await page.route('**/api/auth/login', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ two_factor_required: true, token: 'pending-token-abc' }),
      })
    )

    await page.goto('/')
    await openAuthModal(page)

    // Fill and submit the login form
    await page.locator('input[type="email"]').fill('user@example.com')
    await page.locator('input[type="password"]').fill('password123')
    await page.getByRole('button', { name: 'Log in' }).click()

    // TOTP challenge step should now be visible
    await expect(page.getByTestId('totp-challenge')).toBeVisible()
    await expect(page.getByTestId('totp-code-input')).toBeVisible()
    await expect(page.getByTestId('totp-submit')).toBeVisible()

    // The header should reflect the 2FA mode
    await expect(page.getByText('Two-factor authentication')).toBeVisible()
  })

  test('TOTP recovery code toggle switches input mode', async ({ page }) => {
    await page.route('**/api/auth/login', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ two_factor_required: true, token: 'pending-token-xyz' }),
      })
    )

    await page.goto('/')
    await openAuthModal(page)

    await page.locator('input[type="email"]').fill('user@example.com')
    await page.locator('input[type="password"]').fill('password123')
    await page.getByRole('button', { name: 'Log in' }).click()

    await expect(page.getByTestId('totp-challenge')).toBeVisible()

    // Click "Use a recovery code instead"
    await page.getByRole('button', { name: /use a recovery code instead/i }).click()

    // The label should change to RECOVERY CODE and placeholder should change
    await expect(page.getByTestId('totp-code-input')).toHaveAttribute('placeholder', 'XXXX-XXXX-XXXX')

    // "Use authenticator app instead" link should now be present
    await expect(page.getByRole('button', { name: /use authenticator app instead/i })).toBeVisible()
  })
})

test.describe('AuthScreen — login form validation', () => {
  test.beforeEach(async ({ page }) => {
    await mockBootRoutes(page)
    await page.route('**/api/auth/providers', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ google: false, apple: false }),
      })
    )
  })

  test('shows error when login credentials are rejected', async ({ page }) => {
    await page.route('**/api/auth/login', (route) =>
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Invalid email or password.' }),
      })
    )

    await page.goto('/')
    await openAuthModal(page)

    await page.locator('input[type="email"]').fill('wrong@example.com')
    await page.locator('input[type="password"]').fill('wrongpassword')
    await page.getByRole('button', { name: 'Log in' }).click()

    // An error message should appear (does not enumerate accounts)
    await expect(page.locator('span').filter({ hasText: /invalid|failed|incorrect/i }).first()).toBeVisible()
  })

  test('can switch from login to signup mode', async ({ page }) => {
    await page.goto('/')
    await openAuthModal(page)

    await expect(page.getByText('Welcome back')).toBeVisible()

    // Click "Sign up" link inside the form (exact — avoid the page's
    // "Sign in / Sign up" prompt button which also contains "Sign up").
    await page.getByRole('button', { name: 'Sign up', exact: true }).click()

    await expect(page.getByText('Create your account')).toBeVisible()
    // Signup form has a Name field that login doesn't
    await expect(page.getByPlaceholder('Your name')).toBeVisible()
  })
})
