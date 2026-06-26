import { useEffect } from 'react'
import { useStore } from '../state/store'
import { COLORS, FONT_MONO } from '../theme/tokens'
import { UNIVERSE } from '../data/universe'
import { FACTS } from '../data/facts'
import { fallbackSpark } from '../data/series'
import { hashStr } from '../lib/hash'
import { makeRng } from '../data/series'
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
  const price = useStore((s) => s.price)

  useEffect(() => { loadRatings(selected) }, [selected, loadRatings])

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
  const consColor = score < 2.5 ? COLORS.up : score < 3.5 ? COLORS.warn : COLORS.down

  // price target (from API; fall back to a band around current price)
  const ptLow = r?.target.low || p * 0.88
  const ptHigh = r?.target.high || p * 1.18
  const ptAvg = r?.target.mean || (ptLow + ptHigh) / 2
  const upside = p ? ((ptAvg - p) / p) * 100 : 0
  const curPos = Math.max(2, Math.min(98, ((p - ptLow) / (ptHigh - ptLow || 1)) * 100))
  const avgPos = Math.max(2, Math.min(98, ((ptAvg - ptLow) / (ptHigh - ptLow || 1)) * 100))

  // earnings/events derived deterministically (parity with prototype _dd)
  const rng = makeRng(hashStr(selected) + 57)
  const today = new Date(2026, 5, 25)
  const ed = new Date(today); ed.setDate(ed.getDate() + Math.floor(9 + rng() * 68))
  const earnDate = `${MONTHS[ed.getMonth()]} ${ed.getDate()}, ${ed.getFullYear()}`
  const epsEst = (0.3 + rng() * 3.4).toFixed(2)
  const surprise = (rng() - 0.32) * 13
  const ev2 = new Date(today); ev2.setDate(ev2.getDate() + Math.floor(4 + rng() * 18))
  const ev3 = new Date(today); ev3.setDate(ev3.getDate() + Math.floor(24 + rng() * 40))
  const events = [
    { label: 'Earnings call', date: earnDate },
    { label: 'Ex-dividend date', date: `${MONTHS[ev2.getMonth()]} ${ev2.getDate()}` },
    { label: 'Investor day', date: `${MONTHS[ev3.getMonth()]} ${ev3.getDate()}` },
  ]
  void fallbackSpark

  const facts = FACTS[selected] || {
    ceo: '—', hq: '—', founded: '—', emp: '—',
    desc: `${u.name} is a ${sector} company listed on ${u.exch}. Detailed company profile data is not available for this ticker.`,
  }

  const card: React.CSSProperties = { background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: 16, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 13 }

  return (
    <div style={{ display: 'flex', gap: 'var(--gap,16px)', alignItems: 'stretch', flexWrap: 'wrap', flex: '0 0 auto' }}>
      {/* Analyst Ratings */}
      <div style={{ ...card, flex: '1.15 1 320px', minWidth: 300, gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: COLORS.tx }}>Analyst Ratings</span>
          <span style={{ fontSize: '11.5px', color: COLORS.tx3 }}>{loaded ? `${total} analysts` : '…'}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 9 }}>
          <span style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '-.01em', color: consColor }}>{consensus}</span>
          <span style={{ fontSize: '12px', color: COLORS.tx3 }}>consensus</span>
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
              <span style={{ flex: 1, fontSize: '12.5px', color: COLORS.tx2 }}>{SEG_LABELS[i]}</span>
              <span style={{ fontFamily: FONT_MONO, fontSize: '12px', color: COLORS.tx }}>{cnt}</span>
            </div>
          ))}
        </div>
        <div style={{ borderTop: `1px solid ${COLORS.line}`, paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 11 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12px', color: COLORS.tx3 }}>12-mo price target</span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: upside >= 0 ? COLORS.up : COLORS.down }}>{(upside >= 0 ? '+' : '') + upside.toFixed(1) + '%'} upside</span>
          </div>
          <div style={{ position: 'relative', height: 6, borderRadius: 3, background: 'rgba(255,255,255,.1)' }}>
            <div style={{ position: 'absolute', top: -3, bottom: -3, left: `${avgPos}%`, width: 2, background: COLORS.accent }} />
            <div style={{ position: 'absolute', top: '50%', left: `${curPos}%`, transform: 'translate(-50%,-50%)', width: 11, height: 11, borderRadius: '50%', background: '#fff', border: `2px solid ${COLORS.card}`, zIndex: 2 }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: FONT_MONO, fontSize: '11.5px' }}>
            <span style={{ color: COLORS.tx2 }}>{money(ptLow)}</span>
            <span style={{ color: COLORS.accent, fontWeight: 600 }}>avg {money(ptAvg)}</span>
            <span style={{ color: COLORS.tx2 }}>{money(ptHigh)}</span>
          </div>
        </div>
      </div>

      {/* Earnings & Events + About */}
      <div style={{ flex: '1 1 320px', minWidth: 300, display: 'flex', flexDirection: 'column', gap: 'var(--gap,16px)' }}>
        <div style={card}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: COLORS.tx }}>Earnings &amp; Events</span>
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontSize: '10px', letterSpacing: '.04em', color: COLORS.tx3 }}>NEXT EARNINGS</span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: COLORS.tx }}>{earnDate}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontSize: '10px', letterSpacing: '.04em', color: COLORS.tx3 }}>EPS EST.</span>
              <span style={{ fontFamily: FONT_MONO, fontSize: '13px', color: COLORS.tx }}>${epsEst}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontSize: '10px', letterSpacing: '.04em', color: COLORS.tx3 }}>LAST SURPRISE</span>
              <span style={{ fontFamily: FONT_MONO, fontSize: '13px', fontWeight: 600, color: surprise >= 0 ? COLORS.up : COLORS.down }}>{(surprise >= 0 ? '+' : '') + surprise.toFixed(1)}%</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {events.map((e, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 0', borderTop: `1px solid ${COLORS.line}` }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: COLORS.accent, flex: '0 0 auto' }} />
                <span style={{ flex: 1, fontSize: '12.5px', color: COLORS.tx }}>{e.label}</span>
                <span style={{ fontFamily: FONT_MONO, fontSize: '12px', color: COLORS.tx2 }}>{e.date}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={card}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: COLORS.tx }}>About {selected}</span>
          <span style={{ fontSize: '12.5px', lineHeight: 1.6, color: COLORS.tx2, textWrap: 'pretty' } as React.CSSProperties}>{facts.desc}</span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: COLORS.line, borderRadius: 10, overflow: 'hidden' }}>
            {([['CEO', facts.ceo], ['HQ', facts.hq], ['Founded', facts.founded], ['Employees', facts.emp], ['Sector', sector], ['Exchange', u.exch]] as [string, string][]).map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '10px 13px', background: COLORS.card }}>
                <span style={{ fontSize: '11.5px', color: COLORS.tx3 }}>{k}</span>
                <span style={{ fontSize: '11.5px', fontWeight: 600, color: COLORS.tx, textAlign: 'right' }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
