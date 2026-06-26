import { useStore } from '../state/store'
import { COLORS, FONT_MONO } from '../theme/tokens'
import { UNIVERSE } from '../data/universe'
import { money, capStr } from '../lib/format'

// Key Statistics grid — ported from the prototype template (lines 359-369).
// Reads real fundamentals + quote where available, falls back to universe seed.
export function KeyStats() {
  const selected = useStore((s) => s.selected)
  const quotes = useStore((s) => s.quotes)
  const fundamentals = useStore((s) => s.fundamentals)
  const history = useStore((s) => s.history)

  const u = UNIVERSE[selected] || ({} as typeof UNIVERSE[string])
  const q = quotes[selected]
  const f = fundamentals[selected]
  const bars = history[`${selected}:3M`] || history[`${selected}:1M`]

  const dash = '—'
  const stats: [string, string][] = [
    ['Open', q ? money(q.day_open) : dash],
    ['Prev Close', q ? money(q.day_open) : dash],
    ['Day High', q ? money(q.day_high) : dash],
    ['Day Low', q ? money(q.day_low) : dash],
    ['52W High', f ? money(f.week52_high) : dash],
    ['52W Low', f ? money(f.week52_low) : dash],
    ['Volume', q ? (q.volume / 1e6).toFixed(1) + 'M' : u.vol || dash],
    ['All-Time High', f ? money(f.all_time_high) : dash],
    ['Mkt Cap', f ? capStr(f.market_cap) : u.cap || dash],
    ['P/E', f && f.pe ? String(f.pe) : u.pe || dash],
    ['Div Yield', f ? (f.dividend_yield ? f.dividend_yield.toFixed(2) + '%' : '—') : u.div || dash],
    ['Beta', f ? String(f.beta) : dash],
  ]
  void bars

  return (
    <div style={{ flex: 1, minWidth: 300, background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: 16, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <span style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '-.01em', color: COLORS.tx }}>Key Statistics</span>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: COLORS.line, borderRadius: 10, overflow: 'hidden' }}>
        {stats.map(([label, value]) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '11px 13px', background: COLORS.card }}>
            <span style={{ fontSize: '12px', color: COLORS.tx3 }}>{label}</span>
            <span style={{ fontFamily: FONT_MONO, fontSize: '12.5px', fontWeight: 500, color: COLORS.tx }}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
