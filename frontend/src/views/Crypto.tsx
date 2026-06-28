import { useEffect, useState, useRef } from 'react'
import { useStore } from '../state/store'
import { FONT_MONO } from '../theme/tokens'
import { Logo } from '../components/Logo'
import { Treemap } from '../charts/Treemap'
import { cmoney, capStr, pct } from '../lib/format'
import type { Coin, CryptoSearchResult } from '../api/types'
import { api } from '../api/client'

// Crypto view — ported from the prototype template (lines 932-1046): global
// stats (total cap, BTC dominance, live Fear & Greed), featured coin, Crypto Map
// treemap, and the coins table. Data from /api/crypto + /api/fng (CoinGecko +
// alternative.me).
export function Crypto() {
  const crypto = useStore((s) => s.crypto)
  const fng = useStore((s) => s.fng)
  const loadCrypto = useStore((s) => s.loadCrypto)
  const loadFng = useStore((s) => s.loadFng)
  const cryptoLimit = useStore((s) => s.cryptoLimit)
  const setCryptoLimit = useStore((s) => s.setCryptoLimit)
  const watch = useStore((s) => s.cryptoWatchIds)()
  const addCryptoWatch = useStore((s) => s.addCryptoWatch)
  const removeCryptoWatch = useStore((s) => s.removeCryptoWatch)
  const currentUser = useStore((s) => s.currentUser)
  const openAuth = useStore((s) => s.openAuth)
  const [mapW, setMapW] = useState(700)
  const mapRef = useRef<HTMLDivElement | null>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CryptoSearchResult[]>([])

  useEffect(() => { loadCrypto(); loadFng() }, [loadCrypto, loadFng])

  // Debounced coin search (300ms); only query for 2+ chars.
  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) { setResults([]); return }
    const t = setTimeout(async () => {
      try { const { data } = await api.cryptoSearch(q); setResults(data) }
      catch { setResults([]) }
    }, 300)
    return () => clearTimeout(t)
  }, [query])

  function toggleStar(c: Coin) {
    if (!currentUser) { openAuth('login'); return }
    if (watch.includes(c.id)) removeCryptoWatch(c.id)
    else addCryptoWatch({ id: c.id, symbol: c.symbol, name: c.name })
  }

  function pickResult(r: CryptoSearchResult) {
    if (!currentUser) { openAuth('login'); return }
    addCryptoWatch({ id: r.id, symbol: r.symbol, name: r.name })
    setQuery('')
    setResults([])
  }

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
  const fgColor = fgVal < 45 ? 'var(--down)' : fgVal < 55 ? 'var(--warn)' : 'var(--up)'

  const statCard = (label: string, content: React.ReactNode, extra?: React.ReactNode) => (
    <div style={{ flex: '1 1 0', minWidth: 190, padding: '15px 17px', borderRadius: 14, background: 'var(--card)', border: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 9 }}>
      <span style={{ fontSize: '11px', color: 'var(--tx3)', letterSpacing: '.04em' }}>{label}</span>
      {content}
      {extra}
    </div>
  )

  const treemapItems = coins.map((c) => ({ sym: c.symbol, value: c.market_cap || 1, chg: c.change_pct }))
  const watchSet = new Set(watch)
  const watchedCoins = coins.filter((c) => watchSet.has(c.id))
  // Treemap tiles are keyed by symbol, watch ids are coin ids — map to symbols.
  const highlightSyms = new Set(watchedCoins.map((c) => c.symbol))
  const showMyCoins = !!currentUser || watch.length > 0

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 'var(--mpad,22px 26px)', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', flex: '0 0 auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: '21px', fontWeight: 800, letterSpacing: '-.02em', color: 'var(--tx)' }}>Crypto</span>
          <span style={{ fontSize: '13px', color: 'var(--tx2)' }}>Digital assets — tracked live around the clock</span>
        </div>
        <span style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 12px', borderRadius: 20, background: 'rgba(61,220,132,.1)' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--up)', animation: 'ttpulse 1.8s ease-in-out infinite' }} />
          <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--up)' }}>LIVE</span>
        </span>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', flex: '0 0 auto' }}>
        {statCard('TOTAL MARKET CAP', <span style={{ fontFamily: FONT_MONO, fontSize: '21px', fontWeight: 600, color: 'var(--tx)' }}>{capStr(totalCap)}</span>)}
        {statCard('COINS TRACKED', <span style={{ fontFamily: FONT_MONO, fontSize: '21px', fontWeight: 600, color: 'var(--tx)' }}>{cryptoLimit}</span>)}
        {statCard('BTC DOMINANCE',
          <span style={{ fontFamily: FONT_MONO, fontSize: '21px', fontWeight: 600, color: 'var(--tx)' }}>{btcDom.toFixed(1)}%</span>,
          <div style={{ height: 6, borderRadius: 3, background: 'var(--line)', overflow: 'hidden' }}><div style={{ height: '100%', width: `${btcDom}%`, background: 'var(--accent)' }} /></div>
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
          <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 16, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--tx)' }}>Crypto Map · 1-Day %</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: '10.5px', color: 'var(--tx3)', fontFamily: FONT_MONO }}>−3%</span>
                  <div style={{ width: 120, height: 8, borderRadius: 4, background: 'linear-gradient(90deg,#d63a3a,#3a3e46,#22ac60)' }} />
                  <span style={{ fontSize: '10.5px', color: 'var(--tx3)', fontFamily: FONT_MONO }}>+3%</span>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {[25, 50, 100].map((n) => (
                    <button key={n} onClick={() => setCryptoLimit(n as 25 | 50 | 100)}
                      style={{ padding: '3px 9px', borderRadius: 7, fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                        border: '1px solid var(--line)',
                        background: cryptoLimit === n ? 'var(--accent)' : 'transparent',
                        color: cryptoLimit === n ? '#fff' : 'var(--tx3)' }}>{n}</button>
                  ))}
                </div>
              </div>
            </div>
            <div ref={mapRef} style={{ position: 'relative', width: '100%', height: 320, background: 'var(--bg)', borderRadius: 6, overflow: 'hidden' }}>
              {treemapItems.length > 0 ? (
                <Treemap items={treemapItems} width={mapW} height={320} highlight={highlightSyms} />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--tx3)', fontSize: '13px' }}>
                  {crypto === null ? 'Loading…' : 'Crypto data unavailable right now.'}
                </div>
              )}
            </div>
            <span style={{ fontSize: '11px', color: 'var(--tx3)' }}>Tile size = market cap · color = daily change</span>
          </div>

          {showMyCoins && (
            <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 16, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--tx)' }}>My Coins</span>
              {watchedCoins.length === 0 ? (
                <span style={{ fontSize: '12.5px', color: 'var(--tx3)' }}>Star a coin below to start tracking.</span>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {watchedCoins.map((c) => {
                    const up = c.change_pct >= 0
                    return (
                      <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '8px 0' }}>
                        <button aria-label={`Watch ${c.name}`} onClick={() => toggleStar(c)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--warn)', lineHeight: 1 }}>★</button>
                        <Logo symbol={c.symbol} size={24} kind="crypto" />
                        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1, flex: 1 }}>
                          <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--tx)' }}>{c.symbol}</span>
                          <span style={{ fontSize: '11px', color: 'var(--tx3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                        </div>
                        <span style={{ fontFamily: FONT_MONO, fontSize: '13px', fontWeight: 500, color: 'var(--tx)' }}>{cmoney(c.price)}</span>
                        <span style={{ fontFamily: FONT_MONO, fontSize: '11.5px', fontWeight: 600, padding: '2px 7px', borderRadius: 6, background: up ? 'rgba(61,220,132,.12)' : 'rgba(255,93,115,.12)', color: up ? 'var(--up)' : 'var(--down)' }}>{pct(c.change_pct)}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          <div style={{ position: 'relative' }}>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="+ Add coin"
              style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: 12, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--tx)', fontSize: '13px', outline: 'none' }} />
            {results.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, zIndex: 20, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,.18)' }}>
                {results.map((r) => (
                  <button key={r.id} onClick={() => pickResult(r)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '10px 14px', background: 'none', border: 'none', borderTop: '1px solid var(--line)', cursor: 'pointer', color: 'var(--tx)' }}>
                    <span style={{ fontWeight: 700, fontSize: '13px' }}>{r.symbol.toUpperCase()}</span>
                    <span style={{ fontSize: '12px', color: 'var(--tx3)' }}>{r.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <div style={{ minWidth: 640 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '44px minmax(150px,1.4fr) 130px 92px 130px 130px', background: 'var(--panel)', borderBottom: '1px solid var(--line)' }}>
                  {['', 'COIN', 'PRICE', '24H', 'MKT CAP', 'DOMINANCE'].map((h, i) => <div key={h || `c${i}`} style={{ padding: '12px 14px', fontSize: '11px', fontWeight: 600, letterSpacing: '.04em', color: 'var(--tx3)' }}>{h}</div>)}
                </div>
                {coins.map((c) => {
                  const up = c.change_pct >= 0
                  const starred = watch.includes(c.id)
                  return (
                    <div key={c.symbol} style={{ display: 'grid', gridTemplateColumns: '44px minmax(150px,1.4fr) 130px 92px 130px 130px', alignItems: 'center', borderTop: '1px solid var(--line)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '13px 0' }}>
                        <button aria-label={`Watch ${c.name}`} onClick={() => toggleStar(c)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, lineHeight: 1, color: starred ? 'var(--warn)' : 'var(--tx3)' }}>
                          {starred ? '★' : '☆'}
                        </button>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '13px 14px', minWidth: 0 }}>
                        <Logo symbol={c.symbol} size={28} kind="crypto" />
                        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                          <span style={{ fontWeight: 700, fontSize: '13.5px', color: 'var(--tx)' }}>{c.symbol}</span>
                          <span style={{ fontSize: '11px', color: 'var(--tx3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                        </div>
                      </div>
                      <div style={{ padding: '13px 14px', fontFamily: FONT_MONO, fontSize: '13.5px', fontWeight: 500, color: 'var(--tx)' }}>{cmoney(c.price)}</div>
                      <div style={{ padding: '13px 14px' }}><span style={{ fontFamily: FONT_MONO, fontSize: '11.5px', fontWeight: 600, padding: '2px 7px', borderRadius: 6, background: up ? 'rgba(61,220,132,.12)' : 'rgba(255,93,115,.12)', color: up ? 'var(--up)' : 'var(--down)' }}>{pct(c.change_pct)}</span></div>
                      <div style={{ padding: '13px 14px', fontFamily: FONT_MONO, fontSize: '12.5px', color: 'var(--tx2)' }}>{capStr(c.market_cap)}</div>
                      <div style={{ padding: '13px 14px', fontFamily: FONT_MONO, fontSize: '12.5px', color: 'var(--tx2)' }}>{totalCap ? ((c.market_cap / totalCap) * 100).toFixed(1) + '%' : '—'}</div>
                    </div>
                  )
                })}
                {coins.length === 0 && (
                  <div style={{ padding: '36px 18px', textAlign: 'center', color: 'var(--tx3)', fontSize: '13px' }}>
                    {crypto === null ? 'Loading…' : 'Crypto data unavailable right now.'}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
