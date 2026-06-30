// PulseAbout — the "What is Pulse?" explainer modal, opened from the ⓘ chip on PulseDial.
// This is the CONCEPTUAL surface (what Pulse IS and how it's built); the per-ticker math lives in
// PulseWhy. Mirrors the ShortcutsHelp modal idiom: open/onClose, fixed backdrop closes on click,
// inner card stops propagation. Adds role=dialog + aria-modal + Escape, and returns focus to the
// opener on close so keyboard users aren't dropped at the top of the page.

import { useEffect, useRef } from 'react'
import { FONT_SANS, FONT_MONO } from '../theme/tokens'

interface Props {
  open: boolean
  onClose: () => void
}

// The five published Pulse components and their weights — mirrors backend services/pulse.py WEIGHTS
// (sum to 100% when every signal is available). Static by design: this explains the method, it does
// not read a live score.
const SIGNALS: { label: string; detail: string; weight: string }[] = [
  { label: 'Momentum', detail: 'RSI — is the recent move overbought or oversold', weight: '22%' },
  { label: 'Trend', detail: '50/200-day moving averages + MACD', weight: '22%' },
  { label: 'Analyst view', detail: 'consensus rating and price-target gap', weight: '20%' },
  { label: '52-week positioning', detail: 'where price sits in its yearly range', weight: '18%' },
  { label: 'News sentiment', detail: 'tone of recent headlines (wording, not an ML model)', weight: '18%' },
]

export function PulseAbout({ open, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null)

  // Escape closes; focus the close button on open so the dialog is immediately keyboard-operable.
  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    // Backdrop — click anywhere outside the card closes.
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 200,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pulse-about-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--panel)',
          border: '1px solid var(--line2)',
          borderRadius: 14,
          boxShadow: '0 24px 60px rgba(0,0,0,.6)',
          padding: '24px 28px 26px',
          minWidth: 320,
          maxWidth: 460,
          width: '90vw',
          color: 'var(--tx)',
          fontFamily: FONT_SANS,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span id="pulse-about-title" style={{ fontWeight: 700, fontSize: '15px' }}>What is Pulse?</span>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Close Pulse explainer"
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--tx3)', fontSize: '18px', lineHeight: 1, padding: 2,
            }}
          >
            ×
          </button>
        </div>

        <p style={{ margin: '0 0 16px', fontSize: '13px', lineHeight: 1.55, color: 'var(--tx2)' }}>
          Pulse blends five independent, public signals into one <strong style={{ color: 'var(--tx)' }}>0–100
          strength reading</strong>. A higher number means the signals are leaning more positive right now —
          it is a momentum summary, <strong style={{ color: 'var(--tx)' }}>not</strong> a measure of data
          quality, company quality, or a buy/sell call.
        </p>

        {/* Signals + weights */}
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            {SIGNALS.map((s, i) => (
              <tr key={s.label} style={{ borderTop: i === 0 ? 'none' : '1px solid var(--line)' }}>
                <td style={{ padding: '8px 0', verticalAlign: 'top', width: 132 }}>
                  <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--tx)' }}>{s.label}</div>
                  <div style={{ fontSize: '11px', color: 'var(--tx3)', lineHeight: 1.4 }}>{s.detail}</div>
                </td>
                <td style={{ padding: '8px 0 8px 12px', verticalAlign: 'top', textAlign: 'right', fontFamily: FONT_MONO, fontSize: '12px', color: 'var(--tx2)' }}>
                  {s.weight}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <p style={{ margin: '16px 0 0', fontSize: '11.5px', lineHeight: 1.55, color: 'var(--tx3)' }}>
          If a signal can't be computed it's <strong style={{ color: 'var(--tx2)' }}>left out and the
          remaining weights are rebalanced</strong> — never counted as zero, which would unfairly drag the
          score down. So Pulse only reflects what's actually known.
        </p>
        <p style={{ margin: '10px 0 0', fontSize: '11.5px', lineHeight: 1.5, color: 'var(--tx3)' }}>
          Pulse is a transparent summary of public signals — not investment advice.
        </p>
      </div>
    </div>
  )
}
