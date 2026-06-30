/**
 * Pure helpers for frontend SSE stream management.
 *
 * streamBackoff   – deterministic exponential backoff (ms)
 * StreamCircuitBreaker – mirrors the backend CircuitBreaker; injected-clock
 *                        for deterministic unit tests.
 *
 * No DOM or React dependencies: these are pure functions/classes that the
 * useQuoteStream hook composes.
 */

/**
 * Exponential backoff delay in milliseconds.
 *
 * @param attempt  – zero-based reconnect attempt count
 * @param base     – initial delay in ms (default 1000)
 * @param cap      – maximum delay in ms (default 30 000)
 * @returns        delay in ms, capped at `cap`
 */
export function streamBackoff(
  attempt: number,
  base = 1_000,
  cap = 30_000,
): number {
  return Math.min(base * Math.pow(2, attempt), cap)
}

// ── Circuit breaker ──────────────────────────────────────────────────────────

export type CircuitState = 'closed' | 'open' | 'half_open'

export class StreamCircuitBreaker {
  private _state: CircuitState = 'closed'
  private _failures = 0
  private _openedAt: number | null = null
  private readonly failThreshold: number
  private readonly resetTimeout: number // ms

  constructor(failThreshold: number, resetTimeout: number) {
    this.failThreshold = failThreshold
    this.resetTimeout = resetTimeout
  }

  get state(): CircuitState {
    return this._state
  }

  /**
   * Returns true if a connection attempt should proceed.
   * @param now – current timestamp in ms (injectable for tests)
   */
  allow(now: number): boolean {
    if (this._state === 'closed') return true
    if (this._state === 'open') {
      if (this._openedAt !== null && now - this._openedAt >= this.resetTimeout) {
        this._state = 'half_open'
        return true
      }
      return false
    }
    // half_open: allow the single pending trial
    return true
  }

  /** Call after a successful connection to reset to closed state. */
  recordSuccess(): void {
    this._state = 'closed'
    this._failures = 0
    this._openedAt = null
  }

  /**
   * Record a failure.  Trips the breaker once failThreshold is reached.
   * @param now – current timestamp in ms (injectable for tests)
   */
  recordFailure(now: number): void {
    this._failures++
    if (this._state === 'half_open' || this._failures >= this.failThreshold) {
      this._state = 'open'
      this._openedAt = now
    }
  }
}
