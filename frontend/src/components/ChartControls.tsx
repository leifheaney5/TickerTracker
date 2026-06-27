import { useState } from 'react'
import { useStore, type ChartType, isAuthed } from '../state/store'
import { COLORS, FONT_SANS, FONT_MONO } from '../theme/tokens'
import { UNIVERSE } from '../data/universe'
import type { Timeframe } from '../api/types'

// Chart controls — ported from the prototype template (lines 299-333): timeframe
// segmented control, chart-type toggle (hidden in compare mode), and the Compare
// dropdown (overlay up to 4 tickers normalized to %).

const TIMEFRAMES: Timeframe[] = ['1D', '1W', '1M', '3M', '1Y', '5Y']
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
  const selected = useStore((s) => s.selected)
  const watchSymbols = useStore((s) => s.watchSymbols)
  const openAuth = useStore((s) => s.openAuth)
  const authed = useStore(isAuthed)
  const [menuOpen, setMenuOpen] = useState(false)

  const compareActive = compare.length > 0

  const tfStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 13px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: FONT_MONO,
    fontSize: '12px', fontWeight: active ? 700 : 500,
    background: active ? COLORS.accent : 'transparent', color: active ? COLORS.accentInk : COLORS.tx2,
  })
  const ctStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 11px', borderRadius: 7, border: 'none', cursor: 'pointer', fontFamily: FONT_SANS,
    fontSize: '12px', fontWeight: active ? 600 : 500,
    background: active ? COLORS.cardHi : 'transparent', color: active ? COLORS.tx : COLORS.tx3,
  })

  // candidates: watchlist symbols not already selected/compared.
  const candidates = watchSymbols().filter((s) => s !== selected && !compare.includes(s)).slice(0, 12)

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, flexWrap: 'wrap', flex: '0 0 auto' }}>
      <div style={{ display: 'flex', gap: 3, padding: 3, borderRadius: 11, background: COLORS.card, border: `1px solid ${COLORS.line}` }}>
        {TIMEFRAMES.map((t) => (
          <button key={t} onClick={() => setTimeframe(t)} style={tfStyle(t === timeframe)}>{t}</button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        {compareActive && <span style={{ fontSize: '11.5px', color: COLORS.tx3, padding: '0 4px' }}>Normalized&nbsp;%</span>}
        {!compareActive && (
          <div style={{ display: 'flex', gap: 3, padding: 3, borderRadius: 10, background: COLORS.card, border: `1px solid ${COLORS.line}` }}>
            {CHART_TYPES.map((ct) => (
              <button key={ct.value} onClick={() => setChartType(ct.value)} style={ctStyle(ct.value === chartType)}>{ct.label}</button>
            ))}
          </div>
        )}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 10, cursor: 'pointer',
              fontFamily: FONT_SANS, fontWeight: 600, fontSize: '12px',
              border: `1px solid ${compareActive ? COLORS.accent : COLORS.line}`,
              background: compareActive ? 'rgba(61,220,132,.1)' : COLORS.card,
              color: compareActive ? COLORS.accent : COLORS.tx2,
            }}
          >
            ⊕ Compare{compareActive ? ` (${compare.length})` : ''}
          </button>
          {menuOpen && (
            <div style={{ position: 'absolute', top: 42, right: 0, width: 200, maxHeight: 280, overflowY: 'auto', background: COLORS.panel, border: `1px solid ${COLORS.line2}`, borderRadius: 12, boxShadow: '0 18px 50px rgba(0,0,0,.55)', zIndex: 25, padding: 5 }}>
              {compare.map((s) => (
                <div key={'sel' + s} onClick={() => toggleCompare(s)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 11px', borderRadius: 8, cursor: 'pointer' }}>
                  <span style={{ fontSize: '12.5px', fontWeight: 600, color: COLORS.tx }}>{s}</span>
                  <span style={{ fontSize: '11px', color: COLORS.accent }}>✓ remove</span>
                </div>
              ))}
              {candidates.map((s) => (
                <div key={s} onClick={() => { toggleCompare(s); }} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 11px', borderRadius: 8, cursor: 'pointer' }}>
                  <span style={{ fontSize: '12.5px', fontWeight: 600, color: COLORS.tx }}>{s}</span>
                  <span style={{ fontSize: '11px', color: COLORS.tx3 }}>{UNIVERSE[s]?.name ? '+ add' : '+ add'}</span>
                </div>
              ))}
              {candidates.length === 0 && compare.length === 0 && (
                authed
                  ? <div style={{ padding: '14px 11px', fontSize: '12.5px', color: COLORS.tx3, textAlign: 'center' }}>Add tickers with the ⊕ Compare button on any chart to compare them here.</div>
                  : <div style={{ padding: '12px 11px', textAlign: 'center' }}>
                      <button onClick={() => openAuth('signup')} style={{ height: 40, padding: '0 20px', borderRadius: 11, border: 'none', background: COLORS.accent, color: COLORS.accentInk, fontFamily: FONT_SANS, fontSize: '13.5px', fontWeight: 700, cursor: 'pointer' }}>Sign in to compare tickers</button>
                    </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
