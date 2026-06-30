/**
 * useQuoteStream — optional SSE accelerator for live quote updates.
 *
 * On mount:
 *   1. Fetches GET /api/stream/status to check whether the backend has
 *      FINNHUB_STREAM_ENABLED set.
 *   2. If enabled, opens an EventSource to /api/stream/quotes?symbols=...
 *      and merges incoming quotes into the Zustand store using the same
 *      flash/merge path as pollQuotes (no duplicate flash logic).
 *   3. On error or close, backs off exponentially with a circuit breaker.
 *      After failThreshold consecutive failures the circuit opens and the
 *      hook gives up streaming, letting the always-on 60s poll in App.tsx
 *      serve as the sole data source.
 *   4. If streaming is disabled (status.enabled = false), the hook is a
 *      complete no-op — the existing 60s poll keeps running unchanged.
 *
 * Architecture note: the 60s poll in App.tsx is always active regardless of
 * streaming state — streaming is an *accelerator*, not a replacement.
 *
 * The hook exposes `streamStatus` so the UI can optionally surface it.
 */

import { useEffect, useRef, useState } from 'react'
import { useStore } from '../state/store'
import { streamBackoff, StreamCircuitBreaker } from '../lib/streamHelpers'
import type { Quote } from '../api/types'

// ── Constants ─────────────────────────────────────────────────────────────────

const FAIL_THRESHOLD = 5
const RESET_TIMEOUT_MS = 60_000
const FLASH_DURATION_MS = 650

// ── Types ─────────────────────────────────────────────────────────────────────

export type StreamStatus = 'idle' | 'connecting' | 'streaming' | 'backoff' | 'disabled' | 'tripped'

export interface UseQuoteStreamResult {
  /** Current state of the SSE connection. */
  streamStatus: StreamStatus
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useQuoteStream(symbols: string[]): UseQuoteStreamResult {
  const [streamStatus, setStreamStatus] = useState<StreamStatus>('idle')

  // Keep a stable ref to symbols so the effect closure doesn't stale-close.
  const symbolsRef = useRef<string[]>(symbols)
  useEffect(() => { symbolsRef.current = symbols }, [symbols])

  useEffect(() => {
    // No symbols = nothing to stream.
    if (symbols.length === 0) return

    let cancelled = false
    let esRef: EventSource | null = null
    let retryTimer: ReturnType<typeof setTimeout> | null = null
    let flashTimer: ReturnType<typeof setTimeout> | null = null

    const cb = new StreamCircuitBreaker(FAIL_THRESHOLD, RESET_TIMEOUT_MS)
    let attempt = 0

    // ── Quote merge (mirrors pollQuotes in store.ts) ───────────────────────
    function mergeQuotes(incoming: Record<string, Quote>): void {
      const store = useStore.getState()
      const prev = store.quotes
      const flash: Record<string, 'up' | 'down' | null> = {}

      for (const sym of Object.keys(incoming)) {
        const oldPrice = prev[sym]?.price
        const newPrice = incoming[sym].price
        flash[sym] =
          oldPrice === undefined ? null
          : newPrice > oldPrice ? 'up'
          : newPrice < oldPrice ? 'down'
          : null
      }

      useStore.setState({ quotes: { ...prev, ...incoming }, flash })

      // Clear flash after the standard window.
      if (flashTimer) clearTimeout(flashTimer)
      flashTimer = setTimeout(() => {
        if (!cancelled) useStore.setState({ flash: {} })
      }, FLASH_DURATION_MS)
    }

    // ── EventSource lifecycle ─────────────────────────────────────────────
    function connect(): void {
      if (cancelled) return

      const now = Date.now()
      if (!cb.allow(now)) {
        setStreamStatus('tripped')
        return  // circuit open; fall back to poll only
      }

      const syms = symbolsRef.current
      if (!syms.length) return

      const url = `/api/stream/quotes?symbols=${syms.join(',')}`
      setStreamStatus('connecting')

      const es = new EventSource(url)
      esRef = es

      es.onopen = () => {
        if (cancelled) { es.close(); return }
        setStreamStatus('streaming')
        cb.recordSuccess()
        attempt = 0
      }

      es.onmessage = (evt: MessageEvent<string>) => {
        if (cancelled) { es.close(); return }
        try {
          const payload = JSON.parse(evt.data) as { quotes: Record<string, Quote>; source: string }
          if (payload.quotes && typeof payload.quotes === 'object') {
            mergeQuotes(payload.quotes)
          }
        } catch {
          // Malformed frame — ignore; keep connection open.
        }
      }

      es.addEventListener('close', () => {
        // Backend signals reconnect after max_ticks.
        es.close()
        esRef = null
        scheduleReconnect()
      })

      es.onerror = () => {
        es.close()
        esRef = null
        if (cancelled) return
        cb.recordFailure(Date.now())
        scheduleReconnect()
      }
    }

    function scheduleReconnect(): void {
      if (cancelled) return
      const delay = streamBackoff(attempt)
      attempt++
      setStreamStatus('backoff')
      retryTimer = setTimeout(() => {
        if (!cancelled) connect()
      }, delay)
    }

    // ── Init: check status then connect ──────────────────────────────────
    async function init(): Promise<void> {
      try {
        const resp = await fetch('/api/stream/status')
        if (!resp.ok) { setStreamStatus('disabled'); return }
        const body = await resp.json() as { enabled: boolean }
        if (!body.enabled) { setStreamStatus('disabled'); return }
      } catch {
        setStreamStatus('disabled')
        return
      }
      if (!cancelled) connect()
    }

    void init()

    return () => {
      cancelled = true
      if (esRef) { esRef.close(); esRef = null }
      if (retryTimer) clearTimeout(retryTimer)
      if (flashTimer) clearTimeout(flashTimer)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbols.join(',')])  // re-run when the symbol set changes

  return { streamStatus }
}
