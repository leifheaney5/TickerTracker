import { useEffect, useState } from 'react'
import { useStore } from '../state/store'
import { FONT_SANS, FONT_MONO } from '../theme/tokens'
import { GROUPS, UNIVERSE } from '../data/universe'
import { Logo } from '../components/Logo'
import { Sparkline } from '../charts/Sparkline'
import { Skeleton } from '../components/Skeleton'
import { money, pct, capStr, volStr } from '../lib/format'
import { api } from '../api/client'
import type { WatchlistSentiment } from '../api/types'

// At-a-Glance + Deep Dive — ported from the prototype templates (lines 455-533
// and 662-671). One sortable table of the watchlist; a Watchlist/Fundamentals
// sub-toggle swaps between price columns and valuation metrics.

type SortDir = 'asc' | 'desc'
type Sub = 'overview' | 'deep'

interface Col { key: string; label: string; num: boolean }

const OV_COLS: Col[] = [
  { key: 'sym', label: 'Ticker', num: false }, { key: 'price', label: 'Price', num: true },
  { key: 'chg', label: '24H', num: true }, { key: 'cap', label: 'Mkt Cap', num: true },
  { key: 'pe', label: 'P/E', num: true }, { key: 'vol', label: 'Vol', num: true },
  { key: 'sector', label: 'Sector', num: false }, { key: 'industry', label: 'Industry', num: false },
  { key: 'trend', label: '30D Trend', num: false }, { key: 'target', label: 'Target', num: true },
]

export function AtAGlance({ initialSub = 'overview' }: { initialSub?: Sub }) {
  const watchSymbols = useStore((s) => s.watchSymbols)
  const watchlist = useStore((s) => s.watchlist)
  const group = useStore((s) => s.group)
  const setGroup = useStore((s) => s.setGroup)
  const price = useStore((s) => s.price)
  const quotes = useStore((s) => s.quotes)
  const chg = useStore((s) => s.chg)
  const hasQuote = useStore((s) => s.hasQuote)
  const fundamentals = useStore((s) => s.fundamentals)
  const loadFundamentals = useStore((s) => s.loadFundamentals)
  const setSelected = useStore((s) => s.setSelected)
  const setView = useStore((s) => s.setView)

  const [sub, setSub] = useState<Sub>(initialSub)
  const [sortKey, setSortKey] = useState('sym')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [sentiment, setSentiment] = useState<WatchlistSentiment | null>(null)

  const symbols = watchSymbols().filter((s) => group === 'All' || UNIVERSE[s]?.group === group)

  useEffect(() => { symbols.forEach((s) => loadFundamentals(s)) }, [symbols.join(','), loadFundamentals])

  useEffect(() => {
    if (symbols.length === 0) return
    api.sentiment(symbols).then((r) => setSentiment(r.data)).catch(() => {})
  }, [symbols.join(',')])

  const fundOf = (sym: string) => fundamentals[sym]
  const targetOf = (sym: string) => watchlist.find((w) => w.symbol === sym)?.target ?? 0

  const sortVal = (sym: string, key: string): number | string => {
    const u = UNIVERSE[sym] || ({} as typeof UNIVERSE[string])
    const f = fundOf(sym)
    switch (key) {
      case 'sym': return sym
      case 'price': return price(sym)
      case 'chg': return chg(sym)
      case 'cap': return f?.market_cap ?? 0
      case 'pe': return f?.pe ?? 0
      case 'vol': return quotes[sym]?.volume ?? 0
      case 'sector': return (f?.sector && f.sector !== '—' ? f.sector : u.sector) || ''
      case 'industry': return u.industry || ''
      case 'target': return targetOf(sym)
      default: return sym
    }
  }

  const sorted = symbols.slice().sort((a, b) => {
    const va = sortVal(a, sortKey)
    const vb = sortVal(b, sortKey)
    let cmp: number
    if (typeof va === 'number' && typeof vb === 'number') cmp = va - vb
    else cmp = String(va).localeCompare(String(vb))
    return sortDir === 'asc' ? cmp : -cmp
  })

  const onSort = (key: string) => {
    if (key === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  const groupTabStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontFamily: FONT_SANS, fontSize: '12px', whiteSpace: 'nowrap', flex: '0 0 auto',
    border: active ? '1px solid transparent' : '1px solid var(--line)', background: active ? 'var(--accent)' : 'transparent',
    color: active ? 'var(--accentInk)' : 'var(--tx2)', fontWeight: active ? 700 : 500,
  })
  const subStyle = (active: boolean): React.CSSProperties => ({
    padding: '7px 13px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: FONT_SANS, fontSize: '12.5px',
    fontWeight: active ? 700 : 500, background: active ? 'var(--cardHi)' : 'transparent', color: active ? 'var(--tx)' : 'var(--tx3)',
  })

  const isDeep = sub === 'deep'
  const DEEP_COLS = ['Ticker', 'P/E', 'P/S', 'P/B', 'PEG', 'EBITDA', 'FCF Yld', 'ROIC', 'Gr. Margin', 'Net Debt/EBITDA']

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 'var(--mpad,22px 26px)', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', flex: '0 0 auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: '21px', fontWeight: 800, letterSpacing: '-.02em', color: 'var(--tx)' }}>{isDeep ? 'Deep Dive' : 'At-a-Glance'}</span>
          <span style={{ fontSize: '13px', color: 'var(--tx2)' }}>{isDeep ? 'Valuation, profitability & leverage fundamentals across your watchlist' : `${symbols.length} tickers at a glance — click any column to sort`}</span>
          <div style={{ display: 'flex', gap: 3, padding: 3, borderRadius: 10, background: 'var(--bg)', alignSelf: 'flex-start', marginTop: 8 }}>
            <button onClick={() => { setSub('overview'); setView('overview') }} style={subStyle(!isDeep)}>Watchlist</button>
            <button onClick={() => { setSub('deep'); setView('deep') }} style={subStyle(isDeep)}>Fundamentals</button>
          </div>
          {sentiment && sentiment.total > 0 && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '4px 10px', borderRadius: 20,
              background: sentiment.mood === 'Bullish' ? 'rgba(61,220,132,.12)' : sentiment.mood === 'Bearish' ? 'rgba(255,93,115,.12)' : 'var(--cardHi)',
              color: sentiment.mood === 'Bullish' ? 'var(--up)' : sentiment.mood === 'Bearish' ? 'var(--down)' : 'var(--tx2)',
              fontFamily: FONT_SANS, fontSize: '12px', fontWeight: 600, alignSelf: 'flex-start',
            }}>
              Watchlist mood: {sentiment.mood} ({sentiment.bullish}▲ / {sentiment.bearish}▼)
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
          {GROUPS.map((g) => <button key={g} onClick={() => setGroup(g)} style={groupTabStyle(g === group)}>{g}</button>)}
        </div>
      </div>

      <div style={{ border: '1px solid var(--line)', borderRadius: 16, overflow: 'hidden', background: 'var(--card)', flex: '0 0 auto' }}>
        <div style={{ overflowX: 'auto' }}>
          {!isDeep ? (
            <div style={{ minWidth: 1180 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(170px,1.4fr) 110px 92px 120px 70px 120px 150px 160px 130px 120px', background: 'var(--panel)', borderBottom: '1px solid var(--line)' }}>
                {OV_COLS.map((c) => (
                  <div key={c.key} onClick={() => onSort(c.key)} style={{ padding: '12px 12px', fontSize: '11px', fontWeight: 600, letterSpacing: '.04em', color: sortKey === c.key ? 'var(--tx2)' : 'var(--tx3)', cursor: 'pointer', userSelect: 'none' }}>
                    {c.label}{sortKey === c.key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
                  </div>
                ))}
              </div>
              {sorted.length === 0 && (
                <div style={{ padding: '36px 18px', textAlign: 'center', color: 'var(--tx3)', fontSize: '13px' }}>
                  Your watchlist is empty — add tickers from the Dashboard or Screener.
                </div>
              )}
              {sorted.map((sym) => {
                const u = UNIVERSE[sym] || ({ name: sym, sector: '—', industry: '—' } as typeof UNIVERSE[string])
                const f = fundOf(sym)
                const live = hasQuote(sym)
                const q = quotes[sym]
                const c = chg(sym)
                const up = c >= 0
                const sector = f?.sector && f.sector !== '—' ? f.sector : u.sector
                const target = targetOf(sym)
                return (
                  <div key={sym} style={{ display: 'grid', gridTemplateColumns: 'minmax(170px,1.4fr) 110px 92px 120px 70px 120px 150px 160px 130px 120px', alignItems: 'center', borderTop: '1px solid var(--line)' }}>
                    <div onClick={() => { setSelected(sym); setView('dashboard') }} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '13px 14px', cursor: 'pointer', minWidth: 0 }}>
                      <Logo symbol={sym} size={28} />
                      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <span style={{ fontWeight: 700, fontSize: '13.5px', color: 'var(--tx)' }}>{sym}</span>
                        <span style={{ fontSize: '11px', color: 'var(--tx3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</span>
                      </div>
                    </div>
                    <div style={{ padding: '13px 12px', fontFamily: FONT_MONO, fontSize: '13.5px', fontWeight: 500, color: 'var(--tx)' }}>{live ? money(price(sym)) : <Skeleton inline width={60} height={13} />}</div>
                    <div style={{ padding: '13px 12px' }}>{live ? <span style={{ fontFamily: FONT_MONO, fontSize: '11.5px', fontWeight: 600, padding: '2px 7px', borderRadius: 6, background: up ? 'rgba(61,220,132,.12)' : 'rgba(255,93,115,.12)', color: up ? 'var(--up)' : 'var(--down)' }}>{pct(c)}</span> : <Skeleton inline width={44} height={16} />}</div>
                    <div style={{ padding: '13px 12px', fontFamily: FONT_MONO, fontSize: '12.5px', color: 'var(--tx)' }}>{f ? capStr(f.market_cap) : <Skeleton inline width={52} height={12} />}</div>
                    <div style={{ padding: '13px 12px', fontFamily: FONT_MONO, fontSize: '12.5px', color: 'var(--tx2)' }}>{f ? (f.pe ? f.pe : '—') : <Skeleton inline width={34} height={12} />}</div>
                    <div style={{ padding: '13px 12px', fontFamily: FONT_MONO, fontSize: '12.5px', color: 'var(--tx2)' }}>{q ? (q.volume ? volStr(q.volume) : '—') : <Skeleton inline width={44} height={12} />}</div>
                    <div style={{ padding: '13px 12px', fontSize: '12px', color: 'var(--tx2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sector}</div>
                    <div style={{ padding: '13px 12px', fontSize: '12px', color: 'var(--tx2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.industry || '—'}</div>
                    <div style={{ padding: '13px 12px' }}><Sparkline symbol={sym} /></div>
                    <div style={{ padding: '13px 12px', fontFamily: FONT_MONO, fontSize: '12.5px', color: target ? 'var(--tx)' : 'var(--tx3)' }}>{target ? money(target) : '—'}</div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={{ minWidth: 980 }}>
              <div style={{ display: 'grid', gridTemplateColumns: `minmax(160px,1.4fr) repeat(${DEEP_COLS.length - 1}, 1fr)`, background: 'var(--panel)', borderBottom: '1px solid var(--line)' }}>
                {DEEP_COLS.map((h) => <div key={h} style={{ padding: '12px 12px', fontSize: '11px', fontWeight: 600, letterSpacing: '.04em', color: 'var(--tx3)' }}>{h}</div>)}
              </div>
              {sorted.length === 0 && (
                <div style={{ padding: '36px 18px', textAlign: 'center', color: 'var(--tx3)', fontSize: '13px' }}>
                  Your watchlist is empty — add tickers from the Dashboard or Screener.
                </div>
              )}
              {sorted.map((sym) => {
                const f = fundOf(sym)
                // Only P/E has a real backend source in the Fundamentals payload.
                // All other ratio columns (P/S, P/B, PEG, EBITDA, FCF Yld, ROIC,
                // Gr. Margin, Net Debt/EBITDA) have no backend field — render '—'
                // rather than fabricating values from unrelated fields like beta or
                // market_cap. Extended ratios will populate when a premium data
                // feed is integrated.
                const cells: React.ReactNode[] = f
                  ? [
                      f.pe ? String(f.pe) : '—',  // P/E — real backend field
                      '—',                          // P/S — no backend source
                      '—',                          // P/B — no backend source
                      '—',                          // PEG — no backend source
                      '—',                          // EBITDA — no backend source
                      '—',                          // FCF Yld — no backend source
                      '—',                          // ROIC — no backend source
                      '—',                          // Gr. Margin — no backend source
                      '—',                          // Net Debt/EBITDA — no backend source
                    ]
                  : Array.from({ length: DEEP_COLS.length - 1 }, (_, i) => <Skeleton key={i} inline width={40} height={12} />)
                return (
                  <div key={sym} onClick={() => { setSelected(sym); setView('dashboard') }} style={{ display: 'grid', gridTemplateColumns: `minmax(160px,1.4fr) repeat(${DEEP_COLS.length - 1}, 1fr)`, alignItems: 'center', borderTop: '1px solid var(--line)', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '13px 12px', minWidth: 0 }}>
                      <Logo symbol={sym} size={26} />
                      <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--tx)' }}>{sym}</span>
                    </div>
                    {cells.map((cell, i) => <div key={i} style={{ padding: '13px 12px', fontFamily: FONT_MONO, fontSize: '12.5px', color: 'var(--tx2)' }}>{cell}</div>)}
                  </div>
                )
              })}
              <div style={{ padding: '10px 16px', borderTop: '1px solid var(--line)', fontSize: '11.5px', color: 'var(--tx3)', fontFamily: FONT_SANS, fontStyle: 'italic' }}>
                Extended ratios require a premium data feed — coming soon.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
