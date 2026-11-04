import { useEffect } from 'react'
import { useStore } from '../state/store'
import { Watchlist } from '../components/Watchlist'
import { StockHeader } from '../components/StockHeader'
import { PulseWhy } from '../components/PulseWhy'
import { ChartControls } from '../components/ChartControls'
import { StockChart } from '../charts/StockChart'
import { KeyStats } from '../components/KeyStats'
import { NewsCard } from '../components/NewsCard'
import { DueDiligence } from '../components/DueDiligence'
import { useIsMobile } from '../hooks/useIsMobile'

// Dashboard view — the hero. Sidebar watchlist + main research column:
// movers ribbon, stock header, chart controls + interactive chart, key stats,
// news, and due-diligence. Loads data for the selected symbol on change.
export function Dashboard() {
  const selected = useStore((s) => s.selected)
  const timeframe = useStore((s) => s.timeframe)
  const loadHistory = useStore((s) => s.loadHistory)
  const loadFundamentals = useStore((s) => s.loadFundamentals)
  const isMobile = useIsMobile()

  useEffect(() => {
    loadHistory(selected, timeframe)
    loadFundamentals(selected)
  }, [selected, timeframe, loadHistory, loadFundamentals])

  return (
    // On mobile: stack vertically (Watchlist collapses, main goes full-width).
    // On desktop: side-by-side flex ROW as before.
    <div style={{ flex: 1, display: 'flex', flexDirection: isMobile ? 'column' : 'row', minHeight: 0, overflow: isMobile ? 'auto' : undefined }}>
      <Watchlist />
      <main style={{ flex: 1, minWidth: 0, overflowY: isMobile ? undefined : 'auto', padding: isMobile ? '14px 14px' : 'var(--mpad,22px 26px)', display: 'flex', flexDirection: 'column', gap: 'var(--gap,16px)' }}>
        <StockHeader />
        <PulseWhy />
        <ChartControls />
        <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 16, padding: 8, flex: '0 0 auto' }}>
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
