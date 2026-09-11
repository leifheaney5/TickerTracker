import { useState, useEffect } from 'react'
import { useStore, type SortBy } from '../state/store'
import { FONT_SANS, FONT_MONO } from '../theme/tokens'
import { GROUPS, UNIVERSE } from '../data/universe'
import { DEMO_WATCH } from '../data/demo'
import { Logo } from './Logo'
import { Sparkline } from '../charts/Sparkline'
import { Skeleton } from './Skeleton'
import { money, pct } from '../lib/format'
import { useRequireAuth } from '../hooks/useRequireAuth'
import { useIsMobile } from '../hooks/useIsMobile'
import { TargetSummary } from './TargetEditor'
import { compareTargetDistance } from '../lib/targets'
import { MoversRibbon } from './MoversRibbon'

// Watchlist sidebar — ported from the prototype template (lines 148-216):
// title + count + sort cycle, group folder tabs, draggable cards with sparkline
// and target-progress bar, empty state, and the add-ticker footer form.

const SORT_OPTIONS: Array<{ value: SortBy; label: string }> = [
  { value: 'manual', label: 'Manual' },
  { value: 'gainers', label: 'Day gainers' },
  { value: 'losers', label: 'Day losers' },
  { value: 'price', label: 'Price' },
  { value: 'az', label: 'A–Z' },
  { value: 'closest-buy', label: 'Closest to buy target' },
  { value: 'closest-sell', label: 'Closest to sell target' },
]

function groupTabStyle(active: boolean): React.CSSProperties {
  return {
    padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontFamily: FONT_SANS,
    fontSize: '12px', whiteSpace: 'nowrap', flex: '0 0 auto',
    border: active ? '1px solid transparent' : '1px solid var(--line)',
    background: active ? 'var(--accent,#3ddc84)' : 'transparent',
    color: active ? 'var(--accentInk)' : 'var(--tx2)',
    fontWeight: active ? 700 : 500,
  }
}

export function Watchlist() {
  const isAuthed = useStore((s) => s.currentUser !== null)
  const watchlist = useStore((s) => s.watchlist)
  const selected = useStore((s) => s.selected)
  const setSelected = useStore((s) => s.setSelected)
  const setView = useStore((s) => s.setView)
  const group = useStore((s) => s.group)
  const setGroup = useStore((s) => s.setGroup)
  const sortBy = useStore((s) => s.sortBy)
  const setSortBy = useStore((s) => s.setSortBy)
  const price = useStore((s) => s.price)
  const chg = useStore((s) => s.chg)
  const hasQuote = useStore((s) => s.hasQuote)
  const flash = useStore((s) => s.flash)
  const addWatch = useStore((s) => s.addWatch)
  const openTickerFinder = useStore((s) => s.openTickerFinder)
  const history = useStore((s) => s.history)
  const loadHistory = useStore((s) => s.loadHistory)
  const requireAuth = useRequireAuth()
  const isMobile = useIsMobile()
  const [mobileExpanded, setMobileExpanded] = useState(false)

  const [showAdd, setShowAdd] = useState(false)
  const [addSym, setAddSym] = useState('')
  const [addBuyTarget, setAddBuyTarget] = useState('')
  const [addSellTarget, setAddSellTarget] = useState('')
  const [dragSym, setDragSym] = useState<string | null>(null)

  // base list: use DB-backed watchlist when authed, otherwise show demo list read-only.
  const sourceSymbols = isAuthed
    ? watchlist
        .slice()
        .sort((a, b) => a.position - b.position)
        .map((w) => w.symbol)
    : DEMO_WATCH.slice()
  let base = sourceSymbols.filter((s) => group === 'All' || UNIVERSE[s]?.group === group)
  if (sortBy === 'gainers') base = base.slice().sort((a, b) => chg(b) - chg(a))
  else if (sortBy === 'losers') base = base.slice().sort((a, b) => chg(a) - chg(b))
  else if (sortBy === 'price') base = base.slice().sort((a, b) => price(b) - price(a))
  else if (sortBy === 'az') base = base.slice().sort((a, b) => a.localeCompare(b))
  else if (sortBy === 'closest-buy' || sortBy === 'closest-sell') {
    const side = sortBy === 'closest-buy' ? 'buy' : 'sell'
    const itemFor = (symbol: string) => watchlist.find((item) => item.symbol === symbol) ?? {
      symbol, position: sourceSymbols.indexOf(symbol), buy_target: 0, sell_target: UNIVERSE[symbol]?.target ?? 0,
    }
    const quoteMap = Object.fromEntries(sourceSymbols.map((symbol) => [symbol, hasQuote(symbol) ? { price: price(symbol) } : undefined]))
    base = base.slice().sort((a, b) => compareTargetDistance(itemFor(a), itemFor(b), quoteMap, side))
  }

  const dragOK = sortBy === 'manual'

  // Load 1M history for each visible symbol so the Sparkline has live data.
  // Effect is gated on the joined symbol string — won't re-fire on re-renders
  // unless the symbol list actually changes. loadHistory is a no-op if the key
  // is already in the cache, so there's no risk of hammering the API.
  const symKey = sourceSymbols.join(',')
  useEffect(() => {
    if (!sourceSymbols.length) return
    const missing = sourceSymbols.filter((sym) => !history[`${sym}:1M`])
    const timers = Array.from({ length: Math.ceil(missing.length / 6) }, (_, batch) => window.setTimeout(() => {
      missing.slice(batch * 6, batch * 6 + 6).forEach((sym) => void loadHistory(sym, '1M'))
    }, 250 + batch * 350))
    return () => timers.forEach(window.clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symKey])

  const submitAdd = () => {
    const sym = addSym.trim().toUpperCase()
    if (!sym) return
    addWatch(sym, { buy_target: parseFloat(addBuyTarget) || 0, sell_target: parseFloat(addSellTarget) || 0 })
    setAddSym('')
    setAddBuyTarget('')
    setAddSellTarget('')
    setShowAdd(false)
  }

  if (isMobile) {
    return (
      <aside
        style={{
          width: '100%', flex: '0 0 auto', borderBottom: '1px solid var(--line)',
          background: 'var(--panel)', display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Mobile collapsible header */}
        <div
          onClick={() => setMobileExpanded((x) => !x)}
          style={{
            padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            cursor: 'pointer', userSelect: 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--tx)' }}>Watchlist</span>
            <span style={{ fontSize: '11.5px', color: 'var(--tx3)' }}>{base.length}</span>
          </div>
          <span style={{ fontSize: '13px', color: 'var(--tx3)' }}>{mobileExpanded ? '▲ Hide' : '▼ Show'}</span>
        </div>

        {mobileExpanded && (
          <>
            <div style={{ padding: '0 16px 10px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div
                  onClick={() => requireAuth(() => setView('managewatch'))}
                  title="Manage your watchlist"
                  style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
                >
                  <span style={{ fontSize: '11px', color: 'var(--accent)' }}>⤢ Manage</span>
                </div>
                <select aria-label="Sort watchlist" value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)} style={{ height: 32, borderRadius: 8, border: '1px solid var(--line2)', background: 'var(--card)', color: 'var(--tx2)', fontFamily: FONT_SANS, fontSize: '11.5px', fontWeight: 600, padding: '0 8px' }}>
                  {SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
                {GROUPS.map((g) => (
                  <button key={g} onClick={() => setGroup(g)} style={groupTabStyle(g === group)}>
                    {g}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ maxHeight: 340, overflowY: 'auto', padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 'var(--lgap,8px)' }}>
              {base.map((sym) => {
                const u = UNIVERSE[sym] || { name: sym, target: 0 } as typeof UNIVERSE[string]
                const wl = watchlist.find((w) => w.symbol === sym)
                const buyTarget = wl?.buy_target ?? 0
                const sellTarget = wl?.sell_target ?? u.target ?? 0
                const live = hasQuote(sym)
                const p = price(sym)
                const c = chg(sym)
                const up = c >= 0
                const fl = flash[sym]
                const hasT = buyTarget > 0 || sellTarget > 0
                const near = live && ((buyTarget > 0 && p <= buyTarget * 1.08) || (sellTarget > 0 && p >= sellTarget * .92))
                const priceColor = fl === 'up' ? 'var(--up)' : fl === 'down' ? 'var(--down)' : 'var(--tx)'
                return (
                  <div
                    key={sym}
                    onClick={() => { setSelected(sym); setMobileExpanded(false) }}
                    style={{
                      padding: 'var(--cpad,12px 14px)', borderRadius: 13,
                      border: `1px solid ${sym === selected ? 'var(--accent)' : 'var(--line)'}`,
                      background: sym === selected ? 'var(--cardHi)' : 'var(--card)',
                      cursor: 'pointer', opacity: dragSym === sym ? 0.4 : 1,
                      boxShadow: sym === selected ? '0 0 0 1px var(--accent)' : 'none',
                      transition: 'border-color .15s',
                    }}
                  >
                    <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
                      <Logo symbol={sym} size={30} />
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <span style={{ fontWeight: 700, fontSize: '14px', letterSpacing: '-.01em', color: 'var(--tx)' }}>{sym}</span>
                          {near && <span title="Near target" style={{ fontSize: '10px', color: 'var(--accent)' }}>◆</span>}
                        </div>
                        <span style={{ fontSize: '11.5px', color: 'var(--tx2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }}>{u.name}</span>
                        {live
                          ? <span style={{ fontFamily: FONT_MONO, fontSize: '14px', fontWeight: 500, marginTop: 2, color: priceColor }}>{money(p)}</span>
                          : <Skeleton width={70} height={14} style={{ marginTop: 4 }} />}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                        {live
                          ? <span style={{ fontSize: '11.5px', fontWeight: 600, fontFamily: FONT_MONO, padding: '2px 7px', borderRadius: 6, background: up ? 'rgba(61,220,132,.12)' : 'rgba(255,93,115,.12)', color: up ? 'var(--up)' : 'var(--down)' }}>{pct(c)}</span>
                          : <Skeleton width={46} height={18} />}
                        <Sparkline symbol={sym} />
                      </div>
                    </div>
                    {hasT && <div style={{ marginTop: 8 }}><TargetSummary buyTarget={buyTarget} sellTarget={sellTarget} price={live ? p : null} compact /></div>}
                  </div>
                )
              })}
              {base.length === 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9, padding: '32px 18px', textAlign: 'center' }}>
                  <span style={{ fontSize: '26px', opacity: 0.7 }}>☆</span>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--tx2)' }}>No tickers here yet</span>
                </div>
              )}
            </div>

            <div style={{ flex: '0 0 auto', padding: 12, borderTop: '1px solid var(--line)' }}>
              {showAdd ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9, padding: 12, borderRadius: 12, background: 'var(--card)', border: '1px solid var(--line2)' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '.03em', color: 'var(--tx2)' }}>ADD TICKER</span>
                  <input
                    value={addSym}
                    onChange={(e) => setAddSym(e.target.value)}
                    placeholder="Symbol  e.g. NVDA"
                    aria-label="Ticker symbol"
                    style={{ height: 34, padding: '0 11px', borderRadius: 8, border: '1px solid var(--line2)', background: 'var(--bg)', color: 'var(--tx)', fontFamily: FONT_SANS, fontSize: '13px', textTransform: 'uppercase' }}
                  />
                  <input
                    value={addBuyTarget}
                    onChange={(e) => setAddBuyTarget(e.target.value)}
                    placeholder="Buy target (optional)"
                    aria-label="Buy target"
                    style={{ height: 34, padding: '0 11px', borderRadius: 8, border: '1px solid var(--line2)', background: 'var(--bg)', color: 'var(--tx)', fontFamily: FONT_MONO, fontSize: '13px' }}
                  />
                  <input value={addSellTarget} onChange={(e) => setAddSellTarget(e.target.value)} placeholder="Sell target (optional)" aria-label="Sell target" style={{ height: 34, padding: '0 11px', borderRadius: 8, border: '1px solid var(--line2)', background: 'var(--bg)', color: 'var(--tx)', fontFamily: FONT_MONO, fontSize: '13px' }} />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={submitAdd} style={{ flex: 1, height: 34, borderRadius: 8, border: 'none', background: 'var(--accent)', color: 'var(--accentInk)', fontFamily: FONT_SANS, fontWeight: 700, fontSize: '12.5px', cursor: 'pointer' }}>Add</button>
                    <button onClick={() => setShowAdd(false)} style={{ height: 34, padding: '0 14px', borderRadius: 8, border: '1px solid var(--line2)', background: 'transparent', color: 'var(--tx2)', fontFamily: FONT_SANS, fontSize: '12.5px', cursor: 'pointer' }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => requireAuth(() => openTickerFinder({ kind: 'track' }))}
                  style={{ width: '100%', height: 42, borderRadius: 11, border: 'none', background: 'var(--accent)', color: 'var(--accentInk)', fontFamily: FONT_SANS, fontWeight: 700, fontSize: '13.5px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 4px 14px rgba(61,220,132,.2)' }}
                >
                  <span style={{ fontSize: '17px', lineHeight: 1, marginTop: -1 }}>+</span>Add ticker
                </button>
              )}
            </div>
          </>
        )}
      </aside>
    )
  }

  return (
    <aside
      style={{
        width: 336, flex: '0 0 auto', borderRight: '1px solid var(--line)',
        background: 'var(--panel)', display: 'flex', flexDirection: 'column', minHeight: 0,
      }}
    >
      <div style={{ padding: '16px 16px 10px', display: 'flex', flexDirection: 'column', gap: 12, flex: '0 0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div
            onClick={() => requireAuth(() => setView('managewatch'))}
            title="Manage your watchlist"
            style={{ display: 'flex', alignItems: 'baseline', gap: 8, cursor: 'pointer' }}
          >
            <span style={{ fontSize: '14px', fontWeight: 700, letterSpacing: '-.01em', color: 'var(--tx)' }}>Watchlist</span>
            <span style={{ fontSize: '11.5px', color: 'var(--tx3)' }}>{base.length}</span>
            <span style={{ fontSize: '11px', color: 'var(--accent)' }}>⤢ Manage</span>
          </div>
          <select aria-label="Sort watchlist" value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)} style={{ height: 32, borderRadius: 8, border: '1px solid var(--line2)', background: 'var(--card)', color: 'var(--tx2)', fontFamily: FONT_SANS, fontSize: '11.5px', fontWeight: 600, padding: '0 8px', maxWidth: 176 }}>
            {SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
          {GROUPS.map((g) => (
            <button key={g} onClick={() => setGroup(g)} style={groupTabStyle(g === group)}>
              {g}
            </button>
          ))}
        </div>
        <MoversRibbon />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 'var(--lgap,8px)' }}>
        {base.map((sym) => {
          const u = UNIVERSE[sym] || { name: sym, target: 0 } as typeof UNIVERSE[string]
          const wl = watchlist.find((w) => w.symbol === sym)
          const buyTarget = wl?.buy_target ?? 0
          const sellTarget = wl?.sell_target ?? u.target ?? 0
          const live = hasQuote(sym)
          const p = price(sym)
          const c = chg(sym)
          const up = c >= 0
          const fl = flash[sym]
          const hasT = buyTarget > 0 || sellTarget > 0
          const near = live && ((buyTarget > 0 && p <= buyTarget * 1.08) || (sellTarget > 0 && p >= sellTarget * .92))
          const priceColor = fl === 'up' ? 'var(--up)' : fl === 'down' ? 'var(--down)' : 'var(--tx)'
          return (
            <div
              key={sym}
              data-testid={`watchlist-row-${sym}`}
              onClick={() => setSelected(sym)}
              draggable={dragOK && isAuthed}
              onDragStart={() => requireAuth(() => setDragSym(sym))}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                setDragSym(null)
                // reorder is persisted in a later unit; local visual order kept by position
              }}
              onDragEnd={() => setDragSym(null)}
              style={{
                padding: 'var(--cpad,12px 14px)', borderRadius: 13,
                border: `1px solid ${sym === selected ? 'var(--accent)' : 'var(--line)'}`,
                background: sym === selected ? 'var(--cardHi)' : 'var(--card)',
                cursor: dragOK ? 'grab' : 'pointer', opacity: dragSym === sym ? 0.4 : 1,
                boxShadow: sym === selected ? '0 0 0 1px var(--accent)' : 'none',
                transition: 'border-color .15s',
              }}
            >
              <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
                <Logo symbol={sym} size={30} />
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ fontWeight: 700, fontSize: '14px', letterSpacing: '-.01em', color: 'var(--tx)' }}>{sym}</span>
                    {near && <span title="Near target" style={{ fontSize: '10px', color: 'var(--accent)' }}>◆</span>}
                  </div>
                  <span style={{ fontSize: '11.5px', color: 'var(--tx2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }}>{u.name}</span>
                  {live
                    ? <span style={{ fontFamily: FONT_MONO, fontSize: '14px', fontWeight: 500, marginTop: 2, color: priceColor }}>{money(p)}</span>
                    : <Skeleton width={70} height={14} style={{ marginTop: 4 }} />}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                  {live
                    ? <span style={{ fontSize: '11.5px', fontWeight: 600, fontFamily: FONT_MONO, padding: '2px 7px', borderRadius: 6, background: up ? 'rgba(61,220,132,.12)' : 'rgba(255,93,115,.12)', color: up ? 'var(--up)' : 'var(--down)' }}>{pct(c)}</span>
                    : <Skeleton width={46} height={18} />}
                  <Sparkline symbol={sym} />
                </div>
              </div>
              {hasT && <div style={{ marginTop: 8 }}><TargetSummary buyTarget={buyTarget} sellTarget={sellTarget} price={live ? p : null} compact /></div>}
            </div>
          )
        })}
        {base.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9, padding: '46px 18px', textAlign: 'center' }}>
            <span style={{ fontSize: '26px', opacity: 0.7 }}>☆</span>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--tx2)' }}>No tickers here yet</span>
            <span style={{ fontSize: '11.5px', color: 'var(--tx3)', lineHeight: 1.5 }}>
              {group !== 'All' ? 'No tickers in this group yet' : 'Add a ticker to start tracking'}
            </span>
          </div>
        )}
      </div>

      <div style={{ flex: '0 0 auto', padding: 12, borderTop: '1px solid var(--line)' }}>
        {showAdd ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, padding: 12, borderRadius: 12, background: 'var(--card)', border: '1px solid var(--line2)' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '.03em', color: 'var(--tx2)' }}>ADD TICKER</span>
            <input
              value={addSym}
              onChange={(e) => setAddSym(e.target.value)}
              placeholder="Symbol  e.g. NVDA"
              style={{ height: 34, padding: '0 11px', borderRadius: 8, border: '1px solid var(--line2)', background: 'var(--bg)', color: 'var(--tx)', fontFamily: FONT_SANS, fontSize: '13px', textTransform: 'uppercase' }}
            />
            <input
              value={addBuyTarget}
              onChange={(e) => setAddBuyTarget(e.target.value)}
              placeholder="Buy target (optional)"
              aria-label="Buy target"
              style={{ height: 34, padding: '0 11px', borderRadius: 8, border: '1px solid var(--line2)', background: 'var(--bg)', color: 'var(--tx)', fontFamily: FONT_MONO, fontSize: '13px' }}
            />
            <input value={addSellTarget} onChange={(e) => setAddSellTarget(e.target.value)} placeholder="Sell target (optional)" aria-label="Sell target" style={{ height: 34, padding: '0 11px', borderRadius: 8, border: '1px solid var(--line2)', background: 'var(--bg)', color: 'var(--tx)', fontFamily: FONT_MONO, fontSize: '13px' }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={submitAdd} style={{ flex: 1, height: 34, borderRadius: 8, border: 'none', background: 'var(--accent)', color: 'var(--accentInk)', fontFamily: FONT_SANS, fontWeight: 700, fontSize: '12.5px', cursor: 'pointer' }}>Add</button>
              <button onClick={() => setShowAdd(false)} style={{ height: 34, padding: '0 14px', borderRadius: 8, border: '1px solid var(--line2)', background: 'transparent', color: 'var(--tx2)', fontFamily: FONT_SANS, fontSize: '12.5px', cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => requireAuth(() => openTickerFinder({ kind: 'track' }))}
            style={{ width: '100%', height: 42, borderRadius: 11, border: 'none', background: 'var(--accent)', color: 'var(--accentInk)', fontFamily: FONT_SANS, fontWeight: 700, fontSize: '13.5px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 4px 14px rgba(61,220,132,.2)' }}
          >
            <span style={{ fontSize: '17px', lineHeight: 1, marginTop: -1 }}>+</span>Add ticker
          </button>
        )}
      </div>
    </aside>
  )
}
