import { Page, Locator, expect } from '@playwright/test'

// Page object for the Market Map view at /map.
// The map has two universes (Stocks / Crypto) and a sector-chip row (Stocks
// only).  All stock data is synthetic (no backend call); crypto loads from
// /api/crypto and must be mocked in tests that exercise that path.

export class MapPage {
  /** "Stocks" universe toggle button — unique on the page (not in header nav). */
  readonly stocksToggle: Locator

  /**
   * "Crypto" universe toggle button — scoped to the same parent div as
   * stocksToggle so it does not match the header nav's "Crypto" button.
   */
  readonly cryptoToggle: Locator

  /**
   * The treemap SVG element.  height="460" is hardcoded in Treemap.tsx, which
   * distinguishes it from any small icon SVGs in the app shell.
   */
  readonly treemapSvg: Locator

  constructor(private page: Page) {
    this.stocksToggle = page.getByRole('button', { name: 'Stocks' })
    // Navigate to the Stocks button's direct parent div, then find the sibling
    // Crypto button within that container only.
    this.cryptoToggle = this.stocksToggle
      .locator('xpath=..')
      .getByRole('button', { name: 'Crypto' })
    this.treemapSvg = page.locator('svg[height="460"]')
  }

  async goto() {
    await this.page.goto('/map')
    // Wait for the universe toggle to confirm the map sub-view has mounted.
    await expect(this.stocksToggle).toBeVisible()
    await expect(this.treemapSvg).toBeVisible()
  }

  /**
   * Locates a sector chip button by its sector key from HM (e.g. 'Technology',
   * 'Energy').  Pass 'All' to target the "All sectors" chip.
   */
  sectorChip(sector: string): Locator {
    const label = sector === 'All' ? 'All sectors' : sector
    return this.page.getByRole('button', { name: label })
  }

  /**
   * Locates the SVG <text> element that renders a ticker symbol inside its
   * treemap tile.  Only present in the DOM when the tile is large enough to
   * show a label (w > 34, h > 22) — all market-cap-dominant tickers like AAPL
   * and XOM always satisfy this at the 800×460 canvas size.
   */
  tileText(sym: string): Locator {
    // Exact-match regex so e.g. 'T' does not match 'TSLA'.
    return this.treemapSvg
      .locator('text')
      .filter({ hasText: new RegExp(`^${sym}$`) })
  }
}
