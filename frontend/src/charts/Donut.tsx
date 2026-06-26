// Allocation donut — ported from the prototype's _donut. Renders proportional
// arc segments around a track circle.

interface DonutProps {
  positions: { sym: string; val: number }[]
  total: number
  colors: string[]
  size?: number
}

export function Donut({ positions, total, colors, size = 176 }: DonutProps) {
  const sw = 24
  const r = (size - sw) / 2
  const cx = size / 2
  const cy = size / 2
  const circ = 2 * Math.PI * r
  let off = 0
  const segs = positions.map((o, i) => {
    const frac = total ? o.val / total : 0
    const seg = (
      <circle
        key={o.sym}
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={colors[i % colors.length]}
        strokeWidth={sw}
        strokeDasharray={`${frac * circ} ${circ}`}
        strokeDashoffset={-off}
        transform={`rotate(-90 ${cx} ${cy})`}
      />
    )
    off += frac * circ
    return seg
  })
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block' }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,.06)" strokeWidth={sw} />
      {segs}
    </svg>
  )
}
