import { type Page, type Locator, expect } from '@playwright/test'

// Page object for the Market Overview (/market) and Sectors (/sectors) sub-tabs
// within MarketViews. Index cards (SPX/NDX/DJI/RUT/VIX) and sector bars now
// render '—' with disclosure notes — no synthetic values are shown.

export class MarketOverviewPage {
  constructor(private page: Page) {}

  async gotoOverview() {
    await this.page.goto('/market')
    // The "Market Overview" heading is the reliable mount indicator.
    await expect(this.page.getByText('Market Overview')).toBeVisible()
  }

  async gotoSectors() {
    await this.page.goto('/sectors')
    await expect(this.page.getByText('Sector Performance', { exact: true }).first()).toBeVisible()
  }

  /** Name label for a given index key (SPX / NDX / DJI / RUT / VIX). */
  idxName(key: string): Locator {
    return this.page.getByTestId(`idx-name-${key}`)
  }

  /** Value span for a given index key — must show '—'. */
  idxValue(key: string): Locator {
    return this.page.getByTestId(`idx-value-${key}`)
  }

  /** Overview disclosure note. */
  get overviewDisclosure(): Locator {
    return this.page.getByText('Simulated data — live market index quotes coming soon', { exact: false })
  }

  /** Sectors performance matrix container (holds all '—' matrix cells). */
  get sectorsMatrix(): Locator {
    return this.page.getByTestId('sectors-performance-matrix')
  }

  /** Sectors sub-tab disclosure note (Performance Matrix section). */
  get sectorsDisclosure(): Locator {
    return this.page.getByText('Simulated data — live sector performance data coming soon', { exact: false })
  }
}
