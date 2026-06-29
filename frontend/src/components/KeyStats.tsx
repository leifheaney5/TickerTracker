import { useStore } from '../state/store'
import { FONT_MONO } from '../theme/tokens'
import { Skeleton } from './Skeleton'
import { money, capStr, volStr, asOf } from '../lib/format'

// Key Statistics grid — ported from the prototype template (lines 359-369).
// Shows ONLY real values from the live quote/fundamentals; anything still in
// flight renders a skeleton (never a UNIVERSE seed value), so a number on this
// panel is always genuine.
export function KeyStats() {
  const selected = useStore((s) => s.selected)
  const quotes = useStore((s) => s.quotes)
  const fundamentals = useStore((s) => s.fundamentals)
  const quotesFetchedAt = useStore((s) => s.quotesFetchedAt)

  const q = quotes[selected]
  const f = fundamentals[selected]

  // A skeleton placeholder for any value whose source fetch hasn't landed yet.
  const sk = <Skeleton inline width={58} height={12} />
  const stats: [string, React.ReactNode][] = [
    ['Open', q ? money(q.day_open) : sk],
    ['Prev Close', q ? money(q.prev_close) : sk],
    ['Day High', q ? money(q.day_high) : sk],
    ['Day Low', q ? money(q.day_low) : sk],
    ['52W High', f ? money(f.week52_high) : sk],
    ['52W Low', f ? money(f.week52_low) : sk],
    ['Volume', q ? (q.volume ? volStr(q.volume) : '—') : sk],
    ['All-Time High', f ? money(f.all_time_high) : sk],
    ['Mkt Cap', f ? capStr(f.market_cap) : sk],
    ['P/E', f ? (f.pe ? String(f.pe) : '—') : sk],
    ['Div Yield', f ? (f.dividend_yield ? f.dividend_yield.toFixed(2) + '%' : '—') : sk],
    ['Beta', f ? String(f.beta) : sk],
  ]

  return (
    <div style={{ flex: 1, minWidth: 300, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 16, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '-.01em', color: 'var(--tx)' }}>Key Statistics</span>
        {quotesFetchedAt && <span style={{ fontSize: '11px', color: 'var(--tx3)' }}>{asOf(quotesFetchedAt)}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: 'var(--line)', borderRadius: 10, overflow: 'hidden' }}>
        {stats.map(([label, value]) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '11px 13px', background: 'var(--card)' }}>
            <span style={{ fontSize: '12px', color: 'var(--tx3)' }}>{label}</span>
            <span style={{ fontFamily: FONT_MONO, fontSize: '12.5px', fontWeight: 500, color: 'var(--tx)' }}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
