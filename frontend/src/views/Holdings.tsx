import { useEffect } from 'react'
import { useStore } from '../state/store'
import { COLORS, FONT_SANS, FONT_MONO, COMPARE_COLORS } from '../theme/tokens'
import { UNIVERSE } from '../data/universe'
import { Logo } from '../components/Logo'
import { Donut } from '../charts/Donut'
import { money, pct } from '../lib/format'

// Portfolio / Holdings view — ported from the prototype template (lines
// 1095-1180). Connected: summary cards, allocation donut, positions table.
// Disconnected: a "connect in Settings" empty state. Values masked when
// hide_balances is on.
const DONUT_COLORS = ['#3ddc84', ...COMPARE_COLORS, '#ffb347', '#5b9cff', '#e9ebee']

export function Holdings() {
  const settings = useStore((s) => s.settings)
  const holdings = useStore((s) => s.holdings)
  const loadHoldings = useStore((s) => s.loadHoldings)
  const price = useStore((s) => s.price)
  const chg = useStore((s) => s.chg)
  const setSelected = useStore((s) => s.setSelected)
  const setView = useStore((s) => s.setView)

  useEffect(() => { loadHoldings() }, [loadHoldings])

  const connected = settings?.broker_connected ?? false
  const hide = settings?.hide_balances ?? false
  const mask = (s: string) => (hide ? '••••' : s)

  // Effective positions: real holdings, else (for a connected demo account) the
  // seeded share counts from the universe so the view is populated.
  const positions = holdings.length
    ? holdings
    : Object.entries(UNIVERSE)
        .filter(([, u]) => u.shares > 0)
        .map(([symbol, u]) => ({ symbol, shares: u.shares, avg_cost: u.cost }))

  const rows = positions.map((h) => {
    const p = price(h.symbol)
    const value = p * h.shares
    const cost = h.avg_cost * h.shares
    const gain = value - cost
    const gainPct = cost ? (gain / cost) * 100 : 0
    const day = chg(h.symbol)
    return { ...h, p, value, cost, gain, gainPct, day, name: UNIVERSE[h.symbol]?.name || h.symbol }
  })
  const totalValue = rows.reduce((a, r) => a + r.value, 0)
  const totalCost = rows.reduce((a, r) => a + r.cost, 0)
  const totalGain = totalValue - totalCost
  const totalGainPct = totalCost ? (totalGain / totalCost) * 100 : 0
  const todayVal = rows.reduce((a, r) => a + (r.value * r.day) / 100, 0)

  if (!connected) {
    return (
      <div style={{ flex: 1, overflow: 'auto', padding: 'var(--mpad,22px 26px)' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: '21px', fontWeight: 800, letterSpacing: '-.02em', color: COLORS.tx }}>Portfolio</span>
          </div>
          <div style={{ background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: 16, padding: '48px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: COLORS.cardHi, display: 'flex', alignItems: 'center', justifyContent: 'center', color: COLORS.tx3, fontSize: '22px' }}>⊕</div>
            <span style={{ fontSize: '15px', fontWeight: 700, color: COLORS.tx }}>No brokerage connected</span>
            <span style={{ fontSize: '12.5px', color: COLORS.tx3, lineHeight: 1.55, maxWidth: 340 }}>Connect an account in Settings to sync your real holdings, cost basis, and live portfolio value.</span>
            <button onClick={() => setView('settings')} style={{ marginTop: 6, height: 38, padding: '0 18px', borderRadius: 10, border: 'none', background: COLORS.accent, color: COLORS.accentInk, fontFamily: FONT_SANS, fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>Go to Settings</button>
          </div>
        </div>
      </div>
    )
  }

  const summaryCard = (label: string, content: React.ReactNode) => (
    <div style={{ flex: '1 1 0', minWidth: 168, padding: '15px 17px', borderRadius: 14, background: COLORS.card, border: `1px solid ${COLORS.line}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={{ fontSize: '11px', color: COLORS.tx3, letterSpacing: '.04em' }}>{label}</span>
      {content}
    </div>
  )

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 'var(--mpad,22px 26px)' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: '21px', fontWeight: 800, letterSpacing: '-.02em', color: COLORS.tx }}>Portfolio</span>
          <span style={{ fontSize: '13px', color: COLORS.tx2 }}>{rows.length} positions · synced from {settings?.broker_name || 'your broker'}</span>
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {summaryCard('TOTAL VALUE', <span style={{ fontFamily: FONT_MONO, fontSize: '22px', fontWeight: 600, color: COLORS.tx }}>{mask(money(totalValue))}</span>)}
          {summaryCard('COST BASIS', <span style={{ fontFamily: FONT_MONO, fontSize: '22px', fontWeight: 600, color: COLORS.tx2 }}>{mask(money(totalCost))}</span>)}
          {summaryCard('TOTAL RETURN', (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: FONT_MONO, fontSize: '22px', fontWeight: 600, color: totalGain >= 0 ? COLORS.up : COLORS.down }}>{mask((totalGain >= 0 ? '+' : '') + money(totalGain))}</span>
              <span style={{ fontFamily: FONT_MONO, fontSize: '12.5px', fontWeight: 600, color: totalGain >= 0 ? COLORS.up : COLORS.down }}>{pct(totalGainPct)}</span>
            </div>
          ))}
          {summaryCard('TODAY', <span style={{ fontFamily: FONT_MONO, fontSize: '16px', fontWeight: 600, color: todayVal >= 0 ? COLORS.up : COLORS.down }}>{mask((todayVal >= 0 ? '+' : '') + money(todayVal))}</span>)}
        </div>

        <div style={{ display: 'flex', gap: 'var(--gap,16px)', alignItems: 'stretch', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 270px', minWidth: 260, background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: 16, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: COLORS.tx }}>Allocation</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', flex: '0 0 auto' }}>
                <Donut positions={rows.map((r) => ({ sym: r.symbol, val: r.value }))} total={totalValue} colors={DONUT_COLORS} />
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                  <span style={{ fontFamily: FONT_MONO, fontSize: '22px', fontWeight: 600, color: COLORS.tx }}>{rows.length}</span>
                  <span style={{ fontSize: '10.5px', color: COLORS.tx3 }}>positions</span>
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 120, display: 'flex', flexDirection: 'column', gap: 9 }}>
                {rows.slice().sort((a, b) => b.value - a.value).slice(0, 6).map((r, i) => (
                  <div key={r.symbol} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <span style={{ width: 9, height: 9, borderRadius: 3, background: DONUT_COLORS[i % DONUT_COLORS.length], flex: '0 0 auto' }} />
                    <span style={{ flex: 1, fontSize: '12.5px', fontWeight: 600, color: COLORS.tx }}>{r.symbol}</span>
                    <span style={{ fontFamily: FONT_MONO, fontSize: '12px', color: COLORS.tx2 }}>{totalValue ? ((r.value / totalValue) * 100).toFixed(1) + '%' : '—'}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ flex: '2 1 480px', minWidth: 320, background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <div style={{ minWidth: 640 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(140px,1.6fr) 76px 96px 104px 116px 130px', background: COLORS.panel, borderBottom: `1px solid ${COLORS.line}` }}>
                  {['ASSET', 'SHARES', 'AVG COST', 'PRICE', 'VALUE', 'RETURN'].map((h) => (
                    <div key={h} style={{ padding: '12px 12px', fontSize: '11px', fontWeight: 600, letterSpacing: '.04em', color: COLORS.tx3 }}>{h}</div>
                  ))}
                </div>
                {rows.map((r) => (
                  <div key={r.symbol} onClick={() => { setSelected(r.symbol); setView('dashboard') }} style={{ display: 'grid', gridTemplateColumns: 'minmax(140px,1.6fr) 76px 96px 104px 116px 130px', alignItems: 'center', borderTop: `1px solid ${COLORS.line}`, cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '13px 12px', minWidth: 0 }}>
                      <Logo symbol={r.symbol} size={28} />
                      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <span style={{ fontWeight: 700, fontSize: '13.5px', color: COLORS.tx }}>{r.symbol}</span>
                        <span style={{ fontSize: '11px', color: COLORS.tx3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
                      </div>
                    </div>
                    <div style={{ padding: '13px 12px', fontFamily: FONT_MONO, fontSize: '12.5px', color: COLORS.tx2 }}>{r.shares}</div>
                    <div style={{ padding: '13px 12px', fontFamily: FONT_MONO, fontSize: '12.5px', color: COLORS.tx2 }}>{money(r.avg_cost)}</div>
                    <div style={{ padding: '13px 12px', fontFamily: FONT_MONO, fontSize: '12.5px', color: COLORS.tx }}>{money(r.p)}</div>
                    <div style={{ padding: '13px 12px', fontFamily: FONT_MONO, fontSize: '12.5px', fontWeight: 600, color: COLORS.tx }}>{mask(money(r.value))}</div>
                    <div style={{ padding: '13px 12px', display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <span style={{ fontFamily: FONT_MONO, fontSize: '12.5px', fontWeight: 600, color: r.gain >= 0 ? COLORS.up : COLORS.down }}>{mask((r.gain >= 0 ? '+' : '') + money(r.gain))}</span>
                      <span style={{ fontFamily: FONT_MONO, fontSize: '10.5px', color: r.gain >= 0 ? COLORS.up : COLORS.down }}>{pct(r.gainPct)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
