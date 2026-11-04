/**
 * useTwoFactor — state machine for the TOTP 2FA settings section.
 *
 * Lifecycle:
 *   idle (status unknown) → loading status
 *   → 'disabled': show "Enable" button
 *   → startSetup() → 'setup': show QR + code input
 *   → confirmEnable() → 'enabled': show recovery codes once
 *   → dismissRecoveryCodes() → 'enabled' (codes hidden)
 *   → promptDisable() → 'disabling': show code input
 *   → confirmDisable() → 'disabled'
 */
import { useState, useEffect, useCallback } from 'react'
import { totpApi, type TotpSetupResult } from '../api/twofa'

type TwoFactorStatus = 'loading' | 'enabled' | 'disabled'

export function useTwoFactor() {
  const [status, setStatus] = useState<TwoFactorStatus>('loading')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Setup flow
  const [setupData, setSetupData] = useState<TotpSetupResult | null>(null)
  const [confirmCode, setConfirmCode] = useState('')

  // After successful enable
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null)

  // Disable flow
  const [showDisablePrompt, setShowDisablePrompt] = useState(false)

  // Load current status on mount
  useEffect(() => {
    let cancelled = false
    totpApi.status().then(res => {
      if (cancelled) return
      if (res.ok && res.data) {
        setStatus(res.data.enabled ? 'enabled' : 'disabled')
      } else {
        setStatus('disabled') // graceful fallback
      }
    }).catch(() => {
      if (!cancelled) setStatus('disabled')
    })
    return () => { cancelled = true }
  }, [])

  const startSetup = useCallback(async () => {
    setBusy(true); setError(null)
    const res = await totpApi.setup()
    setBusy(false)
    if (res.ok && res.data) {
      setSetupData(res.data)
      setConfirmCode('')
    } else {
      setError(res.error ?? 'Failed to start 2FA setup.')
    }
  }, [])

  const confirmEnable = useCallback(async () => {
    if (!confirmCode) return
    setBusy(true); setError(null)
    const res = await totpApi.verify(confirmCode)
    setBusy(false)
    if (res.ok && res.data) {
      setStatus('enabled')
      setSetupData(null)
      setConfirmCode('')
      setRecoveryCodes(res.data.recovery_codes)
    } else {
      setError(res.error ?? 'Invalid code. Please try again.')
    }
  }, [confirmCode])

  const dismissRecoveryCodes = useCallback(() => {
    setRecoveryCodes(null)
  }, [])

  const promptDisable = useCallback(() => {
    setShowDisablePrompt(true)
    setConfirmCode('')
    setError(null)
  }, [])

  const confirmDisable = useCallback(async () => {
    if (!confirmCode) return
    setBusy(true); setError(null)
    const res = await totpApi.disable(confirmCode)
    setBusy(false)
    if (res.ok) {
      setStatus('disabled')
      setShowDisablePrompt(false)
      setConfirmCode('')
    } else {
      setError(res.error ?? 'Invalid code. Please try again.')
    }
  }, [confirmCode])

  return {
    status,
    busy,
    error,
    setupData,
    confirmCode,
    setConfirmCode,
    recoveryCodes,
    showDisablePrompt,
    startSetup,
    confirmEnable,
    dismissRecoveryCodes,
    promptDisable,
    confirmDisable,
  }
}
