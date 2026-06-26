import { useStore } from '../state/store'
import { COLORS, FONT_MONO } from '../theme/tokens'
import { UNIVERSE } from '../data/universe'
import { Logo } from '../components/Logo'
import { EquityCurve } from '../charts/EquityCurve'
import { money, pct } from '../lib/format'

// Strategy cockpit — ported from the prototype template (lines 593-658): KPI
// banner, equity curve vs benchmark, risk sidebar (circuit breakers, system
// health, execution quality), and active positions. KPIs/risk are illustrative
// (no live algo backend, per spec); positions derive from seeded share counts.
export function Strategy() {
  const watchSymbols = useStore((s) => s.watchSymbols)
  const price = useStore((s) => s.price)
  const chg = useStore((s) => s.chg)
  const setSelected = useStore((s) => s.setSelected)
  const setView = useStore((s) => s.setView)

  const positions = watchSymbols().filter((s) => (UNIVERSE[s]?.shares ?? 0) > 0).slice(0, 6)

  const kpi = (label: string, value: string, color: string = COLORS.tx) => (
    <div style={{ flex: '1 1 0', minWidth: 150, padding: '14px 16px', borderRadius: 14, background: COLORS.card, border: `1px solid ${COLORS.line}`, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: '10.5px', letterSpacing: '.04em', color: COLORS.tx3 }}>{label}</span>
      <span style={{ fontFamily: FONT_MONO, fontSize: '22px', fontWeight: 600, color }}>{value}</span>
    </div>
  )

  const card: React.CSSProperties = { background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: 16, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 'var(--mpad,22px 26px)', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: '21px', fontWeight: 800, letterSpacing: '-.02em', color: COLORS.tx }}>Strategy</span>
        <span style={{ fontSize: '13px', color: COLORS.tx2 }}>Live algo health — P&amp;L, risk and execution at a glance</span>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', flex: '0 0 auto' }}>
        {kpi('SHARPE RATIO', '1.87')}
        {kpi('MAX DRAWDOWN', '-12.4%', COLORS.down)}
        {kpi('WIN RATE', '58.3%', COLORS.up)}
        {kpi('RISK / REWARD', '1 : 1.9')}
        <div style={{ flex: '1 1 0', minWidth: 150, padding: '14px 16px', borderRadius: 14, background: COLORS.card, border: `1px solid ${COLORS.line}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: '10.5px', letterSpacing: '.04em', color: COLORS.tx3 }}>TREND STRENGTH</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: '22px', fontWeight: 600, color: COLORS.up }}>72%</span>
            <span style={{ fontSize: '11px', fontWeight: 600, color: COLORS.up }}>Trending</span>
          </div>
          <div style={{ height: 5, borderRadius: 3, background: COLORS.line }}><div style={{ height: '100%', width: '72%', borderRadius: 3, background: COLORS.accent }} /></div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 'var(--gap,16px)', alignItems: 'stretch', flexWrap: 'wrap', flex: '0 0 auto' }}>
        <div style={{ flex: '2 1 460px', minWidth: 320, background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: 16, padding: '16px 16px 10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: COLORS.tx }}>Equity Curve</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: '11px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: COLORS.tx2 }}><span style={{ width: 14, height: 3, background: COLORS.up, borderRadius: 2 }} />Strategy</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: COLORS.tx3 }}><span style={{ width: 14, height: 0, borderTop: `2px dashed ${COLORS.tx3}` }} />Benchmark</span>
            </div>
          </div>
          <EquityCurve />
        </div>
        <div style={{ flex: '1 1 300px', minWidth: 280, display: 'flex', flexDirection: 'column', gap: 'var(--gap,16px)' }}>
          <div style={{ ...card, border: `1px solid ${COLORS.down}` }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: COLORS.tx }}>Circuit Breakers</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px' }}><span style={{ color: COLORS.tx2 }}>Daily loss</span><span style={{ fontFamily: FONT_MONO, color: COLORS.down, fontWeight: 600 }}>-$1,840 / -$2,500</span></div>
              <div style={{ height: 7, borderRadius: 4, background: COLORS.line, overflow: 'hidden' }}><div style={{ height: '100%', width: '74%', background: COLORS.down }} /></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px' }}><span style={{ color: COLORS.tx2 }}>Consecutive losses</span><span style={{ fontFamily: FONT_MONO, color: COLORS.tx, fontWeight: 600 }}>3 / 5</span></div>
          </div>
          <div style={card}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: COLORS.tx }}>System Health</span>
            {[['Broker API · connected', COLORS.up], ['Rate limit · 78% used', COLORS.warn], ['Margin · 34% utilized', COLORS.up]].map(([t, c], i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: '12px', color: COLORS.tx2 }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: c as string }} />{t}</div>
            ))}
          </div>
          <div style={card}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: COLORS.tx }}>Execution Quality</span>
            {[['Latency', '42 ms', COLORS.tx], ['Fill rate', '99.2%', COLORS.up], ['Avg slippage', '0.03%', COLORS.tx]].map(([k, v, c], i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}><span style={{ color: COLORS.tx3 }}>{k}</span><span style={{ fontFamily: FONT_MONO, color: c as string }}>{v}</span></div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: 16, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 10, flex: '0 0 auto' }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: COLORS.tx }}>Active Positions</span>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {positions.map((sym) => {
            const u = UNIVERSE[sym]
            const p = price(sym)
            const value = p * u.shares
            const gain = value - u.cost * u.shares
            const day = chg(sym)
            return (
              <div key={sym} onClick={() => { setSelected(sym); setView('dashboard') }} style={{ display: 'grid', gridTemplateColumns: 'minmax(140px,1.4fr) 80px 110px 110px 120px 100px', alignItems: 'center', gap: 10, padding: '11px 0', borderTop: `1px solid ${COLORS.line}`, cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}><Logo symbol={sym} size={26} /><span style={{ fontWeight: 700, fontSize: '13px', color: COLORS.tx }}>{sym}</span></div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: COLORS.up, background: 'rgba(61,220,132,.12)', padding: '2px 8px', borderRadius: 6, justifySelf: 'start' }}>LONG</span>
                <span style={{ fontFamily: FONT_MONO, fontSize: '12.5px', color: COLORS.tx2 }}>{money(u.cost)}</span>
                <span style={{ fontFamily: FONT_MONO, fontSize: '12.5px', color: COLORS.tx }}>{money(value)}</span>
                <span style={{ fontFamily: FONT_MONO, fontSize: '12.5px', fontWeight: 600, color: gain >= 0 ? COLORS.up : COLORS.down }}>{(gain >= 0 ? '+' : '') + money(gain)}</span>
                <span style={{ fontFamily: FONT_MONO, fontSize: '12px', color: day >= 0 ? COLORS.up : COLORS.down }}>{pct(day)}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
