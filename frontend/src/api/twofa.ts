/**
 * TOTP 2FA and WebAuthn API client.
 *
 * These endpoints return plain JSON (not the envelope format used by market-data
 * routes), matching the convention established by /api/auth/* routes.
 */

// ── Raw fetch helper (no envelope) ───────────────────────────────────────────

async function authPost<T>(
  path: string,
  body?: unknown,
): Promise<{ ok: boolean; data?: T; error?: string; status?: number }> {
  try {
    const r = await fetch(path, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const json = await r.json().catch(() => ({}))
    if (!r.ok) {
      return { ok: false, error: (json as { error?: string }).error ?? `${path} → ${r.status}`, status: r.status }
    }
    return { ok: true, data: json as T, status: r.status }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}

async function authGet<T>(
  path: string,
): Promise<{ ok: boolean; data?: T; error?: string }> {
  try {
    const r = await fetch(path, { credentials: 'include' })
    const json = await r.json().catch(() => ({}))
    if (!r.ok) {
      return { ok: false, error: (json as { error?: string }).error ?? `${path} → ${r.status}` }
    }
    return { ok: true, data: json as T }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}

async function authDelete<T>(
  path: string,
): Promise<{ ok: boolean; data?: T; error?: string }> {
  try {
    const r = await fetch(path, { method: 'DELETE', credentials: 'include' })
    const json = await r.json().catch(() => ({}))
    if (!r.ok) {
      return { ok: false, error: (json as { error?: string }).error ?? `${path} → ${r.status}` }
    }
    return { ok: true, data: json as T }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}

// ── TOTP types ────────────────────────────────────────────────────────────────

export interface TotpStatus { enabled: boolean }
export interface TotpSetupResult { secret: string; otpauth_uri: string }
export interface TotpVerifyResult { recovery_codes: string[] }
export interface TotpDisableResult { ok: boolean }

// ── TOTP API ──────────────────────────────────────────────────────────────────

export const totpApi = {
  /** Check whether TOTP is currently enabled for the authenticated user. */
  status: () => authGet<TotpStatus>('/api/2fa/status'),

  /** Generate a new TOTP secret and store it (pending confirmation). */
  setup: () => authPost<TotpSetupResult>('/api/2fa/setup'),

  /** Confirm a TOTP code. Enables 2FA and returns recovery codes (shown once). */
  verify: (code: string) => authPost<TotpVerifyResult>('/api/2fa/verify', { code }),

  /** Disable TOTP. Requires a valid TOTP code or recovery code. */
  disable: (code: string) => authPost<TotpDisableResult>('/api/2fa/disable', { code }),
}

// ── WebAuthn types ────────────────────────────────────────────────────────────

export interface WebAuthnStatus { enabled: boolean }

export interface WebAuthnCredentialInfo {
  id: string
  label: string
  created_at: string | null
}

// ── WebAuthn API ──────────────────────────────────────────────────────────────

export const webAuthnApi = {
  /** Check whether WebAuthn is configured on the server. */
  status: () => authGet<WebAuthnStatus>('/api/webauthn/status'),

  /** List registered passkeys for the current user. */
  listCredentials: () =>
    authGet<{ credentials: WebAuthnCredentialInfo[] }>('/api/webauthn/credentials'),

  /**
   * Begin passkey registration. Returns WebAuthn creation options JSON.
   * Pass the result to `navigator.credentials.create()`.
   */
  registerBegin: () =>
    fetch('/api/webauthn/register/begin', { method: 'POST', credentials: 'include' }),

  /** Complete passkey registration by posting the authenticator response. */
  registerComplete: (credential: unknown, label?: string) =>
    authPost<{ ok: boolean; label: string }>('/api/webauthn/register/complete', {
      ...(typeof credential === 'object' && credential !== null ? credential : {}),
      label,
    }),

  /** Begin passkey authentication. Returns WebAuthn request options JSON. */
  authBegin: (credentialIds?: string[]) =>
    fetch('/api/webauthn/auth/begin', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: credentialIds ? JSON.stringify({ credential_ids: credentialIds }) : undefined,
    }),

  /** Complete passkey authentication. */
  authComplete: (credential: unknown) =>
    authPost<{ user: { id: number; email: string; name: string; email_verified: boolean } }>(
      '/api/webauthn/auth/complete',
      credential,
    ),

  /** Delete a registered credential. */
  deleteCredential: (credentialId: string) =>
    authDelete<{ deleted: boolean }>(
      `/api/webauthn/credentials/${encodeURIComponent(credentialId)}`,
    ),
}
