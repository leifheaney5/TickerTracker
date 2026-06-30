// frontend/src/hooks/usePushSubscription.ts
// Manages Web Push subscription lifecycle for the current browser/user.
//
// - Reads VAPID public key from the backend on mount.
// - Converts base64url → Uint8Array for PushManager.subscribe().
// - Guards against unsupported browsers and denied permission gracefully.
// - All API calls go through the typed api client (never inline fetch).

import { useState, useEffect, useCallback } from 'react'
import { api } from '../api/client'

type PermState = 'default' | 'granted' | 'denied' | 'unsupported'

function base64UrlToUint8Array(base64: string): Uint8Array {
  // Pad to a multiple of 4 chars and replace URL-safe chars.
  const padded = base64.replace(/-/g, '+').replace(/_/g, '/')
  const padLen = (4 - (padded.length % 4)) % 4
  const b64 = padded + '='.repeat(padLen)
  const raw = atob(b64)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

function arrayBufferToBase64Url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function isSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

export interface PushSubscriptionHook {
  isSupported: boolean
  isSubscribed: boolean
  permissionState: PermState
  busy: boolean
  toggle: () => void
}

export function usePushSubscription(): PushSubscriptionHook {
  const supported = isSupported()
  const [subscribed, setSubscribed] = useState(false)
  const [permState, setPermState] = useState<PermState>(supported ? 'default' : 'unsupported')
  const [vapidKey, setVapidKey] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Load VAPID public key + current subscription state on mount.
  useEffect(() => {
    if (!supported) return
    api.getVapidPublicKey().then(({ data }) => {
      if (data.key) setVapidKey(data.key)
    }).catch(() => { /* VAPID key unavailable — push stays disabled */ })

    setPermState(Notification.permission as PermState)

    // Check if already subscribed
    navigator.serviceWorker.ready.then((reg) => {
      reg.pushManager.getSubscription().then((sub) => {
        setSubscribed(!!sub)
      }).catch(() => setSubscribed(false))
    }).catch(() => { /* SW not ready yet */ })
  }, [supported])

  const subscribe = useCallback(async () => {
    if (!supported || !vapidKey) return
    setBusy(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const permission = await Notification.requestPermission()
      setPermState(permission as PermState)
      if (permission !== 'granted') {
        setBusy(false)
        return
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToUint8Array(vapidKey).buffer as ArrayBuffer,
      })
      const json = sub.toJSON()
      const endpoint = sub.endpoint
      const p256dh = arrayBufferToBase64Url(
        json.keys?.p256dh
          ? base64UrlToUint8Array(json.keys.p256dh).buffer as ArrayBuffer
          : new ArrayBuffer(0)
      )
      const auth = arrayBufferToBase64Url(
        json.keys?.auth
          ? base64UrlToUint8Array(json.keys.auth).buffer as ArrayBuffer
          : new ArrayBuffer(0)
      )
      await api.pushSubscribe(endpoint, p256dh, auth)
      setSubscribed(true)
    } catch (err) {
      console.warn('[push] subscribe failed:', err)
    } finally {
      setBusy(false)
    }
  }, [supported, vapidKey])

  const unsubscribe = useCallback(async () => {
    if (!supported) return
    setBusy(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await api.pushUnsubscribe(sub.endpoint)
        await sub.unsubscribe()
      }
      setSubscribed(false)
    } catch (err) {
      console.warn('[push] unsubscribe failed:', err)
    } finally {
      setBusy(false)
    }
  }, [supported])

  const toggle = useCallback(() => {
    if (subscribed) unsubscribe()
    else subscribe()
  }, [subscribed, subscribe, unsubscribe])

  return {
    isSupported: supported,
    isSubscribed: subscribed,
    permissionState: permState,
    busy,
    toggle,
  }
}
