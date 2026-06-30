import { useEffect, useRef, useState } from 'react'
import { useStore } from '../state/store'
import { FONT_SANS, FONT_MONO } from '../theme/tokens'
import { pulseColor, pulseCaption, type PulseBand } from '../lib/pulse'
import { PulseAbout } from './PulseAbout'

// PulseDial — the signature Pulse motif: a 270° gauge rendering the 0-100 composite score.
// Hand-rolled SVG (same idiom as charts/Sparkline.tsx). Accessibility: the gauge is exposed as a
// `meter`, and meaning is ALWAYS carried by the numeral + caption, never color alone (WCAG 1.4.1).
// The visible caption is plain language ("signals rising") rather than the internal band word
// ("Building"), which read as a loading state; the precise band stays in the meter's aria-label.
// The color ramp never uses red (see lib/pulse.ts) — Pulse is a strength reading, not a buy/sell.

interface Props {
  symbol: string
  size?: number
}

function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const a = (deg * Math.PI) / 180
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)]
}

// Open-bottom gauge: sweeps 135° → 405° (270° over the top) as score goes 0 → 100.
function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const [x0, y0] = polar(cx, cy, r, startDeg)
  const [x1, y1] = polar(cx, cy, r, endDeg)
  const large = endDeg - startDeg > 180 ? 1 : 0
  return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`
}

export function PulseDial({ symbol, size = 56 }: Props) {
  const pulse = useStore((s) => s.pulse[symbol])
  const loadPulse = useStore((s) => s.loadPulse)
  const [aboutOpen, setAboutOpen] = useState(false)
  const infoRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    loadPulse(symbol)
  }, [symbol, loadPulse])

  if (!pulse) return null

  const score = Math.max(0, Math.min(100, pulse.score))
  const band = pulse.band as PulseBand
  const color = pulseColor(band)
  const caption = pulseCaption(band)
  const f = score / 100

  const cx = size / 2
  const cy = size / 2
  const r = size / 2 - 5
  const track = arcPath(cx, cy, r, 135, 405)
  const value = f > 0 ? arcPath(cx, cy, r, 135, 135 + f * 270) : ''

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <div
        role="meter"
        aria-valuenow={Math.round(score)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Pulse ${Math.round(score)} of 100, ${band} — ${caption}`}
        title={`Pulse ${Math.round(score)} — ${band}. A transparent summary of public signals (not advice).`}
        style={{ position: 'relative', width: size, height: size }}
      >
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block' }} aria-hidden="true">
          <path d={track} fill="none" stroke="var(--line2)" strokeWidth={5} strokeLinecap="round" />
          {value && <path d={value} fill="none" stroke={color} strokeWidth={5} strokeLinecap="round" />}
        </svg>
        <span
          style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: FONT_MONO, fontSize: size * 0.3, fontWeight: 700, color: 'var(--tx)',
          }}
        >
          {Math.round(score)}
        </span>
      </div>

      {/* Plain-language strength caption — colored by band so the warm/cool glance-signal survives. */}
      <span style={{ fontFamily: FONT_SANS, fontSize: 10, fontWeight: 700, letterSpacing: '.02em', color }}>
        {caption}
      </span>

      {/* Metric label + info chip. The ⓘ opens the "What is Pulse?" explainer; focus returns here on close. */}
      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontFamily: FONT_SANS, fontSize: 8.5, letterSpacing: '.06em', color: 'var(--tx3)' }}>PULSE</span>
        <button
          ref={infoRef}
          onClick={() => setAboutOpen(true)}
          aria-label="What is Pulse? Learn more"
          aria-haspopup="dialog"
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 13, height: 13, padding: 0, borderRadius: '50%',
            border: '1px solid var(--line2)', background: 'transparent', cursor: 'pointer',
            color: 'var(--tx3)', fontFamily: FONT_SANS, fontSize: 8.5, fontWeight: 700, lineHeight: 1,
          }}
        >
          i
        </button>
      </span>

      <PulseAbout
        open={aboutOpen}
        onClose={() => {
          setAboutOpen(false)
          infoRef.current?.focus()
        }}
      />
    </div>
  )
}
