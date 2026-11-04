import { useStore } from '../state/store'
import { FONT_MONO } from '../theme/tokens'
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

  const kpi = (label: string, value: string, color: string = 'var(--tx)') => (
    <div style={{ flex: '1 1 0', minWidth: 150, padding: '14px 16px', borderRadius: 14, background: 'var(--card)', border: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: '10.5px', letterSpacing: '.04em', color: 'var(--tx3)' }}>{label}</span>
      <span style={{ fontFamily: FONT_MONO, fontSize: '22px', fontWeight: 600, color }}>{value}</span>
    </div>
  )

  const card: React.CSSProperties = { background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 16, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 'var(--mpad,22px 26px)', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: '21px', fontWeight: 800, letterSpacing: '-.02em', color: 'var(--tx)' }}>Strategy</span>
        <span style={{ fontSize: '13px', color: 'var(--tx2)' }}>Portfolio overview — positions use live prices; algo metrics require a connected trading backend</span>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', flex: '0 0 auto' }}>
        {kpi('SHARPE RATIO', '—')}
        {kpi('MAX DRAWDOWN', '—', 'var(--tx3)')}
        {kpi('WIN RATE', '—', 'var(--tx3)')}
        {kpi('RISK / REWARD', '—')}
        <div style={{ flex: '1 1 0', minWidth: 150, padding: '14px 16px', borderRadius: 14, background: 'var(--card)', border: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: '10.5px', letterSpacing: '.04em', color: 'var(--tx3)' }}>TREND STRENGTH</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: '22px', fontWeight: 600, color: 'var(--tx3)' }}>—</span>
          </div>
          <div style={{ height: 5, borderRadius: 3, background: 'var(--line)' }}><div style={{ height: '100%', width: '0%', borderRadius: 3, background: 'var(--accent)' }} /></div>
        </div>
      </div>
      <div style={{ fontSize: '11.5px', color: 'var(--tx3)', fontStyle: 'italic' }}>
        Simulated metrics — live Sharpe ratio, drawdown, win rate, and trend strength require a connected algo trading backend.
      </div>

      <div style={{ display: 'flex', gap: 'var(--gap,16px)', alignItems: 'stretch', flexWrap: 'wrap', flex: '0 0 auto' }}>
        <div style={{ flex: '2 1 460px', minWidth: 320, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 16, padding: '16px 16px 10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--tx)' }}>Equity Curve</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: '11px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--tx2)' }}><span style={{ width: 14, height: 3, background: 'var(--up)', borderRadius: 2 }} />Strategy</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--tx3)' }}><span style={{ width: 14, height: 0, borderTop: '2px dashed var(--tx3)' }} />Benchmark</span>
            </div>
          </div>
          <EquityCurve />
        </div>
        <div style={{ flex: '1 1 300px', minWidth: 280, display: 'flex', flexDirection: 'column', gap: 'var(--gap,16px)' }}>
          <div style={{ ...card, border: '1px solid var(--line)' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--tx)' }}>Circuit Breakers</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px' }}><span style={{ color: 'var(--tx2)' }}>Daily loss</span><span style={{ fontFamily: FONT_MONO, color: 'var(--tx3)', fontWeight: 600 }}>— / —</span></div>
              <div style={{ height: 7, borderRadius: 4, background: 'var(--line)', overflow: 'hidden' }}><div style={{ height: '100%', width: '0%', background: 'var(--tx3)' }} /></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px' }}><span style={{ color: 'var(--tx2)' }}>Consecutive losses</span><span style={{ fontFamily: FONT_MONO, color: 'var(--tx3)', fontWeight: 600 }}>— / —</span></div>
          </div>
          <div style={card}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--tx)' }}>System Health</span>
            {[['Broker API · not connected', 'var(--tx3)'], ['Rate limit · —', 'var(--tx3)'], ['Margin · —', 'var(--tx3)']].map(([t, c], i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: '12px', color: 'var(--tx2)' }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: c as string }} />{t}</div>
            ))}
          </div>
          <div style={card}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--tx)' }}>Execution Quality</span>
            {[['Latency', '—'], ['Fill rate', '—'], ['Avg slippage', '—']].map(([k, v], i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}><span style={{ color: 'var(--tx3)' }}>{k}</span><span style={{ fontFamily: FONT_MONO, color: 'var(--tx3)' }}>{v}</span></div>
            ))}
            <span style={{ fontSize: '11px', color: 'var(--tx3)', fontStyle: 'italic' }}>Simulated — no live algo backend connected.</span>
          </div>
        </div>
      </div>

      <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 16, overflow: 'hidden', flex: '0 0 auto' }}>
        <div style={{ padding: '18px 20px 10px' }}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--tx)' }}>Active Positions</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 560 }}>
            {positions.map((sym) => {
              const u = UNIVERSE[sym]
              const p = price(sym)
              const value = p * u.shares
              const gain = value - u.cost * u.shares
              const day = chg(sym)
              return (
                <div key={sym} onClick={() => { setSelected(sym); setView('dashboard') }} style={{ display: 'grid', gridTemplateColumns: 'minmax(140px,1.4fr) 80px 110px 110px 120px 100px', alignItems: 'center', gap: 10, padding: '11px 20px', borderTop: '1px solid var(--line)', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}><Logo symbol={sym} size={26} /><span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--tx)' }}>{sym}</span></div>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--up)', background: 'rgba(61,220,132,.12)', padding: '2px 8px', borderRadius: 6, justifySelf: 'start' }}>LONG</span>
                  <span style={{ fontFamily: FONT_MONO, fontSize: '12.5px', color: 'var(--tx2)' }}>{money(u.cost)}</span>
                  <span style={{ fontFamily: FONT_MONO, fontSize: '12.5px', color: 'var(--tx)' }}>{money(value)}</span>
                  <span style={{ fontFamily: FONT_MONO, fontSize: '12.5px', fontWeight: 600, color: gain >= 0 ? 'var(--up)' : 'var(--down)' }}>{(gain >= 0 ? '+' : '') + money(gain)}</span>
                  <span style={{ fontFamily: FONT_MONO, fontSize: '12px', color: day >= 0 ? 'var(--up)' : 'var(--down)' }}>{pct(day)}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
