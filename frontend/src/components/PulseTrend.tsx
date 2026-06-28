import { useEffect } from 'react'
import { useStore } from '../state/store'
import { FONT_SANS } from '../theme/tokens'
import { pulseColor, type PulseBand } from '../lib/pulse'

// PulseTrend — sparkline of the accrued Pulse score series (the first-party signal history).
// Honest by construction: with fewer than 2 real days it renders an "accruing" note rather than
// fabricating back-history (the series genuinely starts the day a symbol is first watched).

interface Props { symbol: string }

export function PulseTrend({ symbol }: Props) {
  const series = useStore((s) => s.pulseHistory[symbol])
  const loadPulseHistory = useStore((s) => s.loadPulseHistory)

  useEffect(() => { loadPulseHistory(symbol) }, [symbol, loadPulseHistory])

  if (!series || series.length < 2) {
    return (
      <p style={{ marginTop: 10, fontSize: 10.5, color: 'var(--tx3)', fontFamily: FONT_SANS }}>
        Pulse history is accruing — the trend appears once there are at least two days of data.
      </p>
    )
  }

  const scores = series.map((p) => p.score)
  const min = Math.min(...scores)
  const max = Math.max(...scores)
  const W = 220, H = 36, pad = 4
  const pts = scores.map((v, i) => [
    pad + (i / (scores.length - 1)) * (W - 2 * pad),
    H - pad - ((v - min) / (max - min || 1)) * (H - 2 * pad),
  ])
  const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ')

  const latest = series[series.length - 1]
  const color = pulseColor(latest.band as PulseBand)

  // "shifted to <band> N days ago": find the last index where the band differs from latest.
  let shiftNote = ''
  for (let i = series.length - 2; i >= 0; i--) {
    if (series[i].band !== latest.band) {
      shiftNote = `Shifted to ${latest.band} ${series.length - 1 - i} day${series.length - 1 - i === 1 ? '' : 's'} ago`
      break
    }
  }

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <span style={{ fontSize: 10.5, letterSpacing: '.04em', color: 'var(--tx3)', fontFamily: FONT_SANS }}>
          PULSE TREND · {series.length}d
        </span>
        {shiftNote && (
          <span style={{ fontSize: 10.5, fontWeight: 600, color, fontFamily: FONT_SANS }}>{shiftNote}</span>
        )}
      </div>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', marginTop: 4 }} aria-hidden="true">
        <path d={d} fill="none" stroke={color} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    </div>
  )
}
