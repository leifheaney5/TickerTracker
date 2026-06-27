import { useEffect, useState } from 'react'
import { useStore } from '../state/store'
import { api } from '../api/client'
import type { EarningsRow } from '../api/types'
import { COLORS, FONT_SANS, FONT_MONO } from '../theme/tokens'
import { Logo } from '../components/Logo'

// Earnings Calendar — shows upcoming earnings for the user's watchlist symbols
// (next 30 days, sourced from Finnhub, cached 6h on the backend).

function hourLabel(hour: string): string {
  if (hour === 'bmo') return 'Before open'
  if (hour === 'amc') return 'After close'
  return '—'
}

export function Earnings() {
  const watchSymbols = useStore((s) => s.watchSymbols)
  const [rows, setRows] = useState<EarningsRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api.earnings(watchSymbols())
      .then(({ data }) => {
        if (!cancelled) {
          const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date))
          setRows(sorted)
        }
      })
      .catch(() => { if (!cancelled) setRows([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  return (
    <div
      style={{
        flex: 1, overflow: 'auto', padding: 'var(--mpad,22px 26px)',
        display: 'flex', flexDirection: 'column', gap: 18,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '0 0 auto' }}>
        <span style={{ fontSize: '21px', fontWeight: 800, letterSpacing: '-.02em', color: COLORS.tx }}>
          Earnings Calendar
        </span>
        <span style={{ fontSize: '13px', color: COLORS.tx2 }}>
          Upcoming earnings reports for your watchlist — next 30 days
        </span>
      </div>

      {/* Table */}
      <div
        style={{
          border: `1px solid ${COLORS.line}`, borderRadius: 16,
          overflow: 'hidden', background: COLORS.card, flex: '0 0 auto',
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 560 }}>
            {/* Column headers */}
            <div
              style={{
                display: 'grid', gridTemplateColumns: '140px 1fr 160px 140px',
                background: COLORS.panel, borderBottom: `1px solid ${COLORS.line}`,
              }}
            >
              {['Date', 'Symbol', 'Time', 'EPS Est.'].map((h) => (
                <div
                  key={h}
                  style={{
                    padding: '12px 14px', fontSize: '11px', fontWeight: 600,
                    letterSpacing: '.04em', color: COLORS.tx3,
                  }}
                >
                  {h}
                </div>
              ))}
            </div>

            {/* Loading state */}
            {loading && (
              <div style={{ padding: '28px 18px', fontSize: '13px', color: COLORS.tx3, fontFamily: FONT_SANS }}>
                Loading…
              </div>
            )}

            {/* Empty state */}
            {!loading && rows.length === 0 && (
              <div style={{ padding: '36px 18px', textAlign: 'center', color: COLORS.tx3, fontFamily: FONT_SANS, fontSize: '13.5px' }}>
                No upcoming earnings in the next 30 days
              </div>
            )}

            {/* Rows */}
            {!loading && rows.map((row) => (
              <div
                key={`${row.symbol}:${row.date}`}
                style={{
                  display: 'grid', gridTemplateColumns: '140px 1fr 160px 140px',
                  alignItems: 'center', borderTop: `1px solid ${COLORS.line}`,
                }}
              >
                {/* Date */}
                <div
                  style={{
                    padding: '13px 14px', fontFamily: FONT_MONO, fontSize: '12.5px',
                    color: COLORS.tx2,
                  }}
                >
                  {row.date}
                </div>

                {/* Symbol + Logo */}
                <div
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '13px 14px', minWidth: 0,
                  }}
                >
                  <Logo symbol={row.symbol} size={26} />
                  <span style={{ fontWeight: 700, fontSize: '13.5px', color: COLORS.tx }}>
                    {row.symbol}
                  </span>
                </div>

                {/* Time (hour) */}
                <div
                  style={{
                    padding: '13px 14px', fontSize: '12px',
                    color: COLORS.tx2, fontFamily: FONT_SANS,
                  }}
                >
                  {hourLabel(row.hour)}
                </div>

                {/* EPS Estimate */}
                <div
                  style={{
                    padding: '13px 14px', fontFamily: FONT_MONO, fontSize: '12.5px',
                    color: row.epsEstimate !== null ? COLORS.tx : COLORS.tx3,
                  }}
                >
                  {row.epsEstimate !== null ? `$${row.epsEstimate.toFixed(2)}` : '—'}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
