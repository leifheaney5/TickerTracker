import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { SharedWatchlistResponse } from '../api/types'
import type { QuotesResponse } from '../api/types'
import { FONT_SANS, FONT_MONO } from '../theme/tokens'
import { Logo } from '../components/Logo'
import { money, pct } from '../lib/format'
import { UNIVERSE } from '../data/universe'

// Read-only public view of a shared watchlist, reached via /s/<token>.
export function SharedWatchlist({ token }: { token: string }) {
  const [data, setData] = useState<SharedWatchlistResponse | null>(null)
  const [quotes, setQuotes] = useState<QuotesResponse['quotes']>({})
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    api.getShared(token)
      .then(async (res) => {
        if (cancelled) return
        setData(res.data)
        const syms = res.data.items.map((i) => i.symbol)
        if (syms.length > 0) {
          try {
            const qres = await api.quotes(syms)
            if (!cancelled) setQuotes(qres.data.quotes)
          } catch {
            // quotes failure is non-fatal; show symbols without prices
          }
        }
      })
      .catch(() => {
        if (!cancelled) setError('Watchlist not found or link has expired.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [token])

  const containerStyle: React.CSSProperties = {
    minHeight: '100vh',
    background: 'var(--bg)',
    fontFamily: FONT_SANS,
    color: 'var(--tx)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '40px 20px',
  }

  if (loading) {
    return (
      <div style={containerStyle}>
        <span style={{ color: 'var(--tx3)', fontSize: '14px' }}>Loading…</span>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div style={containerStyle}>
        <span style={{ color: 'var(--down)', fontSize: '14px' }}>{error ?? 'Something went wrong.'}</span>
      </div>
    )
  }

  return (
    <div style={containerStyle}>
      <div style={{ width: '100%', maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Header */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-.02em' }}>
              {data.owner_name}'s Watchlist
            </span>
            <span style={{
              fontSize: '11px', fontWeight: 600, letterSpacing: '.04em',
              color: 'var(--tx3)', background: 'var(--panel)',
              border: '1px solid var(--line)', borderRadius: 6,
              padding: '3px 8px',
            }}>
              READ-ONLY
            </span>
          </div>
          <span style={{ fontSize: '13px', color: 'var(--tx3)' }}>
            {data.items.length} ticker{data.items.length === 1 ? '' : 's'} · shared via Ticker Tracker
          </span>
        </div>

        {/* Ticker list */}
        <div style={{
          background: 'var(--card)',
          border: '1px solid var(--line)',
          borderRadius: 16,
          overflow: 'hidden',
        }}>
          {/* Column headers */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(160px,1.6fr) 110px 90px',
            background: 'var(--panel)',
            borderBottom: '1px solid var(--line)',
          }}>
            {['TICKER', 'PRICE', '24H'].map((h, i) => (
              <div key={i} style={{ padding: '12px 14px', fontSize: '11px', fontWeight: 600, letterSpacing: '.04em', color: 'var(--tx3)' }}>{h}</div>
            ))}
          </div>

          {data.items.length === 0 && (
            <div style={{ padding: '40px 18px', textAlign: 'center', color: 'var(--tx3)', fontSize: '13px' }}>
              This watchlist is empty.
            </div>
          )}

          {data.items.map((item) => {
            const u = UNIVERSE[item.symbol] || ({ name: item.symbol } as typeof UNIVERSE[string])
            const q = quotes[item.symbol]
            const changePct = q?.change_pct ?? 0
            const up = changePct >= 0
            return (
              <div
                key={item.symbol}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(160px,1.6fr) 110px 90px',
                  alignItems: 'center',
                  borderTop: '1px solid var(--line)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '12px 14px', minWidth: 0 }}>
                  <Logo symbol={item.symbol} size={28} />
                  <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <span style={{ fontWeight: 700, fontSize: '13.5px', color: 'var(--tx)' }}>{item.symbol}</span>
                    <span style={{ fontSize: '11px', color: 'var(--tx3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</span>
                  </div>
                </div>
                <div style={{ padding: '12px 14px', fontFamily: FONT_MONO, fontSize: '13px', color: 'var(--tx)' }}>
                  {q ? money(q.price) : '—'}
                </div>
                <div style={{ padding: '12px 14px', fontFamily: FONT_MONO, fontSize: '12px', fontWeight: 600, color: q ? (up ? 'var(--up)' : 'var(--down)') : 'var(--tx3)' }}>
                  {q ? pct(changePct) : '—'}
                </div>
              </div>
            )
          })}
        </div>

        <span style={{ fontSize: '12px', color: 'var(--tx3)', textAlign: 'center' }}>
          Powered by{' '}
          <a href="/" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>Ticker Tracker</a>
        </span>
      </div>
    </div>
  )
}
