import type { WatchlistItem } from '../api/types'
import { UNIVERSE } from '../data/universe'
import { hashStr } from '../lib/hash'
import { money, pct } from '../lib/format'
import { FONT_SANS, FONT_MONO } from '../theme/tokens'

// Fixed palette — the shared PNG must look identical regardless of the user's
// active light/dark theme, so we do NOT use var(--…) tokens here.
const C = {
  bg: '#0b0e14',
  card: '#11151d',
  line: '#1f2630',
  tx: '#e8edf4',
  tx2: '#9aa6b6',
  tx3: '#6b7686',
  up: '#2ecc71',
  down: '#ff5e6c',
  accent: '#4f8cff',
}

// Self-contained monogram (no network image) so the card rasterizes to PNG
// deterministically — cross-origin logo CDNs can't be read by html-to-image.
function Monogram({ symbol }: { symbol: string }) {
  const hue = hashStr(symbol) % 360
  return (
    <div style={{ width: 28, height: 28, borderRadius: 7, flex: '0 0 auto', background: `hsl(${hue},30%,20%)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontFamily: FONT_SANS, fontWeight: 700, fontSize: 10, color: `hsl(${hue},55%,70%)`, letterSpacing: '-.02em' }}>{symbol.slice(0, 2)}</span>
    </div>
  )
}

export type ShareCardProps = {
  items: WatchlistItem[]
  price: (sym: string) => number
  chg: (sym: string) => number
  date?: Date
}

export function ShareCard({ items, price, chg, date = new Date() }: ShareCardProps) {
  const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return (
    <div style={{ width: 640, background: C.bg, padding: 28, fontFamily: FONT_SANS, color: C.tx, boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#fff', fontSize: 16 }}>T</div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-.02em' }}>Ticker Tracker</span>
          <span style={{ fontSize: 12, color: C.tx2 }}>My Watchlist · {dateStr}</span>
        </div>
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, overflow: 'hidden' }}>
        {items.map((w, i) => {
          const c = chg(w.symbol)
          const up = c >= 0
          const name = UNIVERSE[w.symbol]?.name ?? w.symbol
          return (
            <div key={w.symbol} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 90px', alignItems: 'center', padding: '12px 16px', borderTop: i === 0 ? 'none' : `1px solid ${C.line}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
                <Monogram symbol={w.symbol} />
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{w.symbol}</span>
                  <span style={{ fontSize: 11, color: C.tx3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                </div>
              </div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 13, textAlign: 'right', color: C.tx }}>{money(price(w.symbol))}</div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 600, textAlign: 'right', color: up ? C.up : C.down }}>{pct(c)}</div>
            </div>
          )
        })}
      </div>

      <div style={{ marginTop: 14, fontSize: 11, color: C.tx3, textAlign: 'center' }}>
        {items.length} ticker{items.length === 1 ? '' : 's'} · tickertracker.info
      </div>
    </div>
  )
}
