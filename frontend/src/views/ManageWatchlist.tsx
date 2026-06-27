import { useState, useRef } from 'react'
import { useStore, isAuthed } from '../state/store'
import { FONT_SANS, FONT_MONO } from '../theme/tokens'
import { UNIVERSE } from '../data/universe'
import { Logo } from '../components/Logo'
import { StarterPicker } from '../components/StarterPicker'
import { money, pct } from '../lib/format'
import { api } from '../api/client'

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
  const [shareLabel, setShareLabel] = useState<'Share' | 'Copying…' | 'Copied!'>('Share')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleShare = async () => {
    setShareLabel('Copying…')
    try {
      const res = await api.createShare()
      const url = `${location.origin}/s/${res.data.token}`
      await navigator.clipboard.writeText(url)
      setShareLabel('Copied!')
      setTimeout(() => setShareLabel('Share'), 2500)
    } catch {
      setShareLabel('Share')
    }
  }

  if (!authed) {
    return (
      <div style={{ flex: 1, overflow: 'auto', padding: 'var(--mpad,22px 26px)' }}>
        <div style={{ maxWidth: 480, margin: '48px auto 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center' }}>
          <span style={{ fontSize: '21px', fontWeight: 800, color: 'var(--tx)' }}>Your Watchlist</span>
          <span style={{ fontSize: '13.5px', color: 'var(--tx2)', lineHeight: 1.5 }}>Create a free account to build and manage your own watchlist — add tickers in bulk, set price targets, and track them across the app.</span>
          <button onClick={() => openAuth('signup')} style={{ height: 40, padding: '0 20px', borderRadius: 11, border: 'none', background: 'var(--accent)', color: 'var(--accentInk)', fontFamily: FONT_SANS, fontSize: '13.5px', fontWeight: 700, cursor: 'pointer' }}>Sign in / Sign up</button>
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

  const card: React.CSSProperties = { background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 16 }

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 'var(--mpad,22px 26px)' }}>
      <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: '21px', fontWeight: 800, letterSpacing: '-.02em', color: 'var(--tx)' }}>Manage Watchlist</span>
            <span style={{ fontSize: '13px', color: 'var(--tx2)' }}>{items.length} ticker{items.length === 1 ? '' : 's'} · add in bulk, set targets, remove</span>
          </div>
          <button
            onClick={handleShare}
            disabled={shareLabel === 'Copying…'}
            style={{
              height: 36, padding: '0 16px', borderRadius: 9, border: '1px solid var(--line2)',
              background: shareLabel === 'Copied!' ? 'var(--up)' : 'var(--card)',
              color: shareLabel === 'Copied!' ? 'var(--accentInk)' : 'var(--tx2)',
              fontFamily: FONT_SANS, fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              transition: 'background 0.2s, color 0.2s', flexShrink: 0,
            }}
          >
            {shareLabel === 'Copied!' ? '✓ Copied!' : shareLabel}
          </button>
        </div>

        {/* Starter watchlists — shown only when watchlist is empty */}
        {items.length === 0 && <StarterPicker />}

        {/* Bulk add */}
        <div style={{ ...card, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--tx)' }}>Add tickers</span>
          <span style={{ fontSize: '12px', color: 'var(--tx3)' }}>Enter one or more symbols separated by commas, spaces, or new lines — e.g. <span style={{ fontFamily: FONT_MONO, color: 'var(--tx2)' }}>NVDA, RKLB, COIN</span></span>
          <textarea
            value={bulk}
            onChange={(e) => setBulk(e.target.value)}
            placeholder="NVDA, AAPL, MSFT, RKLB, KRKNF…"
            rows={2}
            style={{ resize: 'vertical', minHeight: 44, padding: '10px 12px', borderRadius: 9, border: '1px solid var(--line2)', background: 'var(--bg)', color: 'var(--tx)', fontFamily: FONT_MONO, fontSize: '13px', textTransform: 'uppercase' }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={submitBulk}
              disabled={adding || !bulk.trim()}
              style={{ height: 36, padding: '0 18px', borderRadius: 9, border: 'none', background: bulk.trim() ? 'var(--accent)' : 'var(--cardHi)', color: bulk.trim() ? 'var(--accentInk)' : 'var(--tx3)', fontFamily: FONT_SANS, fontWeight: 700, fontSize: '13px', cursor: bulk.trim() ? 'pointer' : 'default' }}
            >
              {adding ? 'Adding…' : 'Add to watchlist'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt"
              title="Import tickers from file"
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (file) {
                  const text = await file.text()
                  setBulk(text)
                  e.target.value = ''
                }
              }}
              style={{ display: 'none' }}
              aria-label="Import tickers from file"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{ height: 36, padding: '0 16px', borderRadius: 9, border: '1px solid var(--line2)', background: 'var(--card)', color: 'var(--tx2)', fontFamily: FONT_SANS, fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
            >
              Import file
            </button>
            {addResult && <span style={{ fontSize: '12.5px', color: 'var(--up)' }}>{addResult}</span>}
          </div>
        </div>

        {/* Editable list */}
        <div style={{ ...card, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: 560 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(160px,1.6fr) 110px 90px 150px 120px 90px', background: 'var(--panel)', borderBottom: '1px solid var(--line)' }}>
                {['TICKER', 'PRICE', '24H', 'TARGET', 'ALERT', ''].map((h, i) => (
                  <div key={i} style={{ padding: '12px 14px', fontSize: '11px', fontWeight: 600, letterSpacing: '.04em', color: 'var(--tx3)' }}>{h}</div>
                ))}
              </div>
              {items.map((w) => {
                const u = UNIVERSE[w.symbol] || ({ name: w.symbol } as typeof UNIVERSE[string])
                const c = chg(w.symbol)
                const up = c >= 0
                return (
                  <div key={w.symbol} style={{ display: 'grid', gridTemplateColumns: 'minmax(160px,1.6fr) 110px 90px 150px 120px 90px', alignItems: 'center', borderTop: '1px solid var(--line)' }}>
                    <div onClick={() => { setSelected(w.symbol); setView('dashboard') }} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '12px 14px', cursor: 'pointer', minWidth: 0 }}>
                      <Logo symbol={w.symbol} size={28} />
                      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <span style={{ fontWeight: 700, fontSize: '13.5px', color: 'var(--tx)' }}>{w.symbol}</span>
                        <span style={{ fontSize: '11px', color: 'var(--tx3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</span>
                      </div>
                    </div>
                    <div style={{ padding: '12px 14px', fontFamily: FONT_MONO, fontSize: '13px', color: 'var(--tx)' }}>{money(price(w.symbol))}</div>
                    <div style={{ padding: '12px 14px', fontFamily: FONT_MONO, fontSize: '12px', fontWeight: 600, color: up ? 'var(--up)' : 'var(--down)' }}>{pct(c)}</div>
                    <div style={{ padding: '10px 14px' }}>
                      {editSym === w.symbol ? (
                        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                          <input autoFocus value={editVal} onChange={(e) => setEditVal(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveTarget(w.symbol)} placeholder="$" aria-label={`Target price for ${w.symbol}`} style={{ width: 70, height: 30, padding: '0 8px', borderRadius: 7, border: '1px solid var(--accent)', background: 'var(--bg)', color: 'var(--tx)', fontFamily: FONT_MONO, fontSize: '12.5px' }} />
                          <button onClick={() => saveTarget(w.symbol)} style={{ height: 30, padding: '0 10px', borderRadius: 7, border: 'none', background: 'var(--accent)', color: 'var(--accentInk)', fontWeight: 700, cursor: 'pointer' }}>✓</button>
                        </div>
                      ) : (
                        <span onClick={() => { setEditVal(w.target ? String(w.target) : ''); setEditSym(w.symbol) }} style={{ fontFamily: FONT_MONO, fontSize: '12.5px', color: w.target ? 'var(--tx)' : 'var(--tx3)', cursor: 'pointer' }}>
                          {w.target ? money(w.target) : 'set target ✎'}
                        </span>
                      )}
                    </div>
                    <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input
                        title="Set price alert"
                        aria-label={`Alert price for ${w.symbol}`}
                        type="number"
                        placeholder="$"
                        defaultValue={w.alert_price || ''}
                        onBlur={(e) => updateWatch(w.symbol, { alert_price: parseFloat(e.target.value) || 0 })}
                        style={{ width: 64, height: 28, padding: '0 7px', borderRadius: 7, border: '1px solid var(--line2)', background: 'var(--bg)', color: 'var(--tx)', fontFamily: FONT_MONO, fontSize: '12px' }}
                      />
                      <button
                        onClick={() => updateWatch(w.symbol, { alert_active: !w.alert_active })}
                        title={w.alert_active ? 'Alert on' : 'Alert off'}
                        aria-label={`Toggle price alert for ${w.symbol}`}
                        style={{ height: 28, padding: '0 8px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: 700, background: w.alert_active ? 'var(--up)' : 'var(--cardHi)', color: w.alert_active ? 'var(--accentInk)' : 'var(--tx3)' }}
                      >
                        {w.alert_active ? 'ON' : 'OFF'}
                      </button>
                    </div>
                    <div style={{ padding: '12px 14px' }}>
                      <button onClick={() => removeWatch(w.symbol)} title="Remove" aria-label={`Remove ${w.symbol}`} style={{ height: 30, padding: '0 12px', borderRadius: 7, border: '1px solid var(--line2)', background: 'transparent', color: 'var(--tx2)', fontFamily: FONT_SANS, fontSize: '12px', cursor: 'pointer' }}>Remove</button>
                    </div>
                  </div>
                )
              })}
              {items.length === 0 && (
                <div style={{ padding: '40px 18px', textAlign: 'center', color: 'var(--tx3)', fontSize: '13px' }}>
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
