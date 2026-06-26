import { useEffect, useState, useRef } from 'react'
import { useStore } from '../state/store'
import { COLORS, FONT_MONO } from '../theme/tokens'
import { Logo } from '../components/Logo'
import { Treemap } from '../charts/Treemap'
import { cmoney, capStr, pct } from '../lib/format'

// Crypto view — ported from the prototype template (lines 932-1046): global
// stats (total cap, BTC dominance, live Fear & Greed), featured coin, Crypto Map
// treemap, and the coins table. Data from /api/crypto + /api/fng (CoinGecko +
// alternative.me).
export function Crypto() {
  const crypto = useStore((s) => s.crypto)
  const fng = useStore((s) => s.fng)
  const loadCrypto = useStore((s) => s.loadCrypto)
  const loadFng = useStore((s) => s.loadFng)
  const [mapW, setMapW] = useState(700)
  const mapRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => { loadCrypto(); loadFng() }, [loadCrypto, loadFng])

  useEffect(() => {
    const el = mapRef.current
    if (!el) return
    const update = () => { const w = Math.round(el.getBoundingClientRect().width); if (w) setMapW(w) }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [crypto])

  const coins = crypto?.coins || []
  const totalCap = crypto?.total_market_cap || 0
  const btcDom = crypto?.btc_dominance ?? 0
  const fgVal = fng?.value ?? 50
  const fgLabel = fng?.label ?? 'Neutral'
  const fgColor = fgVal < 45 ? COLORS.down : fgVal < 55 ? COLORS.warn : COLORS.up

  const statCard = (label: string, content: React.ReactNode, extra?: React.ReactNode) => (
    <div style={{ flex: '1 1 0', minWidth: 190, padding: '15px 17px', borderRadius: 14, background: COLORS.card, border: `1px solid ${COLORS.line}`, display: 'flex', flexDirection: 'column', gap: 9 }}>
      <span style={{ fontSize: '11px', color: COLORS.tx3, letterSpacing: '.04em' }}>{label}</span>
      {content}
      {extra}
    </div>
  )

  const treemapItems = coins.map((c) => ({ sym: c.symbol, value: c.market_cap || 1, chg: c.change_pct }))

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 'var(--mpad,22px 26px)', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', flex: '0 0 auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: '21px', fontWeight: 800, letterSpacing: '-.02em', color: COLORS.tx }}>Crypto</span>
          <span style={{ fontSize: '13px', color: COLORS.tx2 }}>Digital assets — tracked live around the clock</span>
        </div>
        <span style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 12px', borderRadius: 20, background: 'rgba(61,220,132,.1)' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: COLORS.up, animation: 'ttpulse 1.8s ease-in-out infinite' }} />
          <span style={{ fontSize: '11.5px', fontWeight: 600, color: COLORS.up }}>LIVE</span>
        </span>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', flex: '0 0 auto' }}>
        {statCard('TOTAL MARKET CAP', <span style={{ fontFamily: FONT_MONO, fontSize: '21px', fontWeight: 600, color: COLORS.tx }}>{capStr(totalCap)}</span>)}
        {statCard('COINS TRACKED', <span style={{ fontFamily: FONT_MONO, fontSize: '21px', fontWeight: 600, color: COLORS.tx }}>{coins.length}</span>)}
        {statCard('BTC DOMINANCE',
          <span style={{ fontFamily: FONT_MONO, fontSize: '21px', fontWeight: 600, color: COLORS.tx }}>{btcDom.toFixed(1)}%</span>,
          <div style={{ height: 6, borderRadius: 3, background: COLORS.line, overflow: 'hidden' }}><div style={{ height: '100%', width: `${btcDom}%`, background: COLORS.accent }} /></div>
        )}
        {statCard('FEAR & GREED',
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 9 }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: '21px', fontWeight: 600, color: fgColor }}>{fgVal}</span>
            <span style={{ fontSize: '12px', fontWeight: 600, color: fgColor }}>{fgLabel}</span>
          </div>,
          <div style={{ position: 'relative', height: 6, borderRadius: 3, background: 'linear-gradient(90deg,#ff5d73,#ffb347,#3ddc84)' }}>
            <div style={{ position: 'absolute', top: -3, bottom: -3, left: `${fgVal}%`, width: 2, background: '#fff' }} />
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 'var(--gap,16px)', alignItems: 'stretch', flexWrap: 'wrap', flex: '0 0 auto' }}>
        <div style={{ flex: '2 1 460px', minWidth: 320, display: 'flex', flexDirection: 'column', gap: 'var(--gap,16px)' }}>
          <div style={{ background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: 16, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: COLORS.tx }}>Crypto Map · 1-Day %</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '10.5px', color: COLORS.tx3, fontFamily: FONT_MONO }}>−3%</span>
                <div style={{ width: 120, height: 8, borderRadius: 4, background: 'linear-gradient(90deg,#d63a3a,#3a3e46,#22ac60)' }} />
                <span style={{ fontSize: '10.5px', color: COLORS.tx3, fontFamily: FONT_MONO }}>+3%</span>
              </div>
            </div>
            <div ref={mapRef} style={{ position: 'relative', width: '100%', height: 320, background: COLORS.bg, borderRadius: 6, overflow: 'hidden' }}>
              {treemapItems.length > 0 && <Treemap items={treemapItems} width={mapW} height={320} />}
            </div>
            <span style={{ fontSize: '11px', color: COLORS.tx3 }}>Tile size = market cap · color = daily change</span>
          </div>

          <div style={{ background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <div style={{ minWidth: 640 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(150px,1.4fr) 130px 92px 130px 130px', background: COLORS.panel, borderBottom: `1px solid ${COLORS.line}` }}>
                  {['COIN', 'PRICE', '24H', 'MKT CAP', 'DOMINANCE'].map((h) => <div key={h} style={{ padding: '12px 14px', fontSize: '11px', fontWeight: 600, letterSpacing: '.04em', color: COLORS.tx3 }}>{h}</div>)}
                </div>
                {coins.map((c) => {
                  const up = c.change_pct >= 0
                  return (
                    <div key={c.symbol} style={{ display: 'grid', gridTemplateColumns: 'minmax(150px,1.4fr) 130px 92px 130px 130px', alignItems: 'center', borderTop: `1px solid ${COLORS.line}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '13px 14px', minWidth: 0 }}>
                        <Logo symbol={c.symbol} size={28} kind="crypto" />
                        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                          <span style={{ fontWeight: 700, fontSize: '13.5px', color: COLORS.tx }}>{c.symbol}</span>
                          <span style={{ fontSize: '11px', color: COLORS.tx3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                        </div>
                      </div>
                      <div style={{ padding: '13px 14px', fontFamily: FONT_MONO, fontSize: '13.5px', fontWeight: 500, color: COLORS.tx }}>{cmoney(c.price)}</div>
                      <div style={{ padding: '13px 14px' }}><span style={{ fontFamily: FONT_MONO, fontSize: '11.5px', fontWeight: 600, padding: '2px 7px', borderRadius: 6, background: up ? 'rgba(61,220,132,.12)' : 'rgba(255,93,115,.12)', color: up ? COLORS.up : COLORS.down }}>{pct(c.change_pct)}</span></div>
                      <div style={{ padding: '13px 14px', fontFamily: FONT_MONO, fontSize: '12.5px', color: COLORS.tx2 }}>{capStr(c.market_cap)}</div>
                      <div style={{ padding: '13px 14px', fontFamily: FONT_MONO, fontSize: '12.5px', color: COLORS.tx2 }}>{totalCap ? ((c.market_cap / totalCap) * 100).toFixed(1) + '%' : '—'}</div>
                    </div>
                  )
                })}
                {coins.length === 0 && <div style={{ padding: 24, color: COLORS.tx3, fontSize: 12 }}>Loading coins…</div>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
