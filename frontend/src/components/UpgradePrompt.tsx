import { useState } from 'react'
import { useStore } from '../state/store'
import { api } from '../api/client'
import { FONT_SANS } from '../theme/tokens'
import { useFocusTrap } from '../hooks/useFocusTrap'

// Reusable upgrade modal shown when a Free user hits a plan limit. Annual is the
// primary CTA per the commercial offer; both CTAs redirect to Stripe Checkout.
export function UpgradePrompt() {
  const prompt = useStore((s) => s.upgradePrompt)
  const close = useStore((s) => s.closeUpgrade)
  const [busy, setBusy] = useState<'monthly' | 'annual' | null>(null)
  const modalRef = useFocusTrap(!!prompt, close)

  if (!prompt) return null

  const go = async (interval: 'monthly' | 'annual') => {
    setBusy(interval)
    try {
      const { data } = await api.checkout(interval)
      location.href = data.url
    } catch {
      setBusy(null)
    }
  }

  return (
    <div
      onClick={close}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <div
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="upgrade-title"
        style={{ width: '100%', maxWidth: 420, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 18, padding: '26px 26px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}
      >
        <h2 id="upgrade-title" style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--tx)' }}>Upgrade to Ticker Tracker Pro</h2>
        <span style={{ fontSize: '13.5px', color: 'var(--tx2)', lineHeight: 1.5 }}>
          {prompt.message || 'Unlock more watchlist tickers, price alerts, saved screeners, and the weekly digest.'}
        </span>
        <button
          onClick={() => go('annual')}
          disabled={busy !== null}
          style={{ height: 44, borderRadius: 12, border: 'none', background: 'var(--accent)', color: 'var(--accentInk)', fontFamily: FONT_SANS, fontSize: '14px', fontWeight: 800, cursor: 'pointer' }}
        >
          {busy === 'annual' ? 'Redirecting…' : 'Upgrade yearly — $59/yr'}
        </button>
        <button
          onClick={() => go('monthly')}
          disabled={busy !== null}
          style={{ height: 40, borderRadius: 11, border: '1px solid var(--line2)', background: 'transparent', color: 'var(--tx2)', fontFamily: FONT_SANS, fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
        >
          {busy === 'monthly' ? 'Redirecting…' : 'Monthly — $7/mo'}
        </button>
        <button
          onClick={close}
          style={{ alignSelf: 'center', marginTop: 2, background: 'transparent', border: 'none', color: 'var(--tx3)', fontFamily: FONT_SANS, fontSize: '12.5px', cursor: 'pointer' }}
        >
          Maybe later
        </button>
      </div>
    </div>
  )
}
