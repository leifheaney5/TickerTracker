/**
 * Unit tests for twofa.ts API client helpers.
 *
 * All fetch calls are mocked at the global level — no network.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Test doubles ──────────────────────────────────────────────────────────────

function mockFetch(status: number, body: unknown) {
  const json = vi.fn().mockResolvedValue(body)
  const response = { ok: status >= 200 && status < 300, status, json }
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response))
  return response
}

beforeEach(() => {
  vi.restoreAllMocks()
})

// ── totpApi ───────────────────────────────────────────────────────────────────

describe('totpApi.status', () => {
  it('returns enabled:true when 2FA is on', async () => {
    mockFetch(200, { enabled: true })
    const { totpApi } = await import('./twofa')
    const res = await totpApi.status()
    expect(res.ok).toBe(true)
    expect(res.data?.enabled).toBe(true)
  })

  it('returns ok:false on 401', async () => {
    mockFetch(401, { error: 'authentication required' })
    const { totpApi } = await import('./twofa')
    const res = await totpApi.status()
    expect(res.ok).toBe(false)
    expect(res.error).toContain('authentication required')
  })
})

describe('totpApi.setup', () => {
  it('returns secret and otpauth_uri on success', async () => {
    mockFetch(200, { secret: 'BASE32SECRET', otpauth_uri: 'otpauth://totp/...' })
    const { totpApi } = await import('./twofa')
    const res = await totpApi.setup()
    expect(res.ok).toBe(true)
    expect(res.data?.secret).toBe('BASE32SECRET')
    expect(res.data?.otpauth_uri).toMatch(/^otpauth:\/\//)
  })

  it('returns error on 503 (pyotp not available)', async () => {
    mockFetch(503, { error: 'TOTP not available' })
    const { totpApi } = await import('./twofa')
    const res = await totpApi.setup()
    expect(res.ok).toBe(false)
    expect(res.error).toContain('TOTP not available')
  })
})

describe('totpApi.verify', () => {
  it('returns recovery_codes on success', async () => {
    const codes = ['AAAA-BBBB-CCCC', 'DDDD-EEEE-FFFF']
    mockFetch(200, { recovery_codes: codes })
    const { totpApi } = await import('./twofa')
    const res = await totpApi.verify('123456')
    expect(res.ok).toBe(true)
    expect(res.data?.recovery_codes).toEqual(codes)
  })

  it('passes code in request body', async () => {
    mockFetch(200, { recovery_codes: [] })
    const { totpApi } = await import('./twofa')
    await totpApi.verify('654321')
    const call = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    const body = JSON.parse(call[1].body as string)
    expect(body.code).toBe('654321')
  })

  it('returns error on invalid code', async () => {
    mockFetch(400, { error: 'invalid or expired code' })
    const { totpApi } = await import('./twofa')
    const res = await totpApi.verify('000000')
    expect(res.ok).toBe(false)
    expect(res.error).toContain('invalid')
  })
})

describe('totpApi.disable', () => {
  it('returns ok:true on success', async () => {
    mockFetch(200, { ok: true })
    const { totpApi } = await import('./twofa')
    const res = await totpApi.disable('123456')
    expect(res.ok).toBe(true)
    expect(res.data?.ok).toBe(true)
  })
})

// ── webAuthnApi ───────────────────────────────────────────────────────────────

describe('webAuthnApi.status', () => {
  it('returns enabled:false when WebAuthn not configured', async () => {
    mockFetch(200, { enabled: false })
    const { webAuthnApi } = await import('./twofa')
    const res = await webAuthnApi.status()
    expect(res.ok).toBe(true)
    expect(res.data?.enabled).toBe(false)
  })
})

describe('webAuthnApi.listCredentials', () => {
  it('returns credential list', async () => {
    const creds = [{ id: 'abc123', label: 'My Key', created_at: '2026-01-01' }]
    mockFetch(200, { credentials: creds })
    const { webAuthnApi } = await import('./twofa')
    const res = await webAuthnApi.listCredentials()
    expect(res.ok).toBe(true)
    expect(res.data?.credentials).toHaveLength(1)
    expect(res.data?.credentials[0].label).toBe('My Key')
  })
})

// ── authPost network failure ──────────────────────────────────────────────────

describe('network failure handling', () => {
  it('returns ok:false when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))
    const { totpApi } = await import('./twofa')
    const res = await totpApi.status()
    expect(res.ok).toBe(false)
    expect(res.error).toContain('Network error')
  })
})
