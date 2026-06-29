import type { CSSProperties } from 'react'

// Loading placeholder — a shimmering bar shown while real data is in flight.
//
// This exists so the app NEVER renders a plausible-but-fake value (a seed
// price, a templated "50 / Neutral", a stale UNIVERSE market cap) during the
// load window. A skeleton is unmistakably "not data yet", so users can't
// confuse it with a real reading. Once the API responds, the caller swaps the
// skeleton for the genuine value.
//
// `width`/`height` accept any CSS length (number → px). `inline` renders an
// inline-block sized to sit inside a text cell; otherwise it's a block.

interface SkeletonProps {
  width?: number | string
  height?: number | string
  radius?: number | string
  inline?: boolean
  style?: CSSProperties
}

const len = (v: number | string | undefined, fallback: string) =>
  v == null ? fallback : typeof v === 'number' ? `${v}px` : v

export function Skeleton({ width, height, radius = 6, inline = false, style }: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: inline ? 'inline-block' : 'block',
        width: len(width, inline ? '3.5em' : '100%'),
        height: len(height, inline ? '1em' : '100%'),
        borderRadius: len(radius, '6px'),
        verticalAlign: inline ? 'middle' : undefined,
        background:
          'linear-gradient(90deg, var(--cardHi) 25%, var(--line2) 50%, var(--cardHi) 75%)',
        backgroundSize: '200% 100%',
        animation: 'ttshimmer 1.3s ease-in-out infinite',
        ...style,
      }}
    />
  )
}
