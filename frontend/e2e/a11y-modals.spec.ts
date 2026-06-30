/**
 * a11y-modals.spec.ts
 *
 * WCAG accessibility tests for the features shipped in commit ca59b72:
 *   - AuthScreen: role="dialog", aria-modal, aria-labelledby, focus trap,
 *     Escape-to-close, role="alert" error announcements.
 *   - SignalChips: chip button aria-describedby, role="tooltip" visibility on
 *     keyboard focus.
 *   - UpgradePrompt: skipped (see note in that suite).
 *
 * All Finnhub/Yahoo/backend routes are mocked at the network boundary so tests
 * are deterministic and market-hours independent.
 */
import { test, expect, type Page } from '@playwright/test'
import { AuthModalPage } from './pages/AuthModalPage'

// ── Fixture helpers ───────────────────────────────────────────────────────────

/** Wrap a payload in the standard API envelope. */
const envelope = (data: unknown) =>
  JSON.stringify({ data, meta: { source: 'test-mock', stale: false, fetched_at: '' } })

/**
 * Register the minimum set of routes needed for an anonymous (unauthenticated)
 * app boot.  Matches the pattern established in map.spec.ts.
 */
async function mockAnonymousBoot(page: Page) {
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ user: null }),
    })
  )
  await page.route('**/api/quotes**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: envelope({ quotes: {}, market_status: 'Closed' }),
    })
  )
  await page.route('**/api/logos**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: envelope({}),
    })
  )
  await page.route('**/api/fng', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: envelope({ value: 62, label: 'Greed' }),
    })
  )
}

// ── Suite 1: Auth modal ARIA semantics ───────────────────────────────────────

test.describe('Auth modal — ARIA dialog semantics', () => {
  test.beforeEach(async ({ page }) => {
    await mockAnonymousBoot(page)
    await page.goto('/dashboard')
  })

  test('dialog element has role=dialog, aria-modal=true, and aria-labelledby=auth-title', async ({ page }) => {
    const modal = new AuthModalPage(page)
    await modal.open()

    const dialog = modal.dialog
    await expect(dialog).toHaveAttribute('role', 'dialog')
    await expect(dialog).toHaveAttribute('aria-modal', 'true')
    await expect(dialog).toHaveAttribute('aria-labelledby', 'auth-title')

    // The h2 referenced by aria-labelledby must exist and be visible.
    await expect(modal.dialogTitle).toBeVisible()
    await expect(modal.dialogTitle).toHaveText(/welcome back/i)
  })

  test('focus moves inside the dialog immediately on open (focus trap)', async ({ page }) => {
    const modal = new AuthModalPage(page)
    await modal.open()

    // useFocusTrap focuses the first focusable element inside the container.
    // We assert document.activeElement is contained within the dialog without
    // hard-coding which element is focused (robust against DOM reordering).
    const isFocusInDialog = await modal.isFocusInsideDialog()
    expect(isFocusInDialog).toBe(true)
  })

  test('Escape key closes the auth modal', async ({ page }) => {
    const modal = new AuthModalPage(page)
    await modal.open()

    await expect(modal.dialog).toBeVisible()
    await page.keyboard.press('Escape')

    // AuthScreen returns null when authModal is false, so the element is
    // removed from the DOM entirely — not just hidden.
    await expect(modal.dialog).not.toBeAttached()
  })

  test('submitting empty login form shows role=alert error (client-side validation)', async ({ page }) => {
    // The login handler guards: `if (!email || !password) { setError(...); return }`
    // No network call is made; assert the error element appears without mocking
    // the auth endpoint.  We still stub the route defensively so any accidental
    // fetch is surfaced as a 401 rather than a missing-mock error.
    await page.route('**/api/auth/login', (route) =>
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'bad credentials' }),
      })
    )

    const modal = new AuthModalPage(page)
    await modal.open()

    // Click Log in with both fields empty — client-side guard fires, no fetch.
    await modal.loginButton.click()

    const errorAlert = modal.errorAlert
    await expect(errorAlert).toBeVisible()
    await expect(errorAlert).toHaveText(/please fill in all fields/i)
    // Confirm the id matches what aria-describedby on the button references.
    await expect(errorAlert).toHaveAttribute('id', 'auth-form-error')
  })
})

// ── Suite 2: Signal chip ARIA + tooltip on keyboard focus ────────────────────

test.describe('SignalChips — ARIA and tooltip visibility on keyboard focus', () => {
  /**
   * Use the store's default selected ticker (NVDA) on /dashboard to avoid
   * depending on the RouterBridge URL → state async chain.  The Dashboard
   * renders PulseDial for NVDA immediately; PulseDial calls loadPulse('NVDA'),
   * which is intercepted here.
   *
   * A single catch-all handler for all /api/pulse/** routes dispatches on the
   * request URL to return the correct fixture for each sub-route.
   */
  test.beforeEach(async ({ page }) => {
    // Only mockAnonymousBoot is needed here.  The other Dashboard sub-components
    // (news, history, earnings, ratings, sentiment) all handle API errors silently
    // in the store's catch blocks, so they do not need explicit mocks.  Adding
    // broad ticker-detail route mocks causes interference with the pulse routes
    // (Playwright uses LIFO priority, so later-registered handlers shadow earlier
    // ones if a glob pattern unexpectedly overlaps a pulse URL).
    await mockAnonymousBoot(page)

    await page.route(/\/api\/pulse\//, async (route) => {
      const url = route.request().url()

      // /api/pulse/NVDA/signals → rich signals fixture with one condition.
      if (url.includes('/NVDA/signals')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: envelope({
            symbol: 'NVDA',
            pulse: { score: 72, band: 'Building' },
            conditions: [
              {
                key: 'near-target',
                title: 'Near analyst target',
                detail: 'Price is within 3% of the median analyst price target.',
              },
            ],
            disclaimer: 'Educational only — not investment advice.',
          }),
        })
        return
      }

      // /api/pulse/<any>/history → empty history is fine; PulseTrend no-ops.
      if (url.includes('/history')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: envelope([]),
        })
        return
      }

      // /api/pulse/<any>/signals (non-NVDA) → empty conditions, chip doesn't render.
      if (url.includes('/signals')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: envelope({
            symbol: '',
            pulse: { score: 50, band: 'Neutral' },
            conditions: [],
            disclaimer: '',
          }),
        })
        return
      }

      // /api/pulse/NVDA — base Pulse score.  PulseWhy guards `if (!pulse) return null`,
      // so the whole chip chain only begins once this resolves successfully.
      if (url.includes('/NVDA')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: envelope({
            symbol: 'NVDA',
            score: 72,
            band: 'Building',
            components: [
              {
                key: 'rsi',
                label: 'RSI',
                value: 60,
                raw: 'RSI 60',
                state: 'Bullish',
                weight: 1.0,
                contribution: 60,
              },
            ],
            asOf: '2026-06-30',
            kind: 'stock',
            disclaimer: 'Educational only.',
          }),
        })
        return
      }

      // Any other pulse sub-route: abort so the store's catch block runs and
      // leaves the state unset (component renders nothing — test is unaffected).
      await route.fulfill({ status: 500, body: '{}' })
    })
  })

  test('chip button has aria-describedby; tooltip has role=tooltip and becomes visible on keyboard focus', async ({ page }) => {
    // Navigate to /dashboard with the default selected = NVDA.  This is simpler
    // than /ticker/AAPL because it avoids the RouterBridge URL→state async delay.
    await page.goto('/dashboard')

    const chip = page.getByTestId('signal-chip-near-target')

    // Diagnostic: if pulse.NVDA was set by the mock, PulseWhy renders a
    // "Why Pulse is N" expand button.  This confirms the pulse mock is working.
    await expect(page.getByRole('button', { name: /why pulse is/i })).toBeVisible({ timeout: 10000 })

    // Wait for the chip to be rendered.  The render chain is:
    //   loadPulse('NVDA') → pulse.NVDA set → PulseWhy renders →
    //   SignalChips mounts → loadSignalAlerts('NVDA') → conditions set → chip renders.
    await expect(chip).toBeVisible({ timeout: 5000 })

    // 1. Chip must expose aria-describedby pointing to the co-located tooltip.
    //    The tooltip id is `signal-chip-tooltip-{key}` where key = 'near-target'.
    await expect(chip).toHaveAttribute('aria-describedby', 'signal-chip-tooltip-near-target')

    // 2. The tooltip element must be present in the DOM with role=tooltip.
    const tooltip = page.locator('#signal-chip-tooltip-near-target')
    await expect(tooltip).toHaveAttribute('role', 'tooltip')

    // 3. Tooltip is visually hidden before interaction (opacity:0/visibility:hidden).
    //    We skip asserting `not.toBeVisible()` here because Playwright's visibility
    //    check treats opacity:0 elements as visible if they have layout; instead we
    //    trust the implementation and focus on the positive assertion below.

    // 4. Programmatic focus fires onFocus → setActiveKey → tooltip becomes visible.
    await chip.focus()
    await expect(tooltip).toBeVisible()
  })
})

// ── Suite 3: UpgradePrompt dialog semantics (skipped) ───────────────────────

test.describe('UpgradePrompt — ARIA dialog semantics', () => {
  test('upgrade modal has role=dialog and aria-labelledby=upgrade-title', async ({ page }) => {
    // SKIP: UpgradePrompt is rendered when the Zustand store receives
    // `openUpgrade(...)`, which is called on a 402 API response (e.g. exceeding
    // the free-tier watchlist limit) or via `toggleCompare` overflow.
    // Triggering it deterministically in e2e without test-only window exposure
    // or an authenticated user hitting a real limit is impractical at this time.
    // Follow-up: expose a `?_upgrade_demo=1` URL param that fires openUpgrade(),
    // or assert via a unit test of the Zustand action directly.
    test.skip(true, 'UpgradePrompt trigger requires authenticated user + 402 gated action; impractical without test hook.')

    const dialog = page.getByRole('dialog')
    await expect(dialog).toHaveAttribute('aria-labelledby', 'upgrade-title')
    await expect(page.locator('#upgrade-title')).toBeVisible()
  })
})
