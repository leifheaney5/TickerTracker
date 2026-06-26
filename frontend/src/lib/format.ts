// Number/price formatting helpers — ported from the prototype (money/cmoney/
// caxis/pct). Kept identical so all figures render exactly as the prototype.

export function money(v: number): string {
  return '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function cmoney(v: number): string {
  if (v >= 1000) return '$' + v.toLocaleString('en-US', { maximumFractionDigits: 0 })
  if (v >= 1) return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return '$' + v.toFixed(4)
}

export function pct(v: number): string {
  return (v >= 0 ? '+' : '') + v.toFixed(2) + '%'
}

// Compact market-cap formatting from a raw number (backend gives ints).
export function capStr(v: number): string {
  if (!v) return '—'
  if (v >= 1e12) return '$' + (v / 1e12).toFixed(2) + 'T'
  if (v >= 1e9) return '$' + (v / 1e9).toFixed(1) + 'B'
  if (v >= 1e6) return '$' + (v / 1e6).toFixed(1) + 'M'
  return '$' + v.toLocaleString('en-US')
}
