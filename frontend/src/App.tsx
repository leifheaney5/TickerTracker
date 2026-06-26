import { useEffect } from 'react'
import { useStore } from './state/store'
import { rootCssVars, COLORS, FONT_SANS } from './theme/tokens'

// Placeholder app shell — verifies the scaffold, tokens, and store wiring.
// The pixel-identical Dashboard and chrome arrive in Plan 5.
export default function App() {
  const loadWatchlist = useStore((s) => s.loadWatchlist)
  const loadSettings = useStore((s) => s.loadSettings)
  const pollQuotes = useStore((s) => s.pollQuotes)
  const watchlist = useStore((s) => s.watchlist)
  const marketStatus = useStore((s) => s.marketStatus)
  const price = useStore((s) => s.price)

  useEffect(() => {
    loadWatchlist()
    loadSettings()
  }, [loadWatchlist, loadSettings])

  useEffect(() => {
    if (!watchlist.length) return
    pollQuotes()
    const id = setInterval(pollQuotes, 60000)
    return () => clearInterval(id)
  }, [watchlist.length, pollQuotes])

  return (
    <div style={{ ...rootCssVars(), height: '100vh', background: COLORS.bg, color: COLORS.tx, fontFamily: FONT_SANS, padding: 24 }}>
      <h2 style={{ color: COLORS.up }}>Ticker Tracker — scaffold</h2>
      <p style={{ color: COLORS.tx2 }}>Market status: {marketStatus}</p>
      <ul style={{ fontFamily: "'JetBrains Mono', monospace", color: COLORS.tx }}>
        {watchlist.map((w) => (
          <li key={w.symbol}>
            {w.symbol}: {price(w.symbol).toFixed(2)}
          </li>
        ))}
      </ul>
    </div>
  )
}
