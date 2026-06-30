import { type Page, type Locator, expect } from '@playwright/test'

// Page object for the Manage Watchlists view at /watchlist.
// This view is auth-gated — always mock /api/auth/me to return a user before
// calling goto(), or the gate-wall ("Sign in / Sign up") will render instead.

export class ManageWatchlistPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/watchlist')
    // The "+ New list" button is the reliable mount indicator for the authed view.
    await expect(
      this.page.getByRole('button', { name: '+ New list' }),
    ).toBeVisible()
  }

  /** Alert-direction "↑ Above" button for the given ticker symbol. */
  alertDirAbove(symbol: string): Locator {
    return this.page.getByTestId(`alert-dir-above-${symbol}`)
  }

  /** Alert-direction "↓ Below" button for the given ticker symbol. */
  alertDirBelow(symbol: string): Locator {
    return this.page.getByTestId(`alert-dir-below-${symbol}`)
  }
}
