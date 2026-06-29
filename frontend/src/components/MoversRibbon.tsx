import { useState } from 'react'
import { useStore } from '../state/store'
import { FONT_SANS, FONT_MONO } from '../theme/tokens'
import { Logo } from './Logo'
import { Skeleton } from './Skeleton'
import { money, pct } from '../lib/format'

// Movers ribbon — gainers/losers toggle + horizontally scrollable chips,
// ported from the prototype template (lines 222-238). Ranks the watchlist by
// day change.
export function MoversRibbon() {
  const watchSymbols = useStore((s) => s.watchSymbols)
  const chg = useStore((s) => s.chg)
  const price = useStore((s) => s.price)
  const hasQuote = useStore((s) => s.hasQuote)
  const setSelected = useStore((s) => s.setSelected)
  const [tab, setTab] = useState<'gainers' | 'losers'>('gainers')

  const ranked = watchSymbols()
    .slice()
    .sort((a, b) => (tab === 'gainers' ? chg(b) - chg(a) : chg(a) - chg(b)))
    .slice(0, 8)

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '7px 11px', borderRadius: 8, border: 'none', cursor: 'pointer',
    fontFamily: FONT_SANS, fontSize: '12px', fontWeight: active ? 700 : 500,
    background: active ? 'var(--cardHi)' : 'transparent',
    color: active ? 'var(--tx)' : 'var(--tx3)',
  })

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: '0 0 auto' }}>
      <div style={{ display: 'flex', gap: 4, flex: '0 0 auto' }}>
        <button onClick={() => setTab('gainers')} style={tabStyle(tab === 'gainers')}>▲ Gainers</button>
        <button onClick={() => setTab('losers')} style={tabStyle(tab === 'losers')}>▼ Losers</button>
      </div>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2, flex: 1 }}>
        {ranked.map((sym) => {
          const c = chg(sym)
          const live = hasQuote(sym)
          return (
            <div
              key={sym}
              onClick={() => setSelected(sym)}
              style={{ flex: '0 0 auto', minWidth: 120, padding: '8px 11px', borderRadius: 10, background: 'var(--card)', border: '1px solid var(--line)', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 2 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <Logo symbol={sym} size={18} />
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--tx)' }}>{sym}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
                {live
                  ? <span style={{ fontFamily: FONT_MONO, fontSize: '11px', color: 'var(--tx2)' }}>{money(price(sym))}</span>
                  : <Skeleton inline width={46} height={11} />}
                {live
                  ? <span style={{ fontFamily: FONT_MONO, fontSize: '11px', fontWeight: 600, color: c >= 0 ? 'var(--up)' : 'var(--down)' }}>{pct(c)}</span>
                  : <Skeleton inline width={34} height={11} />}
              </div>
            </div>
          )
        })}
        {ranked.length === 0 && <span style={{ color: 'var(--tx3)', fontSize: 12, fontFamily: FONT_SANS }}>No movers</span>}
      </div>
    </div>
  )
}
