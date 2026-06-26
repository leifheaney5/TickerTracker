import { useEffect } from 'react'
import { useStore } from '../state/store'
import { COLORS } from '../theme/tokens'
import { Watchlist } from '../components/Watchlist'
import { MoversRibbon } from '../components/MoversRibbon'
import { StockHeader } from '../components/StockHeader'
import { ChartControls } from '../components/ChartControls'
import { StockChart } from '../charts/StockChart'
import { KeyStats } from '../components/KeyStats'
import { NewsCard } from '../components/NewsCard'
import { DueDiligence } from '../components/DueDiligence'

// Dashboard view — the hero. Sidebar watchlist + main research column:
// movers ribbon, stock header, chart controls + interactive chart, key stats,
// news, and due-diligence. Loads data for the selected symbol on change.
export function Dashboard() {
  const selected = useStore((s) => s.selected)
  const timeframe = useStore((s) => s.timeframe)
  const loadHistory = useStore((s) => s.loadHistory)
  const loadFundamentals = useStore((s) => s.loadFundamentals)
  const pollQuotes = useStore((s) => s.pollQuotes)

  useEffect(() => {
    loadHistory(selected, timeframe)
    loadFundamentals(selected)
    // Fetch a fresh quote for the newly selected symbol immediately rather than
    // waiting for the next 60s poll tick (otherwise stats briefly show seed/—).
    pollQuotes()
  }, [selected, timeframe, loadHistory, loadFundamentals, pollQuotes])

  return (
    <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
      <Watchlist />
      <main style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: 'var(--mpad,22px 26px)', display: 'flex', flexDirection: 'column', gap: 'var(--gap,16px)' }}>
        <MoversRibbon />
        <StockHeader />
        <ChartControls />
        <div style={{ background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: 16, padding: 8, flex: '0 0 auto' }}>
          <StockChart />
        </div>
        <div style={{ display: 'flex', gap: 'var(--gap,16px)', alignItems: 'stretch', flexWrap: 'wrap', flex: '0 0 auto' }}>
          <KeyStats />
          <NewsCard />
        </div>
        <DueDiligence />
      </main>
    </div>
  )
}
