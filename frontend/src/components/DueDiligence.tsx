import { useEffect } from 'react'
import { useStore } from '../state/store'
import { FONT_MONO } from '../theme/tokens'
import { UNIVERSE } from '../data/universe'
import { FACTS } from '../data/facts'
import { fallbackSpark } from '../data/series'
import { money } from '../lib/format'

// Due-Diligence row — ported from the prototype template (lines 396-447):
// Analyst Ratings (real distribution + price-target range from /api/ratings),
// Earnings & Events (deterministically derived), and About (FACTS + real sector).

const SEG_COLORS = ['#1fb866', '#3ddc84', '#ffb347', '#ff9f43', '#ff5d73']
const SEG_LABELS = ['Strong Buy', 'Buy', 'Hold', 'Sell', 'Strong Sell']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function DueDiligence() {
  const selected = useStore((s) => s.selected)
  const ratings = useStore((s) => s.ratings)
  const fundamentals = useStore((s) => s.fundamentals)
  const loadRatings = useStore((s) => s.loadRatings)
  const loadEarnings = useStore((s) => s.loadEarnings)
  const price = useStore((s) => s.price)

  useEffect(() => { loadRatings(selected); loadEarnings(selected) }, [selected, loadRatings, loadEarnings])

  const u = UNIVERSE[selected] || ({ name: selected, sector: '—', exch: '—' } as typeof UNIVERSE[string])
  const f = fundamentals[selected]
  const sector = f?.sector && f.sector !== '—' ? f.sector : u.sector
  const r = ratings[selected]
  const loaded = !!r
  const p = price(selected)

  // distribution + consensus (from API or zeros while loading)
  const dist = r?.distribution || { strongBuy: 0, buy: 0, hold: 0, sell: 0, strongSell: 0 }
  const counts = [dist.strongBuy, dist.buy, dist.hold, dist.sell, dist.strongSell]
  const total = counts.reduce((a, b) => a + b, 0)
  const consensus = r?.consensus || '…'
  const score = (dist.strongBuy + dist.buy * 2 + dist.hold * 3 + dist.sell * 4 + dist.strongSell * 5) / (total || 1)
  const consColor = score < 2.5 ? 'var(--up)' : score < 3.5 ? 'var(--warn)' : 'var(--down)'

  // price target (from API; fall back to a band around current price)
  const ptLow = r?.target.low || p * 0.88
  const ptHigh = r?.target.high || p * 1.18
  const ptAvg = r?.target.mean || (ptLow + ptHigh) / 2
  const upside = p ? ((ptAvg - p) / p) * 100 : 0
  const curPos = Math.max(2, Math.min(98, ((p - ptLow) / (ptHigh - ptLow || 1)) * 100))
  const avgPos = Math.max(2, Math.min(98, ((ptAvg - ptLow) / (ptHigh - ptLow || 1)) * 100))

  // Real upcoming earnings (Finnhub via store). undefined = loading, null = none.
  const e = useStore((s) => s.earnings[selected])

  // Format ISO 'YYYY-MM-DD' as 'Mon D, YYYY' to match the card's style.
  function fmtEarnDate(iso: string): string {
    const [y, m, d] = iso.split('-').map(Number)
    if (!y || !m || !d) return iso
    return `${MONTHS[m - 1]} ${d}, ${y}`
  }
  function hourLabel(hour: string): string {
    if (hour === 'bmo') return 'Before open'
    if (hour === 'amc') return 'After close'
    return '—'
  }
  void fallbackSpark

  const facts = FACTS[selected] || {
    ceo: '—', hq: '—', founded: '—', emp: '—',
    desc: `${u.name} is a ${sector} company listed on ${u.exch}. Detailed company profile data is not available for this ticker.`,
  }

  const card: React.CSSProperties = { background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 16, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 13 }

  return (
    <div style={{ display: 'flex', gap: 'var(--gap,16px)', alignItems: 'stretch', flexWrap: 'wrap', flex: '0 0 auto' }}>
      {/* Analyst Ratings */}
      <div style={{ ...card, flex: '1.15 1 320px', minWidth: 300, gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--tx)' }}>Analyst Ratings</span>
          <span style={{ fontSize: '11.5px', color: 'var(--tx3)' }}>{loaded ? `${total} analysts` : '…'}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 9 }}>
          <span style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '-.01em', color: consColor }}>{consensus}</span>
          <span style={{ fontSize: '12px', color: 'var(--tx3)' }}>consensus</span>
        </div>
        <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', gap: 2 }}>
          {counts.map((cnt, i) => (
            <div key={i} style={{ width: `${(cnt / (total || 1)) * 100}%`, height: '100%', background: SEG_COLORS[i] }} />
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {counts.map((cnt, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <span style={{ width: 9, height: 9, borderRadius: 3, background: SEG_COLORS[i], flex: '0 0 auto' }} />
              <span style={{ flex: 1, fontSize: '12.5px', color: 'var(--tx2)' }}>{SEG_LABELS[i]}</span>
              <span style={{ fontFamily: FONT_MONO, fontSize: '12px', color: 'var(--tx)' }}>{cnt}</span>
            </div>
          ))}
        </div>
        <div style={{ borderTop: '1px solid var(--line)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 11 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12px', color: 'var(--tx3)' }}>12-mo price target</span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: upside >= 0 ? 'var(--up)' : 'var(--down)' }}>{(upside >= 0 ? '+' : '') + upside.toFixed(1) + '%'} upside</span>
          </div>
          <div style={{ position: 'relative', height: 6, borderRadius: 3, background: 'rgba(255,255,255,.1)' }}>
            <div style={{ position: 'absolute', top: -3, bottom: -3, left: `${avgPos}%`, width: 2, background: 'var(--accent)' }} />
            <div style={{ position: 'absolute', top: '50%', left: `${curPos}%`, transform: 'translate(-50%,-50%)', width: 11, height: 11, borderRadius: '50%', background: '#fff', border: '2px solid var(--card)', zIndex: 2 }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: FONT_MONO, fontSize: '11.5px' }}>
            <span style={{ color: 'var(--tx2)' }}>{money(ptLow)}</span>
            <span style={{ color: 'var(--accent)', fontWeight: 600 }}>avg {money(ptAvg)}</span>
            <span style={{ color: 'var(--tx2)' }}>{money(ptHigh)}</span>
          </div>
        </div>
      </div>

      {/* Earnings & Events + About */}
      <div style={{ flex: '1 1 320px', minWidth: 300, display: 'flex', flexDirection: 'column', gap: 'var(--gap,16px)' }}>
        <div style={card}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--tx)' }}>Next Earnings</span>
          {e === undefined && (
            <span style={{ fontSize: '12.5px', color: 'var(--tx3)' }}>…</span>
          )}
          {e === null && (
            <span style={{ fontSize: '12.5px', color: 'var(--tx3)' }}>No upcoming report in the next 30 days</span>
          )}
          {e && (
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ fontSize: '10px', letterSpacing: '.04em', color: 'var(--tx3)' }}>DATE</span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--tx)' }}>{fmtEarnDate(e.date)}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ fontSize: '10px', letterSpacing: '.04em', color: 'var(--tx3)' }}>TIME</span>
                <span style={{ fontSize: '13px', color: 'var(--tx)' }}>{hourLabel(e.hour)}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ fontSize: '10px', letterSpacing: '.04em', color: 'var(--tx3)' }}>EPS EST.</span>
                <span style={{ fontFamily: FONT_MONO, fontSize: '13px', color: 'var(--tx)' }}>
                  {e.epsEstimate != null ? `$${e.epsEstimate.toFixed(2)}` : '—'}
                </span>
              </div>
            </div>
          )}
        </div>
        <div style={card}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--tx)' }}>About {selected}</span>
          <span style={{ fontSize: '12.5px', lineHeight: 1.6, color: 'var(--tx2)', textWrap: 'pretty' } as React.CSSProperties}>{facts.desc}</span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: 'var(--line)', borderRadius: 10, overflow: 'hidden' }}>
            {([['CEO', facts.ceo], ['HQ', facts.hq], ['Founded', facts.founded], ['Employees', facts.emp], ['Sector', sector], ['Exchange', u.exch]] as [string, string][]).map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '10px 13px', background: 'var(--card)' }}>
                <span style={{ fontSize: '11.5px', color: 'var(--tx3)' }}>{k}</span>
                <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--tx)', textAlign: 'right' }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
