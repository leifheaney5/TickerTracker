import { useEffect } from 'react'
import { useStore } from '../state/store'
import { COLORS } from '../theme/tokens'
import { Watchlist } from '../components/Watchlist'
import { MoversRibbon } from '../components/MoversRibbon'
import { StockHeader } from '../components/StockHeader'
import { ChartControls } from '../components/ChartControls'
import { StockChart } from '../charts/StockChart'

// Dashboard view — the hero. Sidebar watchlist + main research column.
// Main column (stock header, chart, stats, news, due-diligence) lands in the
// next units; this composes the sidebar and loads data for the selected symbol.
export function Dashboard() {
  const selected = useStore((s) => s.selected)
  const timeframe = useStore((s) => s.timeframe)
  const loadHistory = useStore((s) => s.loadHistory)
  const loadFundamentals = useStore((s) => s.loadFundamentals)

  useEffect(() => {
    loadHistory(selected, timeframe)
    loadFundamentals(selected)
  }, [selected, timeframe, loadHistory, loadFundamentals])

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
        <div style={{ color: COLORS.tx3, fontSize: 12 }}>Key stats, news & due-diligence coming next.</div>
      </main>
    </div>
  )
}
