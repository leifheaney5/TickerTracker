import { Page, Locator, expect } from '@playwright/test'

// Page object for the AuthScreen modal (`role="dialog"`).
//
// The modal is opened by clicking the "Sign in" button in the Header when the
// user is unauthenticated. It closes when:
//   - The user clicks the overlay backdrop
//   - The user clicks the × Close button
//   - The user presses Escape (handled by useFocusTrap → closeAuth)
//   - A successful login/signup action is completed

export class AuthModalPage {
  /** The dialog container — `role="dialog"` `aria-modal="true"`. */
  readonly dialog: Locator
  /** The h2 that provides the accessible name via `aria-labelledby="auth-title"`. */
  readonly dialogTitle: Locator
  /** The × button that dismisses the modal. */
  readonly closeButton: Locator
  /** Primary "Log in" submit button (visible in login mode). */
  readonly loginButton: Locator
  /** The error announcement span: `role="alert"` `id="auth-form-error"`. */
  readonly errorAlert: Locator

  constructor(private page: Page) {
    this.dialog = page.getByRole('dialog')
    this.dialogTitle = page.locator('#auth-title')
    this.closeButton = page.getByRole('button', { name: 'Close' })
    this.loginButton = page.getByRole('button', { name: 'Log in' })
    this.errorAlert = page.getByRole('alert')
  }

  /** Click the "Sign in" header button to open the modal in login mode. */
  async open() {
    await this.page.getByRole('button', { name: 'Sign in' }).click()
    await expect(this.dialog).toBeVisible()
  }

  /**
   * Returns true when `document.activeElement` is contained within the dialog.
   * Used to assert that the focus trap moved focus inside the modal on open.
   */
  async isFocusInsideDialog(): Promise<boolean> {
    return this.page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]')
      return dialog?.contains(document.activeElement) ?? false
    })
  }

  /** Fill and submit the login form, optionally mocking the /api/auth/login route. */
  async submitLogin(email: string, password: string) {
    await this.page.locator('input[type="email"]').fill(email)
    await this.page.locator('input[type="password"]').fill(password)
    await this.loginButton.click()
  }
}
