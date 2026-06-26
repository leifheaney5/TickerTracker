import { useEffect, useState } from 'react'
import { useStore } from './state/store'
import { rootCssVars, COLORS, FONT_SANS } from './theme/tokens'
import { Header } from './components/Header'
import { AuthScreen } from './components/AuthScreen'
import { Dashboard } from './views/Dashboard'
import { Settings } from './views/Settings'
import { Alerts } from './views/Alerts'
import { Holdings } from './views/Holdings'
import { AtAGlance } from './views/AtAGlance'
import { Crypto } from './views/Crypto'
import { MarketViews } from './views/MarketViews'
import { Screener } from './views/Screener'
import { Strategy } from './views/Strategy'

// App root: mounts design tokens, the header chrome, and the active view body.
// Views are added unit by unit (Dashboard first).
export default function App() {
  const loadWatchlist = useStore((s) => s.loadWatchlist)
  const loadSettings = useStore((s) => s.loadSettings)
  const loadHoldings = useStore((s) => s.loadHoldings)
  const loadMe = useStore((s) => s.loadMe)
  const pollQuotes = useStore((s) => s.pollQuotes)
  const watchlist = useStore((s) => s.watchlist)
  const currentUser = useStore((s) => s.currentUser)
  const view = useStore((s) => s.view)
  const openAuth = useStore((s) => s.openAuth)

  // One-time banner for email verification outcome
  const [verifyBanner, setVerifyBanner] = useState<'ok' | 'failed' | null>(null)

  useEffect(() => {
    // Load auth state first; only fetch personalized data when authenticated.
    loadMe().then(() => {
      if (useStore.getState().currentUser) {
        loadWatchlist()
        loadSettings()
        loadHoldings()
      }
    })

    // Handle URL query params on first mount.
    const params = new URLSearchParams(window.location.search)
    const verify = params.get('verify')
    if (verify === 'ok' || verify === 'failed') {
      setVerifyBanner(verify)
      // Clean the URL without reload
      const clean = window.location.pathname
      window.history.replaceState(null, '', clean)
    }
    // reset_token is handled directly in AuthScreen
    if (params.get('reset_token')) {
      openAuth()
    }
  }, [loadMe, loadWatchlist, loadSettings, loadHoldings, openAuth])

  // Poll quotes for the effective symbol list (the user's watchlist, or the
  // demo list when anonymous) so cards/movers/At-a-Glance always show LIVE
  // prices — not stale seed values. Re-runs when auth or watchlist changes.
  useEffect(() => {
    pollQuotes()
    const id = setInterval(pollQuotes, 60000)
    return () => clearInterval(id)
  }, [watchlist.length, currentUser, pollQuotes])

  return (
    <div
      style={{
        ...rootCssVars(),
        position: 'relative', height: '100vh', display: 'flex', flexDirection: 'column',
        overflow: 'hidden', fontFamily: FONT_SANS, color: COLORS.tx, background: COLORS.bg,
      }}
    >
      <AuthScreen />
      {verifyBanner && (
        <div
          style={{
            position: 'fixed', top: 12, left: '50%', transform: 'translateX(-50%)',
            zIndex: 999, padding: '10px 20px', borderRadius: 10,
            background: verifyBanner === 'ok' ? 'rgba(61,220,132,.15)' : 'rgba(255,93,115,.15)',
            border: `1px solid ${verifyBanner === 'ok' ? COLORS.up : COLORS.down}`,
            color: verifyBanner === 'ok' ? COLORS.up : COLORS.down,
            fontFamily: FONT_SANS, fontSize: '13.5px', fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 10,
            boxShadow: '0 8px 24px rgba(0,0,0,.5)',
          }}
        >
          {verifyBanner === 'ok' ? '✓ Email verified — you can now log in.' : '✗ Verification link invalid or expired.'}
          <button
            onClick={() => setVerifyBanner(null)}
            style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', fontWeight: 700, fontSize: '15px', lineHeight: 1, padding: 0 }}
          >
            ×
          </button>
        </div>
      )}
      <Header />
      {view === 'dashboard' && <Dashboard />}
      {view === 'settings' && <Settings />}
      {view === 'alerts' && <Alerts />}
      {view === 'holdings' && <Holdings />}
      {view === 'overview' && <AtAGlance initialSub="overview" />}
      {view === 'deep' && <AtAGlance initialSub="deep" />}
      {view === 'crypto' && <Crypto />}
      {view === 'market' && <MarketViews sub="market" />}
      {view === 'map' && <MarketViews sub="map" />}
      {view === 'sectors' && <MarketViews sub="sectors" />}
      {view === 'screener' && <Screener />}
      {view === 'strategy' && <Strategy />}
    </div>
  )
}
