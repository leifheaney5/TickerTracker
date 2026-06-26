import { useState } from 'react'
import { useStore, type SortBy } from '../state/store'
import { COLORS, FONT_SANS, FONT_MONO } from '../theme/tokens'
import { GROUPS, UNIVERSE } from '../data/universe'
import { DEMO_WATCH } from '../data/demo'
import { Logo } from './Logo'
import { Sparkline } from '../charts/Sparkline'
import { money, pct } from '../lib/format'
import { useRequireAuth } from '../hooks/useRequireAuth'

// Watchlist sidebar — ported from the prototype template (lines 148-216):
// title + count + sort cycle, group folder tabs, draggable cards with sparkline
// and target-progress bar, empty state, and the add-ticker footer form.

const SORT_LABEL: Record<SortBy, string> = { manual: 'Manual', change: '% Change', price: 'Price', az: 'A–Z' }

function groupTabStyle(active: boolean): React.CSSProperties {
  return {
    padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontFamily: FONT_SANS,
    fontSize: '12px', whiteSpace: 'nowrap', flex: '0 0 auto',
    border: active ? '1px solid transparent' : `1px solid ${COLORS.line}`,
    background: active ? 'var(--accent,#3ddc84)' : 'transparent',
    color: active ? COLORS.accentInk : COLORS.tx2,
    fontWeight: active ? 700 : 500,
  }
}

export function Watchlist() {
  const isAuthed = useStore((s) => s.currentUser !== null)
  const watchlist = useStore((s) => s.watchlist)
  const selected = useStore((s) => s.selected)
  const setSelected = useStore((s) => s.setSelected)
  const group = useStore((s) => s.group)
  const setGroup = useStore((s) => s.setGroup)
  const sortBy = useStore((s) => s.sortBy)
  const setSortBy = useStore((s) => s.setSortBy)
  const price = useStore((s) => s.price)
  const chg = useStore((s) => s.chg)
  const flash = useStore((s) => s.flash)
  const addWatch = useStore((s) => s.addWatch)
  const requireAuth = useRequireAuth()

  const [showAdd, setShowAdd] = useState(false)
  const [addSym, setAddSym] = useState('')
  const [addTarget, setAddTarget] = useState('')
  const [dragSym, setDragSym] = useState<string | null>(null)

  const cycleSort = () => {
    const order: SortBy[] = ['manual', 'change', 'price', 'az']
    setSortBy(order[(order.indexOf(sortBy) + 1) % order.length])
  }

  // base list: use DB-backed watchlist when authed, otherwise show demo list read-only.
  const sourceSymbols = isAuthed
    ? watchlist
        .slice()
        .sort((a, b) => a.position - b.position)
        .map((w) => w.symbol)
    : DEMO_WATCH.slice()
  let base = sourceSymbols.filter((s) => group === 'All' || UNIVERSE[s]?.group === group)
  if (sortBy === 'change') base = base.slice().sort((a, b) => chg(b) - chg(a))
  else if (sortBy === 'price') base = base.slice().sort((a, b) => price(b) - price(a))
  else if (sortBy === 'az') base = base.slice().sort((a, b) => a.localeCompare(b))

  const dragOK = sortBy === 'manual'

  const submitAdd = () => {
    const sym = addSym.trim().toUpperCase()
    if (!sym) return
    addWatch(sym, parseFloat(addTarget) || 0)
    setAddSym('')
    setAddTarget('')
    setShowAdd(false)
  }

  return (
    <aside
      style={{
        width: 336, flex: '0 0 auto', borderRight: `1px solid ${COLORS.line}`,
        background: COLORS.panel, display: 'flex', flexDirection: 'column', minHeight: 0,
      }}
    >
      <div style={{ padding: '16px 16px 10px', display: 'flex', flexDirection: 'column', gap: 12, flex: '0 0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: '14px', fontWeight: 700, letterSpacing: '-.01em', color: COLORS.tx }}>Watchlist</span>
            <span style={{ fontSize: '11.5px', color: COLORS.tx3 }}>{base.length}</span>
          </div>
          <button
            onClick={cycleSort}
            title="Change sort order"
            style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'transparent', border: 'none', color: COLORS.tx3, fontFamily: FONT_SANS, fontSize: '11.5px', fontWeight: 600, cursor: 'pointer' }}
          >
            ⇅ {SORT_LABEL[sortBy]}
          </button>
        </div>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
          {GROUPS.map((g) => (
            <button key={g} onClick={() => setGroup(g)} style={groupTabStyle(g === group)}>
              {g}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 'var(--lgap,8px)' }}>
        {base.map((sym) => {
          const u = UNIVERSE[sym] || { name: sym, target: 0 } as typeof UNIVERSE[string]
          const wl = watchlist.find((w) => w.symbol === sym)
          const target = wl?.target ?? u.target ?? 0
          const p = price(sym)
          const c = chg(sym)
          const up = c >= 0
          const fl = flash[sym]
          const hasT = target > 0
          const prog = hasT ? Math.max(2, Math.min(100, (p / target) * 100)) : 0
          const near = hasT && prog >= 92
          const priceColor = fl === 'up' ? COLORS.up : fl === 'down' ? COLORS.down : COLORS.tx
          return (
            <div
              key={sym}
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
                border: `1px solid ${sym === selected ? COLORS.accent : COLORS.line}`,
                background: sym === selected ? COLORS.cardHi : COLORS.card,
                cursor: dragOK ? 'grab' : 'pointer', opacity: dragSym === sym ? 0.4 : 1,
                boxShadow: sym === selected ? `0 0 0 1px ${COLORS.accent}` : 'none',
                transition: 'border-color .15s',
              }}
            >
              <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
                <Logo symbol={sym} size={30} />
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ fontWeight: 700, fontSize: '14px', letterSpacing: '-.01em', color: COLORS.tx }}>{sym}</span>
                    {near && <span title="Near target" style={{ fontSize: '10px', color: COLORS.accent }}>◆</span>}
                  </div>
                  <span style={{ fontSize: '11.5px', color: COLORS.tx2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }}>{u.name}</span>
                  <span style={{ fontFamily: FONT_MONO, fontSize: '14px', fontWeight: 500, marginTop: 2, color: priceColor }}>{money(p)}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                  <span style={{ fontSize: '11.5px', fontWeight: 600, fontFamily: FONT_MONO, padding: '2px 7px', borderRadius: 6, background: up ? 'rgba(61,220,132,.12)' : 'rgba(255,93,115,.12)', color: up ? COLORS.up : COLORS.down }}>{pct(c)}</span>
                  <Sparkline symbol={sym} />
                </div>
              </div>
              {hasT && (
                <div style={{ marginTop: 11, display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', color: COLORS.tx3 }}>
                    <span>Target {money(target)}</span>
                    <span>{p >= target ? 'reached' : ((target - p) / p * 100).toFixed(1) + '% to go'}</span>
                  </div>
                  <div style={{ height: 4, borderRadius: 3, background: COLORS.line, overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 3, background: p >= target ? COLORS.up : COLORS.accent, width: prog.toFixed(0) + '%' }} />
                  </div>
                </div>
              )}
            </div>
          )
        })}
        {base.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9, padding: '46px 18px', textAlign: 'center' }}>
            <span style={{ fontSize: '26px', opacity: 0.7 }}>☆</span>
            <span style={{ fontSize: '13px', fontWeight: 600, color: COLORS.tx2 }}>No tickers here yet</span>
            <span style={{ fontSize: '11.5px', color: COLORS.tx3, lineHeight: 1.5 }}>
              {group !== 'All' ? 'No tickers in this group yet' : 'Add a ticker to start tracking'}
            </span>
          </div>
        )}
      </div>

      <div style={{ flex: '0 0 auto', padding: 12, borderTop: `1px solid ${COLORS.line}` }}>
        {showAdd ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, padding: 12, borderRadius: 12, background: COLORS.card, border: `1px solid ${COLORS.line2}` }}>
            <span style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '.03em', color: COLORS.tx2 }}>ADD TICKER</span>
            <input
              value={addSym}
              onChange={(e) => setAddSym(e.target.value)}
              placeholder="Symbol  e.g. NVDA"
              style={{ height: 34, padding: '0 11px', borderRadius: 8, border: `1px solid ${COLORS.line2}`, background: COLORS.bg, color: COLORS.tx, fontFamily: FONT_SANS, fontSize: '13px', textTransform: 'uppercase' }}
            />
            <input
              value={addTarget}
              onChange={(e) => setAddTarget(e.target.value)}
              placeholder="Target price (optional)"
              style={{ height: 34, padding: '0 11px', borderRadius: 8, border: `1px solid ${COLORS.line2}`, background: COLORS.bg, color: COLORS.tx, fontFamily: FONT_MONO, fontSize: '13px' }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={submitAdd} style={{ flex: 1, height: 34, borderRadius: 8, border: 'none', background: COLORS.accent, color: COLORS.accentInk, fontFamily: FONT_SANS, fontWeight: 700, fontSize: '12.5px', cursor: 'pointer' }}>Add</button>
              <button onClick={() => setShowAdd(false)} style={{ height: 34, padding: '0 14px', borderRadius: 8, border: `1px solid ${COLORS.line2}`, background: 'transparent', color: COLORS.tx2, fontFamily: FONT_SANS, fontSize: '12.5px', cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => requireAuth(() => setShowAdd(true))}
            style={{ width: '100%', height: 42, borderRadius: 11, border: 'none', background: COLORS.accent, color: COLORS.accentInk, fontFamily: FONT_SANS, fontWeight: 700, fontSize: '13.5px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 4px 14px rgba(61,220,132,.2)' }}
          >
            <span style={{ fontSize: '17px', lineHeight: 1, marginTop: -1 }}>+</span>Add ticker
          </button>
        )}
      </div>
    </aside>
  )
}
