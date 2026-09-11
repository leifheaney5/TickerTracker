import { useState } from 'react'
import { useStore, type View, isAuthed } from '../state/store'
import { FONT_SANS } from '../theme/tokens'
import { useIsMobile } from '../hooks/useIsMobile'

const NAV: { label: string; view: View }[] = [
  { label: 'Dashboard', view: 'dashboard' }, { label: 'At-a-Glance', view: 'overview' },
  { label: 'Market', view: 'market' }, { label: 'Crypto', view: 'crypto' },
]

function navStyle(active: boolean): React.CSSProperties {
  return { padding: '7px 13px', borderRadius: 8, border: 0, cursor: 'pointer', fontFamily: FONT_SANS, fontSize: 12.5, whiteSpace: 'nowrap', fontWeight: active ? 700 : 500, background: active ? 'var(--accent)' : 'transparent', color: active ? 'var(--accentInk)' : 'var(--tx2)' }
}

export function Header() {
  const view = useStore((s) => s.view)
  const setView = useStore((s) => s.setView)
  const openFinder = useStore((s) => s.openTickerFinder)
  const settings = useStore((s) => s.settings)
  const authed = useStore(isAuthed)
  const user = useStore((s) => s.currentUser)
  const openAuth = useStore((s) => s.openAuth)
  const isMobile = useIsMobile()
  const [menuOpen, setMenuOpen] = useState(false)
  const connected = settings?.broker_connected ?? false
  const initials = user ? (user.name ? user.name.split(' ').map((part) => part[0]).join('').slice(0, 2) : user.email.slice(0, 2)).toUpperCase() : ''
  const navigate = (next: View) => { setView(next); setMenuOpen(false) }

  if (isMobile) return (
    <header style={{ flex: '0 0 auto', background: 'var(--panel)', borderBottom: '1px solid var(--line)', position: 'relative', zIndex: 30 }}>
      <div style={{ height: 58, display: 'flex', alignItems: 'center', gap: 9, padding: '0 12px' }}>
        <img src="/favicon.svg" alt="Ticker Tracker" width={40} height={40} style={{ borderRadius: 10, flex: '0 0 auto' }} />
        <button onClick={() => setMenuOpen((open) => !open)} aria-label="Open navigation menu" style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--tx2)', cursor: 'pointer' }}>{menuOpen ? '×' : '☰'}</button>
        <span style={{ flex: 1, fontSize: 13.5, fontWeight: 700, color: 'var(--tx)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{NAV.find((item) => item.view === view)?.label ?? 'Ticker Tracker'}</span>
        <button onClick={() => openFinder({ kind: 'browse' })} aria-label="Search tickers" style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--tx2)', cursor: 'pointer', fontSize: 17 }}>⌕</button>
        {authed ? <button onClick={() => setView('settings')} aria-label="Account menu" style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--card)', border: '1px solid var(--line2)', color: 'var(--tx)', fontWeight: 700 }}>{initials}</button> : <button onClick={() => openAuth('login')} style={{ height: 36, padding: '0 12px', borderRadius: 10, border: 0, background: 'var(--accent)', color: 'var(--accentInk)', fontWeight: 700 }}>Sign in</button>}
      </div>
      {menuOpen && <nav style={{ padding: '8px 12px 12px', borderTop: '1px solid var(--line)', display: 'grid', gap: 3 }}>
        {NAV.map((item) => <button key={item.view} onClick={() => navigate(item.view)} style={{ ...navStyle(view === item.view), textAlign: 'left', padding: '11px 14px' }}>{item.label}</button>)}
        {authed && <button data-testid="mobile-nav-alerts" onClick={() => navigate('alerts')} style={{ ...navStyle(view === 'alerts'), textAlign: 'left', padding: '11px 14px' }}>Alerts</button>}
        {connected && <button onClick={() => navigate('holdings')} style={{ ...navStyle(view === 'holdings'), textAlign: 'left', padding: '11px 14px' }}>Portfolio</button>}
      </nav>}
    </header>
  )

  return (
    <header style={{ minHeight: 64, flex: '0 0 auto', display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 16, padding: '0 22px', borderBottom: '1px solid var(--line)', background: 'var(--panel)', zIndex: 30 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
        <img src="/favicon.svg" alt="Ticker Tracker" width={44} height={44} style={{ borderRadius: 11, flex: '0 0 auto' }} />
        <nav style={{ display: 'flex', gap: 3, padding: 3, borderRadius: 10, background: 'var(--card)', border: '1px solid var(--line)', overflowX: 'auto' }}>{NAV.map((item) => <button key={item.view} onClick={() => setView(item.view)} style={navStyle(view === item.view)}>{item.label}</button>)}</nav>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, whiteSpace: 'nowrap' }}><span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--up)', boxShadow: '0 0 9px var(--up)' }} /><span style={{ fontWeight: 800, fontSize: 17 }}><span style={{ color: 'var(--up)' }}>Ticker</span> <span style={{ color: 'var(--down)' }}>Tracker</span></span></div>
      <div style={{ justifySelf: 'end', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={() => openFinder({ kind: 'browse' })} style={{ height: 40, padding: '0 16px', display: 'flex', alignItems: 'center', gap: 8, borderRadius: 11, background: 'var(--card)', border: '1px solid var(--line2)', color: 'var(--tx)', cursor: 'pointer', fontWeight: 700 }}><span aria-hidden="true">⌕</span> Find ticker <kbd style={{ color: 'var(--tx3)', fontSize: 10 }}>/</kbd></button>
        {connected && <button onClick={() => setView('holdings')} style={{ height: 40, padding: '0 14px', borderRadius: 11, background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--tx2)', cursor: 'pointer' }}>Portfolio</button>}
        {settings?.broker_connected && <button onClick={() => setView('holdings')} style={{ height: 40, padding: '0 14px', borderRadius: 11, background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--tx2)', cursor: 'pointer' }}>Portfolio</button>}
        {authed ? <button onClick={() => setView('settings')} aria-label="Account menu" style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--card)', border: '1px solid var(--line2)', color: 'var(--tx)', fontWeight: 700 }}>{initials}</button> : <button onClick={() => openAuth('login')} style={{ height: 40, padding: '0 17px', borderRadius: 11, border: 0, background: 'var(--accent)', color: 'var(--accentInk)', fontWeight: 700 }}>Sign in</button>}
      </div>
    </header>
  )
}
