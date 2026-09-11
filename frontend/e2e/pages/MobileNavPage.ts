import { Page, Locator, expect } from '@playwright/test'

// Page object for the mobile-header navigation (hamburger menu).
// Only rendered when the viewport is ≤ 768 px wide (useIsMobile breakpoint).
// Use test.use({ viewport: { width: 390, height: 844 } }) in the spec.

export class MobileNavPage {
  /** The hamburger toggle button in the mobile top-bar. */
  readonly hamburger: Locator
  /** The Alerts nav button — only present in the open menu when the user is authed. */
  readonly alertsNavButton: Locator

  constructor(private page: Page) {
    this.hamburger = page.getByRole('button', { name: 'Open navigation menu' })
    this.alertsNavButton = page.getByTestId('mobile-nav-alerts')
  }

  /** Navigate to `path` and confirm the hamburger is visible (mobile layout rendered). */
  async goto(path = '/dashboard') {
    await this.page.goto(path)
    await expect(this.hamburger).toBeVisible()
  }

  /** Click the hamburger to open (or close) the dropdown menu. */
  async openMenu() {
    await this.hamburger.click()
  }
}
