import { useEffect, useRef, useState } from 'react'
import { FONT_MONO } from '../theme/tokens'

// Normalized %-growth overlay: portfolio vs a benchmark ETF (SPY/QQQ).
// Both series are expressed as percent change from their first aligned date,
// so the chart always starts at 0% for both lines.
//
// Inputs are parallel arrays of the same length: dates[], portfolio_pct[],
// benchmark_pct[]. The chart is SVG, responsive via ResizeObserver.

interface Props {
  dates: string[]
  portfolioPct: number[]
  benchmarkPct: number[]
  index: string
  /** Brief caution label rendered below the chart. */
  disclaimer: string
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function dateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  return MONTHS[d.getUTCMonth()] + " '" + String(d.getUTCFullYear()).slice(2)
}

export function BenchmarkChart({ dates, portfolioPct, benchmarkPct, index, disclaimer }: Props) {
  const [width, setWidth] = useState(640)
  const [hover, setHover] = useState<number | null>(null)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => {
      const w = Math.round(el.getBoundingClientRect().width)
      if (w > 0) setWidth(w)
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const N = dates.length
  if (N === 0) return null

  const H = 220
  const padL = 10
  const padR = 56
  const padT = 16
  const padB = 28
  const W = Math.max(320, width)
  const pw = W - padL - padR
  const ph = H - padT - padB

  const allVals = [...portfolioPct, ...benchmarkPct]
  let minV = Math.min(...allVals)
  let maxV = Math.max(...allVals)
  const pad = (maxV - minV) * 0.12 || 5
  minV -= pad
  maxV += pad

  const X = (i: number) => padL + (N > 1 ? (i / (N - 1)) * pw : pw / 2)
  const Y = (v: number) => padT + ph - ((v - minV) / (maxV - minV || 1)) * ph

  const linePath = (vals: number[]) =>
    vals.map((v, i) => (i === 0 ? 'M' : 'L') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1)).join(' ')

  // Y-axis grid lines (5 ticks)
  const grid: React.ReactNode[] = []
  for (let t = 0; t <= 4; t++) {
    const v = minV + (t / 4) * (maxV - minV)
    const y = Y(v)
    const label = (v >= 0 ? '+' : '') + v.toFixed(1) + '%'
    grid.push(
      <line key={'g' + t} x1={padL} y1={y} x2={W - padR} y2={y}
        stroke="var(--line)" strokeWidth={1} />,
      <text key={'l' + t} x={W - padR + 5} y={y + 3.5}
        fill="var(--tx3)" fontSize={10} fontFamily={FONT_MONO}>{label}</text>
    )
  }

  // X-axis date ticks (up to 5 evenly spaced)
  const xTicks: React.ReactNode[] = []
  const tickCount = Math.min(5, N)
  for (let k = 0; k < tickCount; k++) {
    const i = Math.round((k / (tickCount - 1 || 1)) * (N - 1))
    const x = X(i)
    xTicks.push(
      <text key={'xt' + k} x={x} y={H - 5}
        fill="var(--tx3)" fontSize={10} fontFamily={FONT_MONO}
        textAnchor="middle">{dateLabel(dates[i])}</text>
    )
  }

  // Hover crosshair
  const hLine: React.ReactNode = hover != null ? (
    <line x1={X(hover)} y1={padT} x2={X(hover)} y2={padT + ph}
      stroke="var(--tx3)" strokeWidth={1} strokeDasharray="3 3" />
  ) : null

  const portfolioColor = portfolioPct[N - 1] >= 0 ? 'var(--up)' : 'var(--down)'

  // Tooltip
  let tooltip: React.ReactNode = null
  if (hover != null) {
    const px = X(hover)
    const pPct = portfolioPct[hover]
    const bPct = benchmarkPct[hover]
    const tipX = px > W * 0.65 ? px - 136 : px + 10
    const tipY = padT + 8
    tooltip = (
      <g>
        <rect x={tipX} y={tipY} width={128} height={58}
          rx={6} fill="var(--card)" stroke="var(--line)" strokeWidth={1} />
        <text x={tipX + 8} y={tipY + 16} fill="var(--tx3)" fontSize={10} fontFamily={FONT_MONO}>
          {dateLabel(dates[hover])}
        </text>
        <circle cx={tipX + 14} cy={tipY + 30} r={4} fill={portfolioColor} />
        <text x={tipX + 22} y={tipY + 34} fill={portfolioColor} fontSize={11} fontFamily={FONT_MONO}>
          {(pPct >= 0 ? '+' : '') + pPct.toFixed(2)}%
        </text>
        <circle cx={tipX + 14} cy={tipY + 46} r={4} fill="var(--tx3)" />
        <text x={tipX + 22} y={tipY + 50} fill="var(--tx3)" fontSize={11} fontFamily={FONT_MONO}>
          {index}: {(bPct >= 0 ? '+' : '') + bPct.toFixed(2)}%
        </text>
      </g>
    )
  }

  return (
    <div data-testid="benchmark-chart" style={{ width: '100%' }}>
      <div ref={ref} style={{ width: '100%', height: H }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          width="100%"
          height="100%"
          style={{ display: 'block', overflow: 'visible' }}
          onMouseMove={(e) => {
            const rect = (e.currentTarget as SVGElement).getBoundingClientRect()
            const xFrac = (e.clientX - rect.left - padL) / pw
            const i = Math.max(0, Math.min(N - 1, Math.round(xFrac * (N - 1))))
            setHover(i)
          }}
          onMouseLeave={() => setHover(null)}
        >
          {grid}
          {xTicks}
          {hLine}
          {/* Benchmark line (dashed, muted) */}
          <path
            d={linePath(benchmarkPct)}
            fill="none"
            stroke="var(--tx3)"
            strokeWidth={1.5}
            strokeDasharray="4 3"
          />
          {/* Portfolio line (solid, colored) */}
          <path
            d={linePath(portfolioPct)}
            fill="none"
            stroke={portfolioColor}
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {tooltip}
        </svg>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginTop: 6, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width={20} height={6}>
            <line x1={0} y1={3} x2={20} y2={3}
              stroke={portfolioColor} strokeWidth={2.2} strokeLinecap="round" />
          </svg>
          <span style={{ fontSize: '11.5px', color: 'var(--tx2)', fontFamily: FONT_MONO }}>Portfolio</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width={20} height={6}>
            <line x1={0} y1={3} x2={20} y2={3}
              stroke="var(--tx3)" strokeWidth={1.5} strokeDasharray="4 3" />
          </svg>
          <span style={{ fontSize: '11.5px', color: 'var(--tx3)', fontFamily: FONT_MONO }}>{index}</span>
        </div>
      </div>

      {/* Honesty disclaimer — always visible */}
      <p data-testid="benchmark-disclaimer" style={{ margin: '8px 0 0', fontSize: '11px', color: 'var(--tx3)', lineHeight: 1.5 }}>
        {disclaimer}
      </p>
    </div>
  )
}
