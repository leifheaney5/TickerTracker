import { useEffect } from 'react'
import { useStore } from './state/store'
import { rootCssVars, COLORS, FONT_SANS } from './theme/tokens'
import { Header } from './components/Header'
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
  const pollQuotes = useStore((s) => s.pollQuotes)
  const watchlist = useStore((s) => s.watchlist)
  const view = useStore((s) => s.view)

  useEffect(() => {
    loadWatchlist()
    loadSettings()
    loadHoldings()
  }, [loadWatchlist, loadSettings, loadHoldings])

  useEffect(() => {
    if (!watchlist.length) return
    pollQuotes()
    const id = setInterval(pollQuotes, 60000)
    return () => clearInterval(id)
  }, [watchlist.length, pollQuotes])

  return (
    <div
      style={{
        ...rootCssVars(),
        position: 'relative', height: '100vh', display: 'flex', flexDirection: 'column',
        overflow: 'hidden', fontFamily: FONT_SANS, color: COLORS.tx, background: COLORS.bg,
      }}
    >
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
