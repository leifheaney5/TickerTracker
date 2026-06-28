import { forwardRef } from 'react'
import { Logo } from './Logo'
import { money, pct } from '../lib/format'
import { UNIVERSE } from '../data/universe'
import { FONT_SANS, FONT_MONO } from '../theme/tokens'
import type { WatchlistWithItems } from '../api/types'

interface Props {
  list: WatchlistWithItems
  qrDataUrl: string
  quote: (sym: string) => { price: number; pct: number }
}

export const ShareCard = forwardRef<HTMLDivElement, Props>(function ShareCard({ list, qrDataUrl, quote }, ref) {
  const items = list.items.filter((i) => !i.locked).slice(0, 18)
  return (
    <div ref={ref} style={{ position: 'fixed', left: -99999, top: 0, width: 1080, height: 1350, background: 'linear-gradient(160deg,#0b1220,#101a2e)', color: '#fff', fontFamily: FONT_SANS, padding: 64, boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
        <Logo symbol="NVDA" size={56} />
        <span style={{ fontSize: 40, fontWeight: 900, letterSpacing: '-.02em' }}>Ticker Tracker</span>
      </div>
      <span style={{ fontSize: 56, fontWeight: 800, marginBottom: 6 }}>{list.name}</span>
      <span style={{ fontSize: 22, opacity: .7, marginBottom: 28 }}>{items.length} tickers</span>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map((it) => {
          const q = quote(it.symbol)
          const up = q.pct >= 0
          return (
            <div key={it.symbol} style={{ display: 'flex', alignItems: 'center', gap: 18, background: 'rgba(255,255,255,.05)', borderRadius: 16, padding: '14px 22px' }}>
              <Logo symbol={it.symbol} size={40} />
              <span style={{ fontSize: 30, fontWeight: 800, width: 150 }}>{it.symbol}</span>
              <span style={{ flex: 1, fontSize: 22, opacity: .65, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{UNIVERSE[it.symbol]?.name || ''}</span>
              <span style={{ fontFamily: FONT_MONO, fontSize: 28 }}>{money(q.price)}</span>
              <span style={{ fontFamily: FONT_MONO, fontSize: 24, width: 120, textAlign: 'right', color: up ? '#3ddc97' : '#ff6b6b' }}>{pct(q.pct)}</span>
            </div>
          )
        })}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginTop: 24 }}>
        {qrDataUrl && <img src={qrDataUrl} width={120} height={120} alt="" style={{ borderRadius: 12, background: '#fff', padding: 8 }} />}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 26, fontWeight: 800 }}>Made with TickerTracker · tickertracker.info</span>
          <span style={{ fontSize: 20, opacity: .6 }}>Scan to view this watchlist live</span>
        </div>
      </div>
    </div>
  )
})
