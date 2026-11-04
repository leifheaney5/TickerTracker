import { useEffect, useRef, useState } from 'react'
import { useStore } from '../state/store'
import { COMPARE_COLORS, FONT_MONO, FONT_SANS } from '../theme/tokens'
import { Skeleton } from '../components/Skeleton'
import type { Bar, Timeframe } from '../api/types'

// Interactive price chart — ported from the prototype's _chart() (lines
// 1399-1443). Candles/line/area + volume bars, axis labels, last-price tag,
// crosshair + OHLC tooltip on hover, drag-to-zoom (brush), double-click reset,
// and compare mode (normalized % overlays). SVG hand-drawn, sized 1:1 via a
// ResizeObserver to avoid text distortion.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function axisLabel(dateStr: string, tf: Timeframe): string {
  const d = new Date(dateStr)
  if (tf === '1D') return d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0')
  if (tf === '5Y' || tf === '1Y') return MONTHS[d.getMonth()] + " '" + String(d.getFullYear()).slice(2)
  return MONTHS[d.getMonth()] + ' ' + d.getDate()
}

interface Geom { n: number; padL: number; plotW: number; cw?: number }

export function StockChart() {
  const selected = useStore((s) => s.selected)
  const timeframe = useStore((s) => s.timeframe)
  const chartType = useStore((s) => s.chartType)
  const compare = useStore((s) => s.compare)
  const history = useStore((s) => s.history)
  const loadHistory = useStore((s) => s.loadHistory)

  const [width, setWidth] = useState(900)
  const [hover, setHover] = useState<number | null>(null)
  const [brush, setBrush] = useState<{ a: number; b: number } | null>(null)
  const [zoom, setZoom] = useState<{ sym: string; tf: Timeframe; lo: number; hi: number } | null>(null)
  const elRef = useRef<HTMLDivElement | null>(null)
  const geomRef = useRef<Geom | null>(null)
  const brushingRef = useRef(false)
  const zoomBaseRef = useRef(0)

  // Load compare symbols' history too.
  useEffect(() => {
    compare.forEach((s) => loadHistory(s, timeframe))
  }, [compare, timeframe, loadHistory])

  // Reset transient state when symbol/timeframe changes.
  useEffect(() => { setHover(null); setBrush(null); setZoom(null) }, [selected, timeframe])

  // ResizeObserver keeps the SVG sized to its container.
  useEffect(() => {
    const el = elRef.current
    if (!el) return
    const update = () => {
      const w = Math.round(el.getBoundingClientRect().width)
      if (w && Math.abs(w - width) > 1) setWidth(w)
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [width])

  // Live-only: real OHLC from /api/history (no synthetic seed series). Symbols
  // without loaded history yield an empty array and trigger the skeleton below.
  const seriesOf = (sym: string): Bar[] => history[`${sym}:${timeframe}`] || []

  const compareActive = compare.length > 0

  // Render a skeleton until EVERY involved symbol has real history — never draw
  // a chart from fabricated candles.
  const involved = compareActive ? [selected, ...compare] : [selected]
  const ready = involved.every((s) => (history[`${s}:${timeframe}`]?.length ?? 0) > 0)
  if (!ready) {
    return (
      <div ref={elRef} style={{ width: '100%', height: 366, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 0 }}>
        <Skeleton height={300} radius={8} />
      </div>
    )
  }

  const ACC = 'var(--accent)'
  const W = Math.max(360, Math.round(width))
  const H = 366
  const padL = 8
  const padR = 62
  const padT = 12
  const padB = 42
  const plotW = W - padL - padR
  const plotH = H - padT - padB
  const volH = plotH * 0.15
  const priceH = plotH - volH - 6

  let ser = seriesOf(selected)
  zoomBaseRef.current = 0
  if (zoom && zoom.sym === selected && zoom.tf === timeframe && !compareActive) {
    const lo = Math.max(0, zoom.lo)
    const hi = Math.min(ser.length - 1, zoom.hi)
    if (hi - lo >= 2) { ser = ser.slice(lo, hi + 1); zoomBaseRef.current = lo }
  }
  if (!ser.length) return <div ref={elRef} style={{ width: '100%', height: 366 }} />

  const kids: React.ReactNode[] = []
  const grid = (y: number, key: string) => <line key={key} x1={padL} y1={y} x2={W - padR} y2={y} stroke="var(--line)" strokeWidth={1} />
  const lab = (x: number, y: number, t: string, key: string, anchor: 'start' | 'middle' | 'end' = 'start', col: string = 'var(--tx3)', sz = 11) => (
    <text key={key} x={x} y={y} fill={col} fontSize={sz} fontFamily={FONT_MONO} textAnchor={anchor}>{t}</text>
  )

  if (compareActive) {
    const syms = [selected, ...compare]
    const cols = [ACC, ...compare.map((_, i) => COMPARE_COLORS[i % 4])]
    const datas = syms.map((s) => seriesOf(s).map((x) => x.c))
    const norm = datas.map((a) => a.map((v) => (v / a[0] - 1) * 100))
    const flat = norm.flat()
    let pmin = Math.min(...flat)
    let pmax = Math.max(...flat)
    const pp = (pmax - pmin) * 0.12 || 1
    pmin -= pp; pmax += pp
    const yP = (p: number) => padT + priceH - ((p - pmin) / (pmax - pmin || 1)) * priceH
    const n = ser.length
    const X = (i: number) => padL + (n > 1 ? (i / (n - 1)) * plotW : plotW / 2)
    geomRef.current = { n, padL, plotW }
    for (let t = 0; t <= 4; t++) { const val = pmin + (t / 4) * (pmax - pmin); const y = yP(val); kids.push(grid(y, 'g' + t)); kids.push(lab(W - padR + 6, y + 3, (val >= 0 ? '+' : '') + val.toFixed(1) + '%', 'l' + t)) }
    const z = yP(0)
    kids.push(<line key="zero" x1={padL} y1={z} x2={W - padR} y2={z} stroke="var(--line2)" strokeWidth={1} strokeDasharray="3 3" />)
    for (let t = 0; t < 6; t++) { const i = Math.round((t / 5) * (n - 1)); kids.push(lab(X(i), H - 14, axisLabel(ser[i].date, timeframe), 'x' + t, 'middle')) }
    norm.forEach((arr, si) => {
      const d = arr.map((p, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + yP(p).toFixed(1)).join(' ')
      kids.push(<path key={'p' + si} d={d} fill="none" stroke={cols[si]} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />)
      kids.push(<circle key={'c' + si} cx={X(n - 1)} cy={yP(arr[arr.length - 1])} r={3} fill={cols[si]} />)
    })
    if (hover != null && ser[hover]) { const x = X(hover); kids.push(<line key="hl" x1={x} y1={padT} x2={x} y2={padT + priceH} stroke="var(--line2)" strokeWidth={1} />); kids.push(lab(x, padT - 2, axisLabel(ser[hover].date, timeframe), 'hlab', 'middle', 'var(--tx2)', 10)) }
  } else {
    const lows = ser.map((x) => x.l)
    const highs = ser.map((x) => x.h)
    let min = Math.min(...lows)
    let max = Math.max(...highs)
    const pv = (max - min) * 0.08 || 1
    min -= pv; max += pv
    const yP = (v: number) => padT + priceH - ((v - min) / (max - min || 1)) * priceH
    const n = ser.length
    const cw = plotW / n
    const X = (i: number) => padL + (i + 0.5) * cw
    geomRef.current = { n, padL, cw, plotW }
    const maxV = Math.max(...ser.map((x) => x.v))
    const volY0 = padT + priceH + 8
    for (let t = 0; t <= 4; t++) { const val = min + (t / 4) * (max - min); const y = yP(val); kids.push(grid(y, 'g' + t)); kids.push(lab(W - padR + 6, y + 3, '$' + val.toFixed(val > 500 ? 0 : 1), 'l' + t)) }
    for (let t = 0; t < 6; t++) { const i = Math.round((t / 5) * (n - 1)); kids.push(lab(X(i), H - 14, axisLabel(ser[i].date, timeframe), 'x' + t, 'middle')) }
    ser.forEach((c, i) => { const up = c.c >= c.o; const h = Math.max(1, (c.v / (maxV || 1)) * volH); kids.push(<rect key={'v' + i} x={X(i) - cw * 0.3} y={volY0 + volH - h} width={cw * 0.6} height={h} fill={up ? 'var(--up)' : 'var(--down)'} opacity={0.32} />) })
    if (chartType === 'candles') {
      ser.forEach((c, i) => {
        const up = c.c >= c.o
        const col = up ? 'var(--up)' : 'var(--down)'
        const x = X(i)
        const yo = yP(c.o)
        const yc = yP(c.c)
        const bw = Math.max(1.5, cw * 0.58)
        kids.push(<line key={'w' + i} x1={x} y1={yP(c.h)} x2={x} y2={yP(c.l)} stroke={col} strokeWidth={1} />)
        kids.push(<rect key={'b' + i} x={x - bw / 2} y={Math.min(yo, yc)} width={bw} height={Math.max(1, Math.abs(yo - yc))} fill={col} />)
      })
    } else {
      const d = ser.map((c, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + yP(c.c).toFixed(1)).join(' ')
      if (chartType === 'area') {
        const area = d + ' L' + X(n - 1).toFixed(1) + ' ' + (padT + priceH) + ' L' + X(0).toFixed(1) + ' ' + (padT + priceH) + ' Z'
        kids.push(
          <defs key="defs">
            <linearGradient id="cA" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={ACC} stopOpacity={0.28} />
              <stop offset="100%" stopColor={ACC} stopOpacity={0} />
            </linearGradient>
          </defs>
        )
        kids.push(<path key="areaPath" d={area} fill="url(#cA)" />)
      }
      kids.push(<path key="line" d={d} fill="none" stroke={ACC} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />)
    }
    const last = ser[ser.length - 1]
    const ly = yP(last.c)
    const lastUp = last.c >= last.o
    const lcol = lastUp ? 'var(--up)' : 'var(--down)'
    kids.push(<line key="lastline" x1={padL} y1={ly} x2={W - padR} y2={ly} stroke={lcol} strokeWidth={1} strokeDasharray="2 3" opacity={0.55} />)
    kids.push(<rect key="lasttag" x={W - padR + 1} y={ly - 9} width={padR - 2} height={18} rx={3} fill={lcol} />)
    kids.push(<text key="lasttxt" x={W - padR / 2} y={ly + 3} fill="var(--accentInk)" fontSize={11} fontWeight={700} fontFamily={FONT_MONO} textAnchor="middle">{'$' + last.c.toFixed(last.c > 500 ? 0 : 1)}</text>)
    if (brush) { const xa = X(Math.min(brush.a, brush.b)); const xb = X(Math.max(brush.a, brush.b)); kids.push(<rect key="brush" x={Math.min(xa, xb) - cw / 2} y={padT} width={Math.abs(xb - xa) + cw} height={priceH} fill="var(--accent)" opacity={0.13} />) }
    if (hover != null && ser[hover]) {
      const c = ser[hover]
      const x = X(hover)
      const y = yP(c.c)
      const up = c.c >= c.o
      kids.push(<line key="cross" x1={x} y1={padT} x2={x} y2={padT + priceH} stroke="var(--line2)" strokeWidth={1} />)
      kids.push(<circle key="dot" cx={x} cy={y} r={3.5} fill={up ? 'var(--up)' : 'var(--down)'} stroke="var(--bg)" strokeWidth={1.5} />)
      const chgFromStart = (c.c / ser[0].c - 1) * 100
      const chgPos = chgFromStart >= 0
      const tw = 136
      const th = 107
      const tx = x > W - 200 ? x - tw - 10 : x + 10
      const ty = padT + 6
      const rows: [string, string][] = [
        ['Date', axisLabel(c.date, timeframe)], ['Open', '$' + c.o.toFixed(2)], ['High', '$' + c.h.toFixed(2)],
        ['Low', '$' + c.l.toFixed(2)], ['Close', '$' + c.c.toFixed(2)], ['Chg', (chgPos ? '+' : '') + chgFromStart.toFixed(2) + '%'],
      ]
      kids.push(<rect key="ttbg" x={tx} y={ty} width={tw} height={th} rx={8} fill="var(--panel)" stroke="var(--line2)" strokeWidth={1} />)
      rows.forEach((rw, ri) => {
        const yy = ty + 18 + ri * 15
        kids.push(<text key={'tk' + ri} x={tx + 10} y={yy} fill="var(--tx3)" fontSize={10.5} fontFamily={FONT_SANS}>{rw[0]}</text>)
        const vcol = ri === 4 ? (up ? 'var(--up)' : 'var(--down)') : ri === 5 ? (chgPos ? 'var(--up)' : 'var(--down)') : 'var(--tx)'
        kids.push(<text key={'tv' + ri} x={tx + tw - 10} y={yy} fill={vcol} fontSize={10.5} fontWeight={600} fontFamily={FONT_MONO} textAnchor="end">{rw[1]}</text>)
      })
    }
  }

  // ── interaction helpers ── (index resolved against the viewBox width W)
  const onMove = (e: React.MouseEvent) => {
    const g = geomRef.current
    if (!g) return
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const xRatio = (e.clientX - rect.left) / rect.width
    const svgX = xRatio * W
    let i: number
    if (g.cw) i = Math.floor((svgX - g.padL) / g.cw)
    else i = Math.round(((svgX - g.padL) / g.plotW) * (g.n - 1))
    i = Math.max(0, Math.min(g.n - 1, i))
    if (i !== hover) setHover(i)
    if (brushingRef.current) setBrush((b) => ({ a: b ? b.a : i, b: i }))
  }
  const onDown = (e: React.MouseEvent) => {
    if (compareActive) return
    brushingRef.current = true
    const i = onMoveIndex(e)
    setBrush({ a: i, b: i })
  }
  const onMoveIndex = (e: React.MouseEvent): number => {
    const g = geomRef.current
    if (!g) return 0
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const svgX = ((e.clientX - rect.left) / rect.width) * W
    let i: number
    if (g.cw) i = Math.floor((svgX - g.padL) / g.cw)
    else i = Math.round(((svgX - g.padL) / g.plotW) * (g.n - 1))
    return Math.max(0, Math.min(g.n - 1, i))
  }
  const onUp = () => {
    if (!brushingRef.current) return
    brushingRef.current = false
    const b = brush
    setBrush(null)
    if (!b) return
    const lo = Math.min(b.a, b.b)
    const hi = Math.max(b.a, b.b)
    if (hi - lo >= 3) { const base = zoomBaseRef.current; setZoom({ sym: selected, tf: timeframe, lo: base + lo, hi: base + hi }); setHover(null) }
  }

  return (
    <div
      ref={elRef}
      style={{ width: '100%', height: 366, position: 'relative', cursor: 'crosshair', userSelect: 'none' }}
      onMouseMove={onMove}
      onMouseDown={onDown}
      onMouseUp={onUp}
      onDoubleClick={() => { if (zoom) setZoom(null) }}
      onMouseLeave={() => { brushingRef.current = false; if (hover != null || brush) { setHover(null); setBrush(null) } }}
    >
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" width="100%" height="100%" style={{ display: 'block' }}>
        {kids}
      </svg>
    </div>
  )
}
