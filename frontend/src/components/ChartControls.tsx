import { useStore, type ChartType } from '../state/store'
import { FONT_SANS, FONT_MONO } from '../theme/tokens'
import type { Timeframe } from '../api/types'

// Chart controls — ported from the prototype template (lines 299-333): timeframe
// segmented control, chart-type toggle (hidden in compare mode), and the Compare
// dropdown (overlay up to 4 tickers normalized to %).

const TIMEFRAMES: Timeframe[] = ['1D', '5D', '1W', '1M', '3M', '1Y', '5Y', 'YTD', 'MAX']
const CHART_TYPES: { label: string; value: ChartType }[] = [
  { label: 'Candles', value: 'candles' }, { label: 'Line', value: 'line' }, { label: 'Area', value: 'area' },
]

export function ChartControls() {
  const timeframe = useStore((s) => s.timeframe)
  const setTimeframe = useStore((s) => s.setTimeframe)
  const chartType = useStore((s) => s.chartType)
  const setChartType = useStore((s) => s.setChartType)
  const compare = useStore((s) => s.compare)
  const toggleCompare = useStore((s) => s.toggleCompare)
  const openFinder = useStore((s) => s.openTickerFinder)
  const compareActive = compare.length > 0
  const tfStyle = (active: boolean): React.CSSProperties => ({ padding: '6px 13px', borderRadius: 8, border: 0, cursor: 'pointer', fontFamily: FONT_MONO, fontSize: 12, fontWeight: active ? 700 : 500, background: active ? 'var(--accent)' : 'transparent', color: active ? 'var(--accentInk)' : 'var(--tx2)' })
  const ctStyle = (active: boolean): React.CSSProperties => ({ padding: '6px 11px', borderRadius: 7, border: 0, cursor: 'pointer', fontFamily: FONT_SANS, fontSize: 12, fontWeight: active ? 600 : 500, background: active ? 'var(--cardHi)' : 'transparent', color: active ? 'var(--tx)' : 'var(--tx3)' })

  return <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
    <div style={{ display: 'flex', gap: 3, padding: 3, borderRadius: 11, background: 'var(--card)', border: '1px solid var(--line)' }}>{TIMEFRAMES.map((value) => <button key={value} onClick={() => setTimeframe(value)} style={tfStyle(value === timeframe)}>{value}</button>)}</div>
    <div style={{ display: 'flex', gap: 9, alignItems: 'center', flexWrap: 'wrap' }}>
      {!compareActive && <div style={{ display: 'flex', gap: 3, padding: 3, borderRadius: 10, background: 'var(--card)', border: '1px solid var(--line)' }}>{CHART_TYPES.map((item) => <button key={item.value} onClick={() => setChartType(item.value)} style={ctStyle(item.value === chartType)}>{item.label}</button>)}</div>}
      {compareActive && <span style={{ fontSize: 11.5, color: 'var(--tx3)' }}>Normalized %</span>}
      {compare.map((symbol) => <button key={symbol} onClick={() => toggleCompare(symbol)} aria-label={`Remove ${symbol} comparison`} style={{ height: 34, padding: '0 11px', borderRadius: 9, border: '1px solid var(--accent)', background: 'rgba(61,220,132,.1)', color: 'var(--accent)', fontWeight: 700, cursor: 'pointer' }}>{symbol} ×</button>)}
      <button onClick={() => openFinder({ kind: 'compare' })} style={{ minHeight: 40, padding: '0 18px', borderRadius: 11, border: '1px solid var(--accent)', background: 'var(--accent)', color: 'var(--accentInk)', fontFamily: FONT_SANS, fontWeight: 800, fontSize: 13, cursor: 'pointer', boxShadow: '0 5px 18px rgba(61,220,132,.24)' }}>＋ Compare stocks</button>
    </div>
  </div>
}
