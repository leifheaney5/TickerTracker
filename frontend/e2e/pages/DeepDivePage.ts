import { type Page, type Locator, expect } from '@playwright/test'

// Page object for the Deep Dive / Fundamentals view at /deep-dive.
// The view is an AtAGlance sub-tab; it renders a table with one row per
// watchlist symbol showing P/E (real data) and extended ratios (em-dash
// placeholders until a premium data feed is integrated).

export class DeepDivePage {
  /** The disclosure footer shown at the bottom of the deep dive table. */
  readonly disclosureFooter: Locator

  constructor(private page: Page) {
    this.disclosureFooter = page.getByText(
      'Extended ratios require a premium data feed',
      { exact: false },
    )
  }

  async goto() {
    await this.page.goto('/deep-dive')
    // "Deep Dive" heading is the reliable mount indicator.
    await expect(this.page.getByText('Deep Dive')).toBeVisible()
  }

  /** The full row element for a given ticker (has data-testid="deep-dive-row-{sym}"). */
  row(symbol: string): Locator {
    return this.page.getByTestId(`deep-dive-row-${symbol}`)
  }

  /** The P/E cell for a given ticker (has data-testid="deep-dive-cell-pe-{sym}"). */
  peCell(symbol: string): Locator {
    return this.page.getByTestId(`deep-dive-cell-pe-${symbol}`)
  }

  /**
   * All em-dash placeholder cells within a ticker row.
   * These are the 8 extended-ratio columns (P/S through Net Debt/EBITDA).
   */
  extendedRatioCells(symbol: string): Locator {
    return this.row(symbol).getByText('—', { exact: true })
  }
}
