import { useState, useEffect } from 'react'
import { useStore, isAuthed } from '../state/store'
import { COLORS, FONT_SANS, FONT_MONO } from '../theme/tokens'
import { UNIVERSE } from '../data/universe'
import { Logo } from '../components/Logo'
import { money, pct, capStr } from '../lib/format'
import { api } from '../api/client'
import type { SavedScreen } from '../api/types'

// Screener — ported from the prototype template (lines 674-715): filter the full
// universe by sector group / performance / market-cap tier, with a + Compare
// (up to 4) selection. Rows open the Dashboard.
const GROUP_TABS = ['All', 'Tech', 'Energy', 'Finance', 'Crypto']
const PERF_TABS = ['All', 'Gainers', 'Losers']
const CAP_TABS = ['All', 'Mega', 'Large']

export function Screener() {
  const price = useStore((s) => s.price)
  const chg = useStore((s) => s.chg)
  const fundamentals = useStore((s) => s.fundamentals)
  const loadFundamentals = useStore((s) => s.loadFundamentals)
  const setSelected = useStore((s) => s.setSelected)
  const setView = useStore((s) => s.setView)
  const authed = useStore(isAuthed)
  const openAuth = useStore((s) => s.openAuth)
  const [grp, setGrp] = useState('All')
  const [perf, setPerf] = useState('All')
  const [cap, setCap] = useState('All')
  const [cmp, setCmp] = useState<string[]>([])

  // ── saved screens state ───────────────────────────────────────────────────
  const [savedScreens, setSavedScreens] = useState<SavedScreen[]>([])
  const [saveName, setSaveName] = useState('')
  const [saving, setSaving] = useState(false)
  const [screensOpen, setScreensOpen] = useState(false)

  // Load saved screens on mount (auth-only)
  useEffect(() => {
    if (!authed) return
    api.getScreens().then(({ data }) => setSavedScreens(data)).catch(() => {})
  }, [authed])

  const handleSave = async () => {
    const n = saveName.trim()
    if (!n) return
    setSaving(true)
    try {
      const { data } = await api.saveScreen({ name: n, filters: { grp, perf, cap } })
      setSavedScreens((prev) => [...prev, data])
      setSaveName('')
    } catch { /* ignore */ } finally {
      setSaving(false)
    }
  }

  const handleLoadScreen = (s: SavedScreen) => {
    setGrp(s.filters.grp ?? 'All')
    setPerf(s.filters.perf ?? 'All')
    setCap(s.filters.cap ?? 'All')
    setScreensOpen(false)
  }

  const handleDeleteScreen = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await api.deleteScreen(id)
      setSavedScreens((prev) => prev.filter((s) => s.id !== id))
    } catch { /* ignore */ }
  }

  const capTier = (capStr: string): 'Mega' | 'Large' | 'Other' => {
    if (capStr.includes('T')) return 'Mega'
    const n = parseFloat(capStr)
    if (capStr.includes('B') && n >= 200) return 'Large'
    return 'Other'
  }

  let rows = Object.keys(UNIVERSE).filter((sym) => {
    const u = UNIVERSE[sym]
    if (grp !== 'All' && u.group !== grp) return false
    if (perf === 'Gainers' && chg(sym) < 0) return false
    if (perf === 'Losers' && chg(sym) >= 0) return false
    if (cap !== 'All' && capTier(u.cap) !== cap) return false
    return true
  })
  rows = rows.sort((a, b) => chg(b) - chg(a))

  // Load LIVE quotes + real fundamentals for the visible rows so cap/P/E/price
  // aren't stale seed values. Capped to respect the provider rate limit; the
  // filtered list is usually well under this.
  const visible = rows.slice(0, 30)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data } = await api.quotes(visible)
        if (cancelled) return
        useStore.setState((st) => ({ quotes: { ...st.quotes, ...data.quotes } }))
      } catch { /* keep seed */ }
    })()
    visible.forEach((s) => loadFundamentals(s))
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible.join(',')])

  const toggleCmp = (sym: string) => setCmp((c) => (c.includes(sym) ? c.filter((x) => x !== sym) : c.length >= 4 ? c : [...c, sym]))

  const tab = (active: boolean): React.CSSProperties => ({
    padding: '6px 11px', borderRadius: 7, border: 'none', cursor: 'pointer', fontFamily: FONT_SANS, fontSize: '12px',
    fontWeight: active ? 700 : 500, background: active ? COLORS.accent : 'transparent', color: active ? COLORS.accentInk : COLORS.tx2,
  })
  const filterGroup = (label: string, opts: string[], val: string, set: (v: string) => void) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      <span style={{ fontSize: '11px', letterSpacing: '.04em', color: COLORS.tx3, fontWeight: 600 }}>{label}</span>
      <div style={{ display: 'flex', gap: 3, padding: 3, borderRadius: 9, background: COLORS.bg }}>
        {opts.map((o) => <button key={o} onClick={() => set(o)} style={tab(o === val)}>{o}</button>)}
      </div>
    </div>
  )

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 'var(--mpad,22px 26px)', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: '21px', fontWeight: 800, letterSpacing: '-.02em', color: COLORS.tx }}>Screener</span>
        <span style={{ fontSize: '13px', color: COLORS.tx2 }}>{rows.length} matches · tap "+ Compare" on up to 4 stocks{cmp.length ? ` · comparing ${cmp.length}` : ''}</span>
      </div>
      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: 16, padding: '16px 18px', display: 'flex', gap: 22, flexWrap: 'wrap', alignItems: 'flex-end', flex: '0 0 auto' }}>
        {filterGroup('SECTOR', GROUP_TABS, grp, setGrp)}
        {filterGroup('PERFORMANCE', PERF_TABS, perf, setPerf)}
        {filterGroup('MARKET CAP', CAP_TABS, cap, setCap)}

        {/* ── Save / Load screens ─────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginLeft: 'auto' }}>
          <span style={{ fontSize: '11px', letterSpacing: '.04em', color: COLORS.tx3, fontWeight: 600 }}>SAVED SCREENS</span>
          {authed ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {/* Save current filters */}
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
                  placeholder="Name this screen…"
                  style={{
                    height: 28, padding: '0 9px', borderRadius: 7, border: `1px solid ${COLORS.line2}`,
                    background: COLORS.bg, color: COLORS.tx, fontFamily: FONT_SANS, fontSize: '12px',
                    outline: 'none', width: 156,
                  }}
                />
                <button
                  onClick={handleSave}
                  disabled={saving || !saveName.trim()}
                  style={{
                    height: 28, padding: '0 11px', borderRadius: 7, border: 'none', cursor: 'pointer',
                    fontFamily: FONT_SANS, fontSize: '12px', fontWeight: 600,
                    background: COLORS.accent, color: COLORS.accentInk,
                    opacity: saving || !saveName.trim() ? 0.5 : 1,
                  }}
                >
                  Save
                </button>
                {/* Load saved screens dropdown toggle */}
                {savedScreens.length > 0 && (
                  <div style={{ position: 'relative' }}>
                    <button
                      onClick={() => setScreensOpen((o) => !o)}
                      style={{
                        height: 28, padding: '0 11px', borderRadius: 7, cursor: 'pointer',
                        fontFamily: FONT_SANS, fontSize: '12px', fontWeight: 600,
                        border: `1px solid ${COLORS.line2}`, background: 'transparent', color: COLORS.tx2,
                      }}
                    >
                      Load ▾
                    </button>
                    {screensOpen && (
                      <div style={{
                        position: 'absolute', top: 32, right: 0, zIndex: 100, minWidth: 200,
                        background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: 10,
                        boxShadow: '0 8px 24px rgba(0,0,0,.25)', overflow: 'hidden',
                      }}>
                        {savedScreens.map((sc) => (
                          <div
                            key={sc.id}
                            onClick={() => handleLoadScreen(sc)}
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              padding: '9px 12px', cursor: 'pointer', borderBottom: `1px solid ${COLORS.line}`,
                              gap: 8,
                            }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = COLORS.panel }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
                          >
                            <span style={{ fontSize: '13px', color: COLORS.tx, fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sc.name}</span>
                            <button
                              onClick={(e) => handleDeleteScreen(sc.id, e)}
                              title="Delete"
                              style={{
                                width: 20, height: 20, borderRadius: 4, border: 'none', cursor: 'pointer',
                                background: 'transparent', color: COLORS.tx3, fontFamily: FONT_SANS,
                                fontSize: '13px', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                flexShrink: 0,
                              }}
                            >×</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <button
              onClick={() => openAuth('login')}
              style={{
                height: 28, padding: '0 11px', borderRadius: 7, border: `1px solid ${COLORS.line2}`,
                background: 'transparent', color: COLORS.tx3, fontFamily: FONT_SANS, fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              Sign in to save screens
            </button>
          )}
        </div>
      </div>

      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: 16, overflow: 'hidden', flex: '0 0 auto' }}>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 820 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(160px,1.4fr) 130px 96px 78px 96px 60px 124px', background: COLORS.panel, borderBottom: `1px solid ${COLORS.line}` }}>
              {['TICKER', 'SECTOR', 'PRICE', '24H', 'MKT CAP', 'P/E', ''].map((h, i) => <div key={i} style={{ padding: '12px 12px', fontSize: '11px', fontWeight: 600, letterSpacing: '.04em', color: COLORS.tx3 }}>{h}</div>)}
            </div>
            {rows.map((sym) => {
              const u = UNIVERSE[sym]
              const c = chg(sym)
              const inCmp = cmp.includes(sym)
              return (
                <div key={sym} style={{ display: 'grid', gridTemplateColumns: 'minmax(160px,1.4fr) 130px 96px 78px 96px 60px 124px', alignItems: 'center', borderTop: `1px solid ${COLORS.line}` }}>
                  <div onClick={() => { setSelected(sym); setView('dashboard') }} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '12px 12px', cursor: 'pointer', minWidth: 0 }}>
                    <Logo symbol={sym} size={26} />
                    <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <span style={{ fontWeight: 700, fontSize: '13px', color: COLORS.tx }}>{sym}</span>
                      <span style={{ fontSize: '11px', color: COLORS.tx3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</span>
                    </div>
                  </div>
                  <div style={{ padding: '12px 12px', fontSize: '12px', color: COLORS.tx2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.sector}</div>
                  <div style={{ padding: '12px 12px', fontFamily: FONT_MONO, fontSize: '12.5px', color: COLORS.tx }}>{money(price(sym))}</div>
                  <div style={{ padding: '12px 12px', fontFamily: FONT_MONO, fontSize: '12px', fontWeight: 600, color: c >= 0 ? COLORS.up : COLORS.down }}>{pct(c)}</div>
                  <div style={{ padding: '12px 12px', fontFamily: FONT_MONO, fontSize: '12.5px', color: COLORS.tx2 }}>{fundamentals[sym] ? capStr(fundamentals[sym].market_cap) : u.cap}</div>
                  <div style={{ padding: '12px 12px', fontFamily: FONT_MONO, fontSize: '12.5px', color: COLORS.tx2 }}>{fundamentals[sym] && fundamentals[sym].pe ? String(fundamentals[sym].pe) : u.pe}</div>
                  <div style={{ padding: '12px 12px' }}>
                    <button onClick={() => toggleCmp(sym)} style={{ height: 28, padding: '0 11px', borderRadius: 7, cursor: 'pointer', fontFamily: FONT_SANS, fontSize: '11.5px', fontWeight: 600, border: `1px solid ${inCmp ? COLORS.accent : COLORS.line2}`, background: inCmp ? 'rgba(61,220,132,.1)' : 'transparent', color: inCmp ? COLORS.accent : COLORS.tx2 }}>
                      {inCmp ? '✓ Added' : '+ Compare'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
