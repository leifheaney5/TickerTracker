import { useEffect, useRef, useState } from 'react'
import { COLORS, FONT_MONO } from '../theme/tokens'
import { makeRng } from '../data/series'

// Strategy equity curve — ported from the prototype's _equityCurve: a strategy
// area vs a dashed benchmark line, deterministically generated.
export function EquityCurve() {
  const [width, setWidth] = useState(800)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => { const w = Math.round(el.getBoundingClientRect().width); if (w) setWidth(w) }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const r = makeRng(20260625)
  const N = 180
  let eq = 0, bm = 0
  const eqA: number[] = [], bmA: number[] = []
  for (let i = 0; i < N; i++) { eq += (r() - 0.40) * 1.25; bm += (r() - 0.45) * 0.9; eqA.push(eq); bmA.push(bm) }
  const W = Math.max(320, Math.round(width)), H = 286, padL = 8, padR = 66, padT = 14, padB = 24
  const pw = W - padL - padR, ph = H - padT - padB
  const all = eqA.concat(bmA)
  let min = Math.min(...all), max = Math.max(...all)
  const pv = (max - min) * 0.1 || 1
  min -= pv; max += pv
  const yP = (v: number) => padT + ph - ((v - min) / (max - min || 1)) * ph
  const X = (i: number) => padL + (i / (N - 1)) * pw
  const path = (a: number[]) => a.map((v, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + yP(v).toFixed(1)).join(' ')
  const up = eqA[N - 1] >= 0
  const col = up ? COLORS.up : COLORS.down
  const grid = []
  for (let t = 0; t <= 4; t++) { const val = min + (t / 4) * (max - min); const y = yP(val); grid.push(<line key={'g' + t} x1={padL} y1={y} x2={W - padR} y2={y} stroke={COLORS.line} strokeWidth={1} />); grid.push(<text key={'l' + t} x={W - padR + 6} y={y + 3} fill={COLORS.tx3} fontSize={11} fontFamily={FONT_MONO}>{(val >= 0 ? '+' : '') + val.toFixed(0) + '%'}</text>) }

  return (
    <div ref={ref} style={{ width: '100%', height: 286 }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" width="100%" height="100%" style={{ display: 'block' }}>
        {grid}
        <defs>
          <linearGradient id="eqg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={col} stopOpacity={0.28} />
            <stop offset="100%" stopColor={col} stopOpacity={0} />
          </linearGradient>
        </defs>
        <path d={path(bmA)} fill="none" stroke={COLORS.tx3} strokeWidth={1.5} strokeDasharray="4 3" />
        <path d={path(eqA) + ` L${X(N - 1).toFixed(1)} ${padT + ph} L${X(0).toFixed(1)} ${padT + ph} Z`} fill="url(#eqg)" />
        <path d={path(eqA)} fill="none" stroke={col} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}
