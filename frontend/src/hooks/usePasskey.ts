/**
 * usePasskey — state machine for passkey / WebAuthn registration in Settings.
 *
 * Checks server-side enablement via GET /api/webauthn/status.
 * Checks browser support via PublicKeyCredential.
 * Never fakes success — if the browser API or server is unavailable, shows a
 * human-readable message and does nothing.
 *
 * Registration flow:
 *   1. POST /api/webauthn/register/begin  → creation options
 *   2. navigator.credentials.create(options) → authenticator response
 *   3. POST /api/webauthn/register/complete(response) → {ok, label}
 */
import { useState, useEffect, useCallback } from 'react'
import { webAuthnApi } from '../api/twofa'

/**
 * Decode a base64url string to an ArrayBuffer (for WebAuthn credential options).
 */
function base64urlToBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(base64 + '='.repeat((4 - base64.length % 4) % 4))
  const buffer = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) buffer[i] = binary.charCodeAt(i)
  return buffer.buffer
}

/**
 * Encode an ArrayBuffer to a base64url string (for sending back to the server).
 */
function bufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

/**
 * Prepare the creation options from the server's JSON response so that
 * `navigator.credentials.create()` can accept them:
 * - challenge and user.id must be ArrayBuffers
 * - excludeCredentials[*].id must be ArrayBuffers
 */
function parseCreationOptions(opts: Record<string, unknown>): PublicKeyCredentialCreationOptions {
  const raw = opts as {
    challenge: string
    user: { id: string; name: string; displayName: string }
    rp: PublicKeyCredentialRpEntity
    pubKeyCredParams: PublicKeyCredentialParameters[]
    excludeCredentials?: { id: string; type: string }[]
    timeout?: number
    attestation?: AttestationConveyancePreference
    authenticatorSelection?: AuthenticatorSelectionCriteria
  }
  return {
    challenge: base64urlToBuffer(raw.challenge),
    rp: raw.rp,
    user: {
      id: base64urlToBuffer(raw.user.id),
      name: raw.user.name,
      displayName: raw.user.displayName,
    },
    pubKeyCredParams: raw.pubKeyCredParams,
    excludeCredentials: (raw.excludeCredentials ?? []).map(c => ({
      id: base64urlToBuffer(c.id),
      type: c.type as PublicKeyCredentialType,
    })),
    timeout: raw.timeout,
    attestation: raw.attestation,
    authenticatorSelection: raw.authenticatorSelection,
  }
}

/**
 * Serialize a PublicKeyCredential response so it can be JSON-posted to the server.
 */
function serializeCredential(cred: PublicKeyCredential): Record<string, unknown> {
  const resp = cred.response as AuthenticatorAttestationResponse
  return {
    id: cred.id,
    rawId: bufferToBase64url(cred.rawId),
    type: cred.type,
    response: {
      clientDataJSON: bufferToBase64url(resp.clientDataJSON),
      attestationObject: bufferToBase64url(resp.attestationObject),
    },
  }
}

export function usePasskey() {
  const [serverEnabled, setServerEnabled] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Browser support check
  const browserSupported =
    typeof window !== 'undefined' &&
    typeof window.PublicKeyCredential !== 'undefined' &&
    typeof navigator.credentials?.create === 'function'

  // Check server feature-gate on mount
  useEffect(() => {
    let cancelled = false
    webAuthnApi.status().then(res => {
      if (!cancelled && res.ok && res.data?.enabled) {
        setServerEnabled(true)
      }
    }).catch(() => { /* server unavailable — leave disabled */ })
    return () => { cancelled = true }
  }, [])

  const register = useCallback(async () => {
    if (!serverEnabled || !browserSupported) return
    setBusy(true); setError(null); setSuccess(null)

    try {
      // 1. Get creation options from the server
      const beginRes = await webAuthnApi.registerBegin()
      if (!beginRes.ok) {
        const j = await beginRes.json().catch(() => ({}))
        const errMsg: string = (j as { error?: string }).error ?? `Server error (${beginRes.status})`
        setError(errMsg)
        setBusy(false)
        return
      }
      const options = await beginRes.json() as Record<string, unknown>
      const creationOptions = parseCreationOptions(options)

      // 2. Ask the browser / authenticator
      let credential: Credential | null
      try {
        credential = await navigator.credentials.create({ publicKey: creationOptions })
      } catch (credErr) {
        // User cancelled, authenticator not available, etc.
        const msg = credErr instanceof Error ? credErr.message : 'Authenticator error'
        setError(`Passkey setup cancelled or failed: ${msg}`)
        setBusy(false)
        return
      }

      if (!credential || !(credential instanceof PublicKeyCredential)) {
        setError('No credential returned from authenticator.')
        setBusy(false)
        return
      }

      // 3. Send the response to the server
      const serialized = serializeCredential(credential)
      const completeRes = await webAuthnApi.registerComplete(serialized, 'My passkey')
      if (completeRes.ok) {
        setSuccess('Passkey registered successfully.')
      } else {
        setError(completeRes.error ?? 'Registration verification failed.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error during passkey setup.')
    } finally {
      setBusy(false)
    }
  }, [serverEnabled, browserSupported])

  return { serverEnabled, browserSupported, busy, error, success, register }
}
