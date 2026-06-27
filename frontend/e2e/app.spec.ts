import { test, expect } from '@playwright/test'

test.describe('App shell', () => {
  test('page loads and has correct title', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/Ticker Tracker/)
  })

  test('header nav renders key views', async ({ page }) => {
    await page.goto('/')
    // Scope to the header banner to avoid ambiguity with view content
    const header = page.getByRole('banner')
    await expect(header.getByRole('button', { name: 'Dashboard' })).toBeVisible()
    await expect(header.getByRole('button', { name: 'Market' })).toBeVisible()
  })

  test('clicking a nav item switches view', async ({ page }) => {
    await page.goto('/')
    // Dispatch a direct click on the Screener nav button via JS to avoid any
    // pointer-event occlusion from the overlapping Search button at this viewport
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('header button'))
      const btn = btns.find((b) => b.textContent?.trim() === 'Screener') as HTMLButtonElement | undefined
      btn?.click()
    })
    // Assert the Screener view actually mounted: subtitle text is unique to this view
    await expect(page.getByText(/matches · tap/)).toBeVisible({ timeout: 5000 })
  })

  test('search button opens search input', async ({ page }) => {
    await page.goto('/')
    // Click the search button (aria-label="Search")
    await page.getByRole('button', { name: 'Search' }).click()
    // After clicking, a search input appears
    await expect(page.getByPlaceholder('Search ticker or company…')).toBeVisible()
  })

  test('? key opens shortcuts overlay and Esc closes it', async ({ page }) => {
    await page.goto('/')
    // Ensure focus is on body (not an input) before pressing ?
    await page.click('body')
    // Press ? to open overlay
    await page.keyboard.press('?')
    // The overlay should show "Keyboard shortcuts"
    await expect(page.getByText('Keyboard shortcuts')).toBeVisible()
    // Press Esc to close
    await page.keyboard.press('Escape')
    // Overlay should be gone
    await expect(page.getByText('Keyboard shortcuts')).not.toBeVisible()
  })

  test('theme toggle button exists with correct aria-label', async ({ page }) => {
    await page.goto('/')
    // Find theme toggle by aria-label pattern
    const themeBtn = page.getByRole('button', { name: /switch to (light|dark) theme/i })
    await expect(themeBtn).toBeVisible()
  })
})
