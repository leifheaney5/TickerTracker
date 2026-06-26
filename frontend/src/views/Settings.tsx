import { useStore, isAuthed } from '../state/store'
import { COLORS, FONT_SANS } from '../theme/tokens'
import { Toggle } from '../components/Toggle'

// Settings view — ported from the prototype template (lines 1184-1272): profile
// header, account details, connected accounts (brokerage connect/disconnect),
// notifications & data toggles, privacy, sign out. Wired to /api/settings.
export function Settings() {
  const settings = useStore((s) => s.settings)
  const updateSettings = useStore((s) => s.updateSettings)
  const holdings = useStore((s) => s.holdings)
  const authed = useStore(isAuthed)
  const currentUser = useStore((s) => s.currentUser)
  const logout = useStore((s) => s.logout)
  const openAuth = useStore((s) => s.openAuth)

  // Anonymous users have no settings — prompt sign-in instead of a stuck spinner.
  if (!authed) {
    return (
      <div style={{ flex: 1, overflow: 'auto', padding: 'var(--mpad,22px 26px)' }}>
        <div style={{ maxWidth: 480, margin: '48px auto 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center' }}>
          <span style={{ fontSize: '21px', fontWeight: 800, color: COLORS.tx }}>Settings</span>
          <span style={{ fontSize: '13.5px', color: COLORS.tx2, lineHeight: 1.5 }}>Create a free account or sign in to manage your profile, connect a brokerage, and set preferences.</span>
          <button onClick={() => openAuth('login')} style={{ height: 40, padding: '0 20px', borderRadius: 11, border: 'none', background: COLORS.accent, color: COLORS.accentInk, fontFamily: FONT_SANS, fontSize: '13.5px', fontWeight: 700, cursor: 'pointer' }}>Sign in / Sign up</button>
        </div>
      </div>
    )
  }

  if (!settings) return <div style={{ flex: 1, padding: 24, color: COLORS.tx3 }}>Loading…</div>

  const card: React.CSSProperties = { background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: 16 }
  const row: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '14px 0', borderTop: `1px solid ${COLORS.line}` }

  const toggleRow = (title: string, sub: string, key: keyof typeof settings) => (
    <div style={row}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <span style={{ fontSize: '13.5px', fontWeight: 600, color: COLORS.tx }}>{title}</span>
        <span style={{ fontSize: '11.5px', color: COLORS.tx3 }}>{sub}</span>
      </div>
      <Toggle on={!!settings[key]} onClick={() => updateSettings({ [key]: !settings[key] } as Partial<typeof settings>)} />
    </div>
  )

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 'var(--mpad,22px 26px)' }}>
      <div style={{ maxWidth: 740, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: '21px', fontWeight: 800, letterSpacing: '-.02em', color: COLORS.tx }}>Settings</span>
          <span style={{ fontSize: '13px', color: COLORS.tx2 }}>Manage your account, connections, and preferences</span>
        </div>

        <div style={{ ...card, padding: '20px 22px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg,#2a2f38,#171a1f)', border: `1px solid ${COLORS.line2}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '19px', fontWeight: 700, color: COLORS.tx, flex: '0 0 auto' }}>
            {authed && currentUser
              ? (currentUser.name
                  ? currentUser.name.split(' ').map((p) => p[0]).join('').toUpperCase().slice(0, 2)
                  : currentUser.email.slice(0, 2).toUpperCase())
              : 'JD'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
            <span style={{ fontSize: '17px', fontWeight: 700, color: COLORS.tx }}>
              {authed && currentUser ? (currentUser.name || currentUser.email) : 'Jordan Doe'}
            </span>
            <span style={{ fontSize: '13px', color: COLORS.tx2 }}>
              {authed && currentUser ? currentUser.email : 'jordan.doe@email.com'}
            </span>
            {authed && currentUser && (
              <span style={{ fontSize: '11.5px', fontWeight: 600, color: currentUser.email_verified ? COLORS.up : COLORS.warn }}>
                {currentUser.email_verified ? '✓ Email verified' : '⚠ Email not verified'}
              </span>
            )}
          </div>
          <div style={{ flex: 1 }} />
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 20, background: 'rgba(61,220,132,.1)', fontSize: '12px', fontWeight: 600, color: COLORS.accent }}>◆ Pro plan</span>
        </div>

        <div style={{ ...card, padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: COLORS.tx }}>Connected accounts</span>
          <span style={{ fontSize: '12px', color: COLORS.tx3, lineHeight: 1.55 }}>Your portfolio value is calculated from holdings synced via a connected brokerage — Ticker Tracker never moves your money. Connect an account to track real balances.</span>
          {settings.broker_connected ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '13px 15px', borderRadius: 12, background: COLORS.bg, border: `1px solid ${COLORS.line}` }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(61,220,132,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: COLORS.accent, fontSize: '17px', fontWeight: 800, flex: '0 0 auto' }}>↗</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: '13.5px', fontWeight: 700, color: COLORS.tx }}>{settings.broker_name || 'Connected brokerage'}</span>
                <span style={{ fontSize: '11.5px', fontWeight: 600, color: COLORS.up }}>● Connected · {holdings.length} holdings synced</span>
              </div>
              <button onClick={() => updateSettings({ broker_connected: false, broker_name: '' })} style={{ height: 34, padding: '0 14px', borderRadius: 9, border: `1px solid ${COLORS.line2}`, background: 'transparent', color: COLORS.tx2, fontFamily: FONT_SANS, fontSize: '12.5px', fontWeight: 600, cursor: 'pointer' }}>Disconnect</button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '13px 15px', borderRadius: 12, background: COLORS.bg, border: `1px dashed ${COLORS.line2}` }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: COLORS.cardHi, display: 'flex', alignItems: 'center', justifyContent: 'center', color: COLORS.tx3, fontSize: '18px', flex: '0 0 auto' }}>⊕</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: '13.5px', fontWeight: 600, color: COLORS.tx }}>No brokerage connected</span>
                <span style={{ fontSize: '11.5px', color: COLORS.tx3 }}>Portfolio value is hidden until an account is linked</span>
              </div>
              <button onClick={() => updateSettings({ broker_connected: true, broker_name: 'Demo Brokerage' })} style={{ height: 34, padding: '0 16px', borderRadius: 9, border: 'none', background: COLORS.accent, color: COLORS.accentInk, fontFamily: FONT_SANS, fontSize: '12.5px', fontWeight: 700, cursor: 'pointer' }}>Connect</button>
            </div>
          )}
        </div>

        <div style={{ ...card, padding: '6px 22px 14px' }}>
          <div style={{ padding: '16px 0 2px' }}><span style={{ fontSize: '13px', fontWeight: 700, color: COLORS.tx }}>Notifications &amp; data</span></div>
          {toggleRow('Live price updates', 'Continuously stream prices and sparklines', 'live_updates')}
          {toggleRow('Price alert notifications', 'Pop a toast the moment a target is hit', 'alert_notifs')}
          {toggleRow('Weekly market digest', 'Email summary of your watchlist every Monday', 'news_digest')}
        </div>

        <div style={{ ...card, padding: '6px 22px 14px' }}>
          <div style={{ padding: '16px 0 2px' }}><span style={{ fontSize: '13px', fontWeight: 700, color: COLORS.tx }}>Privacy &amp; display</span></div>
          {toggleRow('Hide balances', 'Mask your portfolio value across the app', 'hide_balances')}
        </div>

        {authed && (
          <button
            onClick={() => logout()}
            style={{ alignSelf: 'flex-start', height: 40, padding: '0 18px', borderRadius: 11, border: `1px solid ${COLORS.line2}`, background: 'transparent', color: COLORS.tx2, fontFamily: FONT_SANS, fontSize: '13px', fontWeight: 600, cursor: 'pointer', marginBottom: 8 }}
          >
            Sign out
          </button>
        )}
      </div>
    </div>
  )
}
