import { Page, Locator, expect } from '@playwright/test'

// Page object for the Market Map view at /map.
// The map has two universes (Stocks / Crypto), a sector-chip row and an
// exchange filter (Stocks only). All stock data is synthetic (no backend call);
// crypto loads from /api/crypto and must be mocked in tests that exercise it.
// Locators use the data-testids added in MarketViews.tsx / Treemap.tsx.

export class MapPage {
  /** "Stocks" universe toggle button. */
  readonly stocksToggle: Locator
  /** "Crypto" universe toggle button (the map picker, not the header nav). */
  readonly cryptoToggle: Locator
  /** The treemap SVG element. */
  readonly treemapSvg: Locator
  /** The sector-chips container (present only in Stocks mode). */
  readonly sectorChips: Locator
  /** The exchange filter row (present only in Stocks mode). */
  readonly exchangeFilter: Locator

  constructor(private page: Page) {
    this.stocksToggle = page.getByTestId('map-universe-stocks')
    this.cryptoToggle = page.getByTestId('map-universe-crypto')
    this.treemapSvg = page.getByTestId('treemap-svg')
    this.sectorChips = page.getByTestId('map-sector-chips')
    this.exchangeFilter = page.getByTestId('map-exchange-filter')
  }

  async goto() {
    await this.page.goto('/map')
    await expect(this.stocksToggle).toBeVisible()
    await expect(this.treemapSvg).toBeVisible()
  }

  /** A sector chip by HM key (e.g. 'Technology', 'Energy'); 'All' → All sectors. */
  sectorChip(sector: string): Locator {
    return this.page.getByTestId(`map-sector-chip-${sector}`)
  }

  /** An exchange filter button: 'All', 'NASDAQ', or 'NYSE'. */
  exchangeButton(ex: 'All' | 'NASDAQ' | 'NYSE'): Locator {
    return this.page.getByTestId(`map-exchange-${ex}`)
  }

  /** A treemap tile <g> by ticker symbol. Present only when the tile renders. */
  tile(sym: string): Locator {
    return this.page.getByTestId(`treemap-tile-${sym}`)
  }
}
