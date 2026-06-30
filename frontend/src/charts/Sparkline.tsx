import { useEffect } from 'react'
import { useStore } from '../state/store'
import { Skeleton } from '../components/Skeleton'

// 30-day sparkline with gradient fill — ported from the prototype's _spark.
// Live-only: draws real 30d closes from loaded history; while history is in
// flight it self-loads a 1M tail and shows a skeleton (no seeded fallback).

interface SparkProps {
  symbol: string
  width?: number
  height?: number
}

export function Sparkline({ symbol, width = 80, height = 30 }: SparkProps) {
  const chg = useStore((s) => s.chg(symbol))
  // Prefer a loaded 1M/3M history tail.
  const hist = useStore((s) => s.history[`${symbol}:1M`] || s.history[`${symbol}:3M`])
  const loadHistory = useStore((s) => s.loadHistory)

  // Ensure real history is fetched even on views that don't otherwise load it
  // (e.g. At-a-Glance). No-op if already cached.
  useEffect(() => {
    if (!hist || !hist.length) loadHistory(symbol, '1M')
  }, [symbol, hist, loadHistory])

  if (!hist || !hist.length) {
    return <Skeleton width={width} height={height} radius={4} />
  }
  const closes = hist.slice(-30).map((b) => b.c)

  const W = width
  const H = height
  const pad = 3
  const min = Math.min(...closes)
  const max = Math.max(...closes)
  const up = chg >= 0
  const col = up ? 'var(--up)' : 'var(--down)'
  const pts = closes.map((v, i) => [
    pad + (i / (closes.length - 1)) * (W - 2 * pad),
    H - pad - ((v - min) / (max - min || 1)) * (H - 2 * pad),
  ])
  const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ')
  const area = d + ` L${pts[pts.length - 1][0].toFixed(1)} ${H} L${pts[0][0].toFixed(1)} ${H} Z`
  const id = `sg_${symbol}_${W}`

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={col} stopOpacity={0.22} />
          <stop offset="100%" stopColor={col} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={d} fill="none" stroke={col} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}
