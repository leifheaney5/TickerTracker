import { useEffect, useRef, useState } from 'react'
import { useStore } from '../state/store'
import { FONT_SANS, FONT_MONO, IDX_COLORS } from '../theme/tokens'
import { SECTORS, IDX, HM, hmChange, sectorPerf } from '../data/market'
import { Treemap, heatColor, type TreemapItem } from '../charts/Treemap'
import { api } from '../api/client'
import { asOf } from '../lib/format'

// Market / Map / Sectors — ported from the prototype templates (lines 753-779,
// 783+, 719-750). A shared Overview/Map/Sectors sub-nav. Index + sector data is
// the prototype's synthetic set (no dedicated real-data endpoint, per spec).

type Sub = 'market' | 'map' | 'sectors'
const SUB_TABS: { label: string; view: Sub }[] = [
  { label: 'Overview', view: 'market' }, { label: 'Map', view: 'map' }, { label: 'Sectors', view: 'sectors' },
]
const SEC_TFS = ['1D', '1W', '1M', '3M', 'YTD', '1Y']

export function MarketViews({ sub }: { sub: Sub }) {
  const setView = useStore((s) => s.setView)
  const fng = useStore((s) => s.fng)
  const loadFng = useStore((s) => s.loadFng)
  const [secTf, setSecTf] = useState('1M')
  const [mapW, setMapW] = useState(800)
  const mapRef = useRef<HTMLDivElement | null>(null)
  const [fngFetchedAt, setFngFetchedAt] = useState('')

  useEffect(() => {
    loadFng()
    api.fng().then((r) => setFngFetchedAt(r.fetchedAt)).catch(() => {})
  }, [loadFng])
  useEffect(() => {
    const el = mapRef.current
    if (!el) return
    const update = () => { const w = Math.round(el.getBoundingClientRect().width); if (w) setMapW(w) }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [sub])

  const subStyle = (active: boolean): React.CSSProperties => ({
    padding: '7px 13px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: FONT_SANS, fontSize: '12.5px',
    fontWeight: active ? 700 : 500, background: active ? 'var(--cardHi)' : 'transparent', color: active ? 'var(--tx)' : 'var(--tx3)',
  })

  const header = (title: string, sub2: string) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: '21px', fontWeight: 800, letterSpacing: '-.02em', color: 'var(--tx)' }}>{title}</span>
      <span style={{ fontSize: '13px', color: 'var(--tx2)' }}>{sub2}</span>
      <div style={{ display: 'flex', gap: 3, padding: 3, borderRadius: 10, background: 'var(--bg)', alignSelf: 'flex-start', marginTop: 8 }}>
        {SUB_TABS.map((t) => <button key={t.view} onClick={() => setView(t.view)} style={subStyle(t.view === sub)}>{t.label}</button>)}
      </div>
    </div>
  )

  // Map: all heatmap symbols as one treemap.
  const mapItems: TreemapItem[] = Object.values(HM).flat().map(([sym, cap]) => ({ sym, value: cap, chg: hmChange(sym) }))

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 'var(--mpad,22px 26px)', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {sub === 'market' && (
        <>
          {header('Market Overview', 'How the broad market is trading right now')}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', flex: '0 0 auto' }}>
            {Object.entries(IDX).map(([key, ix]) => (
              <div key={key} style={{ flex: '1 1 0', minWidth: 170, padding: '15px 17px', borderRadius: 14, background: 'var(--card)', border: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: '11px', color: 'var(--tx3)', letterSpacing: '.04em' }}>{ix.name.toUpperCase()}</span>
                <span style={{ fontFamily: FONT_MONO, fontSize: '20px', fontWeight: 600, color: 'var(--tx)' }}>{ix.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                <span style={{ fontFamily: FONT_MONO, fontSize: '12px', fontWeight: 600, color: ix.chg >= 0 ? 'var(--up)' : 'var(--down)' }}>{(ix.chg >= 0 ? '+' : '') + ix.chg.toFixed(2)}%</span>
                <div style={{ height: 3, borderRadius: 2, background: IDX_COLORS[key as keyof typeof IDX_COLORS], opacity: 0.5 }} />
              </div>
            ))}
          </div>
          <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 16, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14, flex: '0 0 auto' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--tx)' }}>Sector performance · today</span>
            {SECTORS.map((s) => {
              const w = Math.min(100, Math.abs(s.chg) * 40)
              return (
                <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ width: 148, flex: '0 0 auto', fontSize: '12.5px', color: 'var(--tx)', textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</span>
                  <div style={{ flex: 1, height: 15, borderRadius: 4, background: 'var(--line)', overflow: 'hidden' }}><div style={{ height: '100%', width: `${w}%`, background: s.chg >= 0 ? 'var(--up)' : 'var(--down)' }} /></div>
                  <span style={{ width: 62, flex: '0 0 auto', fontFamily: FONT_MONO, fontSize: '12.5px', fontWeight: 600, color: s.chg >= 0 ? 'var(--up)' : 'var(--down)' }}>{(s.chg >= 0 ? '+' : '') + s.chg.toFixed(2)}%</span>
                </div>
              )
            })}
            {fng && <span style={{ fontSize: 11.5, color: 'var(--tx3)' }}>Crypto Fear &amp; Greed: {fng.value} · {fng.label}{fngFetchedAt ? ' · ' + asOf(fngFetchedAt) : ''}</span>}
          </div>
        </>
      )}

      {sub === 'map' && (
        <>
          {header('Market Map', 'The whole market at a glance — sized by market cap, colored by daily move')}
          <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 16, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12, flex: '0 0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--tx)' }}>All sectors</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '10.5px', color: 'var(--tx3)', fontFamily: FONT_MONO }}>−3%</span>
                <div style={{ width: 124, height: 8, borderRadius: 4, background: 'linear-gradient(90deg,#d63a3a,#3a3e46,#22ac60)' }} />
                <span style={{ fontSize: '10.5px', color: 'var(--tx3)', fontFamily: FONT_MONO }}>+3%</span>
              </div>
            </div>
            <div ref={mapRef} style={{ position: 'relative', width: '100%', height: 460, background: 'var(--bg)', borderRadius: 6, overflow: 'hidden' }}>
              <Treemap items={mapItems} width={mapW} height={460} />
            </div>
            <span style={{ fontSize: '11px', color: 'var(--tx3)' }}>Tile size = market cap · color = daily change</span>
          </div>
        </>
      )}

      {sub === 'sectors' && (
        <>
          {header('Sector Performance', 'How every sector is performing across timeframes — green is up, red is down')}
          <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 16, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12, flex: '0 0 auto' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--tx)' }}>Performance Matrix · % change</span>
            <div style={{ overflowX: 'auto' }}>
              <div style={{ minWidth: 640 }}>
                <div style={{ display: 'grid', gridTemplateColumns: `minmax(150px,1.4fr) repeat(${SEC_TFS.length}, 1fr)`, gap: 4 }}>
                  <div />
                  {SEC_TFS.map((t) => <div key={t} style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'var(--tx3)', padding: '4px 0' }}>{t}</div>)}
                  {SECTORS.map((s) => (
                    <div key={s.name} style={{ display: 'contents' }}>
                      <div style={{ fontSize: 12.5, color: 'var(--tx)', padding: '6px 8px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</div>
                      {SEC_TFS.map((t) => {
                        const v = sectorPerf(s.name, t)
                        return <div key={t} style={{ background: heatColor(v), borderRadius: 5, textAlign: 'center', padding: '8px 0', fontFamily: FONT_MONO, fontSize: 11.5, fontWeight: 600, color: '#fff' }}>{(v >= 0 ? '+' : '') + v.toFixed(1)}</div>
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 16, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14, flex: '0 0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--tx)' }}>Ranked · {secTf} performance</span>
              <div style={{ display: 'flex', gap: 3, padding: 3, borderRadius: 10, background: 'var(--bg)' }}>
                {SEC_TFS.map((t) => <button key={t} onClick={() => setSecTf(t)} style={subStyle(t === secTf)}>{t}</button>)}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {SECTORS.map((s) => ({ name: s.name, v: sectorPerf(s.name, secTf) })).sort((a, b) => b.v - a.v).map((s) => {
                const w = Math.min(100, Math.abs(s.v) * 12)
                return (
                  <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '5px 0' }}>
                    <span style={{ width: 148, flex: '0 0 auto', fontSize: '12.5px', color: 'var(--tx)', textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</span>
                    <div style={{ flex: 1, height: 15, borderRadius: 4, background: 'var(--line)', overflow: 'hidden' }}><div style={{ height: '100%', width: `${w}%`, background: s.v >= 0 ? 'var(--up)' : 'var(--down)' }} /></div>
                    <span style={{ width: 62, flex: '0 0 auto', fontFamily: FONT_MONO, fontSize: '12.5px', fontWeight: 600, color: s.v >= 0 ? 'var(--up)' : 'var(--down)' }}>{(s.v >= 0 ? '+' : '') + s.v.toFixed(1)}%</span>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
