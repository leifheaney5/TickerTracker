import { useState } from 'react'
import { useStore, isAuthed } from '../state/store'
import { COLORS, FONT_SANS, FONT_MONO } from '../theme/tokens'
import { UNIVERSE } from '../data/universe'
import { Logo } from '../components/Logo'
import { money, pct } from '../lib/format'

// Dedicated full-screen watchlist manager: a clean editable list of the user's
// tickers (price/%, inline target edit, remove) plus a comma-separated bulk-add
// box. Requires an account (mutates the real watchlist) — anonymous users get a
// sign-in prompt (the moat).
export function ManageWatchlist() {
  const authed = useStore(isAuthed)
  const openAuth = useStore((s) => s.openAuth)
  const watchlist = useStore((s) => s.watchlist)
  const price = useStore((s) => s.price)
  const chg = useStore((s) => s.chg)
  const addWatch = useStore((s) => s.addWatch)
  const removeWatch = useStore((s) => s.removeWatch)
  const updateWatch = useStore((s) => s.updateWatch)
  const setSelected = useStore((s) => s.setSelected)
  const setView = useStore((s) => s.setView)

  const [bulk, setBulk] = useState('')
  const [adding, setAdding] = useState(false)
  const [addResult, setAddResult] = useState<string | null>(null)
  const [editSym, setEditSym] = useState<string | null>(null)
  const [editVal, setEditVal] = useState('')

  if (!authed) {
    return (
      <div style={{ flex: 1, overflow: 'auto', padding: 'var(--mpad,22px 26px)' }}>
        <div style={{ maxWidth: 480, margin: '48px auto 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center' }}>
          <span style={{ fontSize: '21px', fontWeight: 800, color: COLORS.tx }}>Your Watchlist</span>
          <span style={{ fontSize: '13.5px', color: COLORS.tx2, lineHeight: 1.5 }}>Create a free account to build and manage your own watchlist — add tickers in bulk, set price targets, and track them across the app.</span>
          <button onClick={openAuth} style={{ height: 40, padding: '0 20px', borderRadius: 11, border: 'none', background: COLORS.accent, color: COLORS.accentInk, fontFamily: FONT_SANS, fontSize: '13.5px', fontWeight: 700, cursor: 'pointer' }}>Sign in / Sign up</button>
        </div>
      </div>
    )
  }

  const items = watchlist.slice().sort((a, b) => a.position - b.position)

  const submitBulk = async () => {
    // Accept comma / space / newline separated symbols.
    const syms = Array.from(new Set(
      bulk.split(/[,\s]+/).map((s) => s.trim().toUpperCase()).filter(Boolean)
    ))
    if (!syms.length) return
    setAdding(true)
    setAddResult(null)
    let added = 0
    for (const s of syms) {
      // basic client-side symbol sanity; server validates too
      if (!/^[A-Z0-9.\-]{1,12}$/.test(s)) continue
      await addWatch(s)
      added++
    }
    setAdding(false)
    setBulk('')
    setAddResult(`Added ${added} ticker${added === 1 ? '' : 's'}.`)
    setTimeout(() => setAddResult(null), 4000)
  }

  const saveTarget = (sym: string) => {
    const v = parseFloat(editVal)
    if (!isNaN(v)) updateWatch(sym, { target: v })
    setEditSym(null)
  }

  const card: React.CSSProperties = { background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: 16 }

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 'var(--mpad,22px 26px)' }}>
      <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: '21px', fontWeight: 800, letterSpacing: '-.02em', color: COLORS.tx }}>Manage Watchlist</span>
          <span style={{ fontSize: '13px', color: COLORS.tx2 }}>{items.length} ticker{items.length === 1 ? '' : 's'} · add in bulk, set targets, remove</span>
        </div>

        {/* Bulk add */}
        <div style={{ ...card, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: COLORS.tx }}>Add tickers</span>
          <span style={{ fontSize: '12px', color: COLORS.tx3 }}>Enter one or more symbols separated by commas, spaces, or new lines — e.g. <span style={{ fontFamily: FONT_MONO, color: COLORS.tx2 }}>NVDA, RKLB, COIN</span></span>
          <textarea
            value={bulk}
            onChange={(e) => setBulk(e.target.value)}
            placeholder="NVDA, AAPL, MSFT, RKLB, KRKNF…"
            rows={2}
            style={{ resize: 'vertical', minHeight: 44, padding: '10px 12px', borderRadius: 9, border: `1px solid ${COLORS.line2}`, background: COLORS.bg, color: COLORS.tx, fontFamily: FONT_MONO, fontSize: '13px', textTransform: 'uppercase' }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={submitBulk}
              disabled={adding || !bulk.trim()}
              style={{ height: 36, padding: '0 18px', borderRadius: 9, border: 'none', background: bulk.trim() ? COLORS.accent : COLORS.cardHi, color: bulk.trim() ? COLORS.accentInk : COLORS.tx3, fontFamily: FONT_SANS, fontWeight: 700, fontSize: '13px', cursor: bulk.trim() ? 'pointer' : 'default' }}
            >
              {adding ? 'Adding…' : 'Add to watchlist'}
            </button>
            {addResult && <span style={{ fontSize: '12.5px', color: COLORS.up }}>{addResult}</span>}
          </div>
        </div>

        {/* Editable list */}
        <div style={{ ...card, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: 560 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(160px,1.6fr) 110px 90px 150px 90px', background: COLORS.panel, borderBottom: `1px solid ${COLORS.line}` }}>
                {['TICKER', 'PRICE', '24H', 'TARGET', ''].map((h, i) => (
                  <div key={i} style={{ padding: '12px 14px', fontSize: '11px', fontWeight: 600, letterSpacing: '.04em', color: COLORS.tx3 }}>{h}</div>
                ))}
              </div>
              {items.map((w) => {
                const u = UNIVERSE[w.symbol] || ({ name: w.symbol } as typeof UNIVERSE[string])
                const c = chg(w.symbol)
                const up = c >= 0
                return (
                  <div key={w.symbol} style={{ display: 'grid', gridTemplateColumns: 'minmax(160px,1.6fr) 110px 90px 150px 90px', alignItems: 'center', borderTop: `1px solid ${COLORS.line}` }}>
                    <div onClick={() => { setSelected(w.symbol); setView('dashboard') }} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '12px 14px', cursor: 'pointer', minWidth: 0 }}>
                      <Logo symbol={w.symbol} size={28} />
                      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <span style={{ fontWeight: 700, fontSize: '13.5px', color: COLORS.tx }}>{w.symbol}</span>
                        <span style={{ fontSize: '11px', color: COLORS.tx3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</span>
                      </div>
                    </div>
                    <div style={{ padding: '12px 14px', fontFamily: FONT_MONO, fontSize: '13px', color: COLORS.tx }}>{money(price(w.symbol))}</div>
                    <div style={{ padding: '12px 14px', fontFamily: FONT_MONO, fontSize: '12px', fontWeight: 600, color: up ? COLORS.up : COLORS.down }}>{pct(c)}</div>
                    <div style={{ padding: '10px 14px' }}>
                      {editSym === w.symbol ? (
                        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                          <input autoFocus value={editVal} onChange={(e) => setEditVal(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveTarget(w.symbol)} placeholder="$" style={{ width: 70, height: 30, padding: '0 8px', borderRadius: 7, border: `1px solid ${COLORS.accent}`, background: COLORS.bg, color: COLORS.tx, fontFamily: FONT_MONO, fontSize: '12.5px' }} />
                          <button onClick={() => saveTarget(w.symbol)} style={{ height: 30, padding: '0 10px', borderRadius: 7, border: 'none', background: COLORS.accent, color: COLORS.accentInk, fontWeight: 700, cursor: 'pointer' }}>✓</button>
                        </div>
                      ) : (
                        <span onClick={() => { setEditVal(w.target ? String(w.target) : ''); setEditSym(w.symbol) }} style={{ fontFamily: FONT_MONO, fontSize: '12.5px', color: w.target ? COLORS.tx : COLORS.tx3, cursor: 'pointer' }}>
                          {w.target ? money(w.target) : 'set target ✎'}
                        </span>
                      )}
                    </div>
                    <div style={{ padding: '12px 14px' }}>
                      <button onClick={() => removeWatch(w.symbol)} title="Remove" style={{ height: 30, padding: '0 12px', borderRadius: 7, border: `1px solid ${COLORS.line2}`, background: 'transparent', color: COLORS.tx2, fontFamily: FONT_SANS, fontSize: '12px', cursor: 'pointer' }}>Remove</button>
                    </div>
                  </div>
                )
              })}
              {items.length === 0 && (
                <div style={{ padding: '40px 18px', textAlign: 'center', color: COLORS.tx3, fontSize: '13px' }}>
                  Your watchlist is empty — add some tickers above to get started.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
