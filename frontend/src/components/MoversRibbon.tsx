import { useState } from 'react'
import { useStore } from '../state/store'
import { COLORS, FONT_SANS, FONT_MONO } from '../theme/tokens'
import { Logo } from './Logo'
import { money, pct } from '../lib/format'

// Movers ribbon — gainers/losers toggle + horizontally scrollable chips,
// ported from the prototype template (lines 222-238). Ranks the watchlist by
// day change.
export function MoversRibbon() {
  const watchSymbols = useStore((s) => s.watchSymbols)
  const chg = useStore((s) => s.chg)
  const price = useStore((s) => s.price)
  const setSelected = useStore((s) => s.setSelected)
  const [tab, setTab] = useState<'gainers' | 'losers'>('gainers')

  const ranked = watchSymbols()
    .slice()
    .sort((a, b) => (tab === 'gainers' ? chg(b) - chg(a) : chg(a) - chg(b)))
    .slice(0, 8)

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '7px 11px', borderRadius: 8, border: 'none', cursor: 'pointer',
    fontFamily: FONT_SANS, fontSize: '12px', fontWeight: active ? 700 : 500,
    background: active ? COLORS.cardHi : 'transparent',
    color: active ? COLORS.tx : COLORS.tx3,
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
          return (
            <div
              key={sym}
              onClick={() => setSelected(sym)}
              style={{ flex: '0 0 auto', minWidth: 120, padding: '8px 11px', borderRadius: 10, background: COLORS.card, border: `1px solid ${COLORS.line}`, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 2 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <Logo symbol={sym} size={18} />
                <span style={{ fontSize: '12px', fontWeight: 700, color: COLORS.tx }}>{sym}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
                <span style={{ fontFamily: FONT_MONO, fontSize: '11px', color: COLORS.tx2 }}>{money(price(sym))}</span>
                <span style={{ fontFamily: FONT_MONO, fontSize: '11px', fontWeight: 600, color: c >= 0 ? COLORS.up : COLORS.down }}>{pct(c)}</span>
              </div>
            </div>
          )
        })}
        {ranked.length === 0 && <span style={{ color: COLORS.tx3, fontSize: 12, fontFamily: FONT_SANS }}>No movers</span>}
      </div>
    </div>
  )
}
