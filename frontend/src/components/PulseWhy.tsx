import { useState } from 'react'
import { useStore } from '../state/store'
import { FONT_SANS, FONT_MONO } from '../theme/tokens'
import { pulseColor, type PulseBand } from '../lib/pulse'
import { PulseTrend } from './PulseTrend'

// PulseWhy — the explainability panel. This is the honesty surface: it shows EACH signal that
// fed the Pulse score, its raw reading, and its contribution. There is no black box. A missing
// signal is simply absent from the table (it was omitted from the score, not zero-filled).

function stateColor(state: string): string {
  if (state === 'Bullish') return 'var(--up)'
  if (state === 'Bearish') return 'var(--down)'
  return 'var(--tx2)'
}

export function PulseWhy() {
  const selected = useStore((s) => s.selected)
  const pulse = useStore((s) => s.pulse[selected])
  const [open, setOpen] = useState(false)

  if (!pulse) return null
  const band = pulse.band as PulseBand
  const maxContribution = Math.max(0.0001, ...pulse.components.map((c) => c.contribution ?? 0))

  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 12, background: 'var(--card)', overflow: 'hidden' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="pulse-why-region"
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 12, padding: '11px 15px', background: 'transparent', border: 'none', cursor: 'pointer',
          fontFamily: FONT_SANS, color: 'var(--tx)',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>Why Pulse is {Math.round(pulse.score)}</span>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.03em', color: pulseColor(band) }}>{band.toUpperCase()}</span>
        </span>
        <span style={{ fontSize: 12, color: 'var(--tx3)' }}>{open ? '▲ Hide' : '▼ See the math'}</span>
      </button>

      {open && (
        <div id="pulse-why-region" role="region" aria-label="Pulse breakdown" style={{ padding: '4px 15px 14px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: FONT_SANS }}>
            <thead>
              <tr style={{ fontSize: 10, letterSpacing: '.04em', color: 'var(--tx3)', textAlign: 'left' }}>
                <th style={{ fontWeight: 600, padding: '4px 0' }}>SIGNAL</th>
                <th style={{ fontWeight: 600, padding: '4px 0' }}>READING</th>
                <th style={{ fontWeight: 600, padding: '4px 0' }}>STATE</th>
                <th style={{ fontWeight: 600, padding: '4px 0', width: '28%' }}>CONTRIBUTION</th>
              </tr>
            </thead>
            <tbody>
              {pulse.components.map((c) => (
                <tr key={c.key} style={{ borderTop: '1px solid var(--line2)' }}>
                  <td style={{ padding: '7px 0', fontSize: 12, color: 'var(--tx)' }}>{c.label}</td>
                  <td style={{ padding: '7px 0', fontSize: 12, fontFamily: FONT_MONO, color: 'var(--tx2)' }}>{c.raw}</td>
                  <td style={{ padding: '7px 0', fontSize: 11.5, fontWeight: 600, color: stateColor(c.state) }}>{c.state}</td>
                  <td style={{ padding: '7px 0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--line2)', overflow: 'hidden' }}>
                        <div style={{ width: `${((c.contribution ?? 0) / maxContribution) * 100}%`, height: '100%', background: pulseColor(band) }} />
                      </div>
                      <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: 'var(--tx3)', minWidth: 30, textAlign: 'right' }}>
                        {(c.contribution ?? 0).toFixed(1)}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <PulseTrend symbol={selected} />
          <p style={{ marginTop: 11, fontSize: 10.5, lineHeight: 1.5, color: 'var(--tx3)' }}>
            {pulse.disclaimer} Sentiment is based on news-headline language, not a sentiment model.
            {' '}As of {new Date(pulse.asOf).toLocaleString()}.
          </p>
        </div>
      )}
    </div>
  )
}
