import { useStore, type View, isAuthed } from '../state/store'
import { COLORS, FONT_SANS, FONT_MONO } from '../theme/tokens'
import { Logo } from './Logo'
import { money, pct } from '../lib/format'
import { UNIVERSE } from '../data/universe'

// Header chrome — ported from the prototype template (lines 29-141): logo mark,
// segmented view nav, centered LIVE wordmark, search popover, portfolio chip /
// connect-account, help and avatar. Alerts dropdown is wired in a later unit.

const NAV: { label: string; view: View }[] = [
  { label: 'Dashboard', view: 'dashboard' },
  { label: 'At-a-Glance', view: 'overview' },
  { label: 'Market', view: 'market' },
  { label: 'Crypto', view: 'crypto' },
  { label: 'Screener', view: 'screener' },
  { label: 'Strategy', view: 'strategy' },
]

function navBtnStyle(active: boolean): React.CSSProperties {
  return {
    padding: '7px 13px', borderRadius: '8px', border: 'none', cursor: 'pointer',
    fontFamily: FONT_SANS, fontSize: '12.5px', whiteSpace: 'nowrap',
    fontWeight: active ? 700 : 500,
    background: active ? 'var(--accent,#3ddc84)' : 'transparent',
    color: active ? COLORS.accentInk : COLORS.tx2,
  }
}

export function Header() {
  const view = useStore((s) => s.view)
  const setView = useStore((s) => s.setView)
  const searchOpen = useStore((s) => s.searchOpen)
  const setSearchOpen = useStore((s) => s.setSearchOpen)
  const search = useStore((s) => s.search)
  const setSearch = useStore((s) => s.setSearch)
  const setSelected = useStore((s) => s.setSelected)
  const settings = useStore((s) => s.settings)
  const authed = useStore(isAuthed)
  const currentUser = useStore((s) => s.currentUser)
  const openAuth = useStore((s) => s.openAuth)
  const price = useStore((s) => s.price)
  const chg = useStore((s) => s.chg)

  // Portfolio value from holdings is wired later; show connect state per settings.
  const connected = settings?.broker_connected ?? false

  // Search results across the known universe.
  const q = search.trim().toUpperCase()
  const matches = q
    ? Object.keys(UNIVERSE)
        .filter((s) => s.includes(q) || (UNIVERSE[s].name || '').toUpperCase().includes(q))
        .slice(0, 12)
    : []

  // Avatar initials: use real user name/email when authed.
  const acctInitials = authed && currentUser
    ? (currentUser.name
        ? currentUser.name.split(' ').map((p) => p[0]).join('').toUpperCase().slice(0, 2)
        : currentUser.email.slice(0, 2).toUpperCase())
    : 'JD'

  return (
    <header
      style={{
        height: '60px', flex: '0 0 auto', display: 'grid',
        gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: '16px',
        padding: '0 22px', borderBottom: `1px solid ${COLORS.line}`,
        background: COLORS.panel, position: 'relative', zIndex: 30,
      }}
    >
      {/* left: logo mark + view nav */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', justifySelf: 'start', minWidth: 0 }}>
        <div
          title="Ticker Tracker"
          style={{
            width: 32, height: 32, borderRadius: 9, background: COLORS.card,
            border: `1px solid ${COLORS.line2}`, position: 'relative', flex: '0 0 auto',
          }}
        >
          <span style={{ position: 'absolute', left: 5, top: 1, font: `800 16px ${FONT_MONO}`, lineHeight: 1, color: COLORS.up }}>T</span>
          <span style={{ position: 'absolute', right: 5, bottom: 1, font: `800 16px ${FONT_MONO}`, lineHeight: 1, color: COLORS.down }}>T</span>
        </div>
        <div
          style={{
            display: 'flex', gap: '3px', padding: '3px', borderRadius: '10px',
            background: COLORS.card, border: `1px solid ${COLORS.line}`,
            overflowX: 'auto', minWidth: 0, flex: '0 1 auto',
          }}
        >
          {NAV.map((n) => (
            <button key={n.view} onClick={() => setView(n.view)} style={navBtnStyle(view === n.view)}>
              {n.label}
            </button>
          ))}
        </div>
      </div>

      {/* center: LIVE pulse + wordmark */}
      <div style={{ justifySelf: 'center', display: 'flex', alignItems: 'center', gap: '9px', whiteSpace: 'nowrap' }}>
        <span
          title="Live"
          style={{
            width: 7, height: 7, borderRadius: '50%', background: COLORS.up,
            boxShadow: `0 0 9px ${COLORS.up}`, animation: 'ttpulse 1.8s ease-in-out infinite', flex: '0 0 auto',
          }}
        />
        <span style={{ fontFamily: FONT_SANS, fontWeight: 800, fontSize: '17px', letterSpacing: '-.025em' }}>
          <span style={{ color: COLORS.up }}>Ticker</span>
          <span style={{ color: COLORS.down }}>&nbsp;Tracker</span>
        </span>
      </div>

      {/* right: search, portfolio/connect, help, avatar */}
      <div style={{ justifySelf: 'end', display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
        <div style={{ position: 'relative', flex: '0 0 auto' }}>
          <button
            onClick={() => setSearchOpen(!searchOpen)}
            title="Search"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34,
              borderRadius: 9, background: COLORS.card, border: `1px solid ${COLORS.line}`,
              color: COLORS.tx2, cursor: 'pointer', fontSize: '15px',
            }}
          >
            ⌕
          </button>
          {searchOpen && (
            <div
              style={{
                position: 'absolute', top: 46, right: 0, width: 332, background: COLORS.panel,
                border: `1px solid ${COLORS.line2}`, borderRadius: 13,
                boxShadow: '0 18px 50px rgba(0,0,0,.55)', overflow: 'hidden', zIndex: 45,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 46, padding: '0 14px', borderBottom: `1px solid ${COLORS.line}` }}>
                <span style={{ color: COLORS.tx3, fontSize: '15px' }}>⌕</span>
                <input
                  autoFocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search ticker or company…"
                  style={{ flex: 1, border: 'none', background: 'transparent', color: COLORS.tx, fontFamily: FONT_SANS, fontSize: '13.5px' }}
                />
              </div>
              {matches.length > 0 && (
                <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                  {matches.map((s) => (
                    <div
                      key={s}
                      onClick={() => { setSelected(s); setView('dashboard'); setSearch(''); setSearchOpen(false) }}
                      style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 14px', cursor: 'pointer', borderTop: `1px solid ${COLORS.line}` }}
                    >
                      <Logo symbol={s} size={26} />
                      <span style={{ fontWeight: 700, fontSize: '13px', width: 46, color: COLORS.tx }}>{s}</span>
                      <span style={{ flex: 1, fontSize: '12.5px', color: COLORS.tx2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{UNIVERSE[s].name}</span>
                      <span style={{ fontFamily: FONT_MONO, fontSize: '12px', color: COLORS.tx }}>{money(price(s))}</span>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: chg(s) >= 0 ? COLORS.up : COLORS.down }}>{pct(chg(s))}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {connected ? (
          <div
            onClick={() => setView('holdings')}
            style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '6px 12px', borderRadius: 11, background: COLORS.card, border: `1px solid ${COLORS.line}`, flex: '0 0 auto', cursor: 'pointer' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.12 }}>
              <span style={{ fontSize: '9.5px', letterSpacing: '.05em', color: COLORS.tx3, fontWeight: 500 }}>PORTFOLIO</span>
              <span style={{ fontFamily: FONT_MONO, fontSize: '14px', fontWeight: 600, color: COLORS.tx }}>—</span>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setView('settings')}
            style={{ display: 'flex', alignItems: 'center', gap: 7, height: 38, padding: '0 14px', borderRadius: 11, background: 'transparent', border: `1px dashed ${COLORS.accent}`, color: COLORS.accent, fontFamily: FONT_SANS, fontWeight: 600, fontSize: '12px', cursor: 'pointer', flex: '0 0 auto' }}
          >
            ⊕ Connect account
          </button>
        )}

        {authed ? (
          <button
            onClick={() => setView('settings')}
            title="Account & settings"
            style={{ width: 34, height: 34, borderRadius: '50%', background: COLORS.card, border: `1px solid ${COLORS.line2}`, color: COLORS.tx, fontFamily: FONT_SANS, fontWeight: 700, fontSize: '12px', cursor: 'pointer', flex: '0 0 auto' }}
          >
            {acctInitials}
          </button>
        ) : (
          <button
            onClick={openAuth}
            title="Sign in"
            style={{ height: 34, padding: '0 16px', borderRadius: 10, border: 'none', background: COLORS.accent, color: COLORS.accentInk, fontFamily: FONT_SANS, fontWeight: 700, fontSize: '12.5px', cursor: 'pointer', flex: '0 0 auto' }}
          >
            Sign in
          </button>
        )}
      </div>
    </header>
  )
}
