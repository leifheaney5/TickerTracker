import { useState } from 'react'
import { FONT_SANS } from '../theme/tokens'

// Squarified treemap — ported from the prototype's _treemap. Tiles sized by
// value, colored by change. Used by the Crypto Map and Market Map.

export interface TreemapItem { sym: string; value: number; chg: number }
interface Laid extends TreemapItem { x: number; y: number; w: number; h: number }

function worst(row: number[], len: number): number {
  const sum = row.reduce((s, v) => s + v, 0)
  const mx = Math.max(...row)
  const mn = Math.min(...row)
  return Math.max((len * len * mx) / (sum * sum), (sum * sum) / (len * len * mn))
}

function squarify(items: TreemapItem[], x: number, y: number, w: number, h: number): Laid[] {
  const sorted = items.slice().sort((a, b) => b.value - a.value)
  const total = sorted.reduce((s, i) => s + i.value, 0) || 1
  const scale = (w * h) / total
  const vals = sorted.map((i) => i.value * scale)
  const res: Laid[] = []
  let rx = x, ry = y, rw = w, rh = h, i = 0
  while (i < vals.length) {
    let row: number[] = []
    const len = Math.min(rw, rh) || 1
    let j = i
    while (j < vals.length) {
      const nr = row.concat(vals[j])
      if (row.length === 0 || worst(nr, len) <= worst(row, len)) { row = nr; j++ } else break
    }
    const rowSum = row.reduce((s, v) => s + v, 0) || 1
    if (rw <= rh) {
      const sh = rowSum / (rw || 1)
      let cx = rx
      for (let k = 0; k < row.length; k++) { const cwd = row[k] / (sh || 1); res.push({ ...sorted[i + k], x: cx, y: ry, w: cwd, h: sh }); cx += cwd }
      ry += sh; rh -= sh
    } else {
      const sw = rowSum / (rh || 1)
      let cy = ry
      for (let k = 0; k < row.length; k++) { const chd = row[k] / (sw || 1); res.push({ ...sorted[i + k], x: rx, y: cy, w: sw, h: chd }); cy += chd }
      rx += sw; rw -= sw
    }
    i += row.length
  }
  return res
}

// Diverging neutral→green/red color (matches _hmColor).
export function heatColor(chg: number): string {
  const t = Math.max(-1, Math.min(1, chg / 3.2))
  const neu = [58, 62, 70]
  const tgt = t >= 0 ? [34, 172, 96] : [214, 58, 58]
  const a = Math.abs(t)
  const m = (c: number) => Math.round(neu[c] + (tgt[c] - neu[c]) * a)
  return `rgb(${m(0)},${m(1)},${m(2)})`
}

interface TreemapProps {
  items: TreemapItem[]
  width: number
  height: number
  onTileClick?: (sym: string) => void
  highlight?: Set<string>
  // When provided, hovering a tile shows a tooltip with this string and
  // outlines the hovered tile. Omitted (e.g. the Crypto map's call) → no hover.
  tipFor?: (sym: string) => string
}

export function Treemap({ items, width, height, onTileClick, highlight, tipFor }: TreemapProps) {
  const tiles = squarify(items, 1, 1, width - 2, height - 2)
  const [tip, setTip] = useState<{ sym: string; x: number; y: number } | null>(null)
  return (
    <div style={{ position: 'relative', width, height }}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ display: 'block' }}
        onMouseLeave={() => setTip(null)}
      >
        {tiles.map((t) => {
          const showLabel = t.w > 34 && t.h > 22
          const outlined = highlight?.has(t.sym) || tip?.sym === t.sym
          return (
            <g
              key={t.sym}
              onClick={() => onTileClick?.(t.sym)}
              onMouseEnter={tipFor ? () => setTip({ sym: t.sym, x: t.x + t.w / 2, y: t.y }) : undefined}
              style={{ cursor: onTileClick ? 'pointer' : 'default' }}
            >
              <rect x={t.x} y={t.y} width={Math.max(0, t.w - 1)} height={Math.max(0, t.h - 1)}
                fill={heatColor(t.chg)}
                stroke={outlined ? '#fff' : undefined}
                strokeWidth={outlined ? 2 : undefined} />
              {showLabel && (
                <>
                  <text x={t.x + t.w / 2} y={t.y + t.h / 2 - 2} fill="#fff" fontSize={Math.min(13, t.w / 4)} fontWeight={700} fontFamily={FONT_SANS} textAnchor="middle">{t.sym}</text>
                  <text x={t.x + t.w / 2} y={t.y + t.h / 2 + 12} fill="rgba(255,255,255,.85)" fontSize={Math.min(11, t.w / 5)} fontFamily="'JetBrains Mono',monospace" textAnchor="middle">{(t.chg >= 0 ? '+' : '') + t.chg.toFixed(1) + '%'}</text>
                </>
              )}
            </g>
          )
        })}
      </svg>
      {tip && tipFor && (
        <div
          data-treemap-tip
          style={{
            position: 'absolute',
            left: Math.min(Math.max(tip.x, 4), width - 4),
            top: tip.y,
            transform: 'translate(-50%, calc(-100% - 6px))',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            background: 'var(--panel,#1a1d24)',
            color: 'var(--tx,#fff)',
            border: '1px solid var(--line,#2a2e36)',
            borderRadius: 8,
            padding: '6px 9px',
            fontSize: 11.5,
            fontFamily: FONT_SANS,
            boxShadow: '0 6px 20px rgba(0,0,0,.4)',
            zIndex: 5,
          }}
        >
          {tipFor(tip.sym)}
        </div>
      )}
    </div>
  )
}
