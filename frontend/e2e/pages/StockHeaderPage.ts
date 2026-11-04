import { type Page, type Locator, expect } from '@playwright/test'

// Page object for the StockHeader component, which renders inside the Dashboard view.
// Navigate to /ticker/{symbol} to land on the dashboard with StockHeader visible.
//
// Locator strategy:
//   - Market-status pill:  aria-label="Market status: <LABEL>" (set by StockHeader.tsx)
//   - Price container:     role="status" + aria-live="polite" + aria-atomic="true"
//   - "as of" label:       data-testid="stock-header-as-of"
//   - Mount indicator:     data-testid="stock-header" (root element)

export class StockHeaderPage {
  /** Root div of the StockHeader component — reliable mount signal. */
  readonly root: Locator

  /** The 32px price element. role="status" aria-live="polite" aria-atomic="true".
   *  Only present in the DOM when live quote data has loaded (hasQuote === true). */
  readonly priceContainer: Locator

  /** The market-status pill (OPEN / PRE-MARKET / AFTER-HOURS / CLOSED).
   *  NOT rendered when marketStatus is "Unknown" or before the first poll. */
  readonly marketStatusPill: Locator

  /** The "as of HH:MM" freshness label.
   *  Only present once quotesFetchedAt is set (a truthy fetched_at in the response). */
  readonly asOfLabel: Locator

  constructor(private page: Page) {
    this.root = page.getByTestId('stock-header')
    this.priceContainer = page.locator('[role="status"][aria-live="polite"][aria-atomic="true"]')
    this.marketStatusPill = page.locator('[aria-label^="Market status:"]')
    this.asOfLabel = page.getByTestId('stock-header-as-of')
  }

  /** Navigate to the dashboard with the given ticker selected.
   *  Waits for the StockHeader root to be visible before resolving. */
  async goto(symbol = 'AAPL') {
    await this.page.goto(`/ticker/${symbol}`)
    await expect(this.root).toBeVisible()
  }

  /** Convenience: return a locator scoped to the market-status pill with
   *  the specific label, matching the aria-label attribute exactly. */
  pillWithLabel(label: string): Locator {
    return this.page.locator(`[aria-label="Market status: ${label}"]`)
  }
}
