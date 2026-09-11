import { useState } from 'react'
import { useStore } from '../state/store'
import { FONT_SANS, FONT_MONO } from '../theme/tokens'
import { UNIVERSE } from '../data/universe'
import { Logo } from './Logo'
import { PulseDial } from './PulseDial'
import { Skeleton } from './Skeleton'
import { money, pct, asOf } from '../lib/format'
import { TargetEditor, TargetSummary, type TargetValues } from './TargetEditor'
import { useRequireAuth } from '../hooks/useRequireAuth'

// Stock header — ported from the prototype template (lines 241-296): logo,
// 30px symbol, exchange pill, Track/Tracking toggle, name·sector, big mono
// price + day-change pill, and the editable price-target chip.
export function StockHeader() {
  const selected = useStore((s) => s.selected)
  const price = useStore((s) => s.price)
  const chg = useStore((s) => s.chg)
  const hasQuote = useStore((s) => s.hasQuote)
  const flash = useStore((s) => s.flash)
  const watchlist = useStore((s) => s.watchlist)
  const fundamentals = useStore((s) => s.fundamentals)
  const addWatch = useStore((s) => s.addWatch)
  const removeWatch = useStore((s) => s.removeWatch)
  const updateWatch = useStore((s) => s.updateWatch)
  const requireAuth = useRequireAuth()
  const marketStatus = useStore((s) => s.marketStatus)
  const quotesFetchedAt = useStore((s) => s.quotesFetchedAt)

  const [editing, setEditing] = useState(false)

  const u = UNIVERSE[selected] || { name: selected, sector: '—', exch: '—' } as typeof UNIVERSE[string]
  const f = fundamentals[selected]
  const sector = f?.sector && f.sector !== '—' ? f.sector : u.sector
  const wl = watchlist.find((w) => w.symbol === selected)
  const tracked = !!wl
  const buyTarget = wl?.buy_target ?? 0
  const sellTarget = wl?.sell_target ?? 0
  const live = hasQuote(selected)
  const p = price(selected)
  const c = chg(selected)
  const up = c >= 0
  const fl = flash[selected]
  const priceColor = fl === 'up' ? 'var(--up)' : fl === 'down' ? 'var(--down)' : 'var(--tx)'
  const dayAbs = p - p / (1 + c / 100)

  // Market-status pill config — derived from the real backend value (set by pollQuotes →
  // /api/quotes → get_market_status(), a genuine US-ET time computation). Returns null for
  // 'Unknown' (pre-first-poll) so no pill renders until we have a real value.
  const STATUS_DISPLAY: Record<string, { label: string; bg: string; color: string }> = {
    'Market Open':       { label: 'OPEN',        bg: 'rgba(61,220,132,.15)',   color: 'var(--up)' },
    'Pre-Market':        { label: 'PRE-MARKET',   bg: 'rgba(255,183,72,.12)',   color: '#ffb748' },
    'After-Hours':       { label: 'AFTER-HOURS',  bg: 'rgba(120,130,200,.14)', color: '#8892d4' },
    'Closed (Weekend)':  { label: 'CLOSED',       bg: 'rgba(180,180,200,.10)', color: 'var(--tx3)' },
  }
  const statusDisplay = marketStatus ? STATUS_DISPLAY[marketStatus] ?? null : null

  const trackStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 6, height: 32, padding: '0 13px',
    borderRadius: 9, cursor: 'pointer', fontFamily: FONT_SANS, fontWeight: 700, fontSize: '12.5px',
    border: tracked ? '1px solid var(--line2)' : 'none',
    background: tracked ? 'transparent' : 'var(--accent)',
    color: tracked ? 'var(--accent)' : 'var(--accentInk)',
    whiteSpace: 'nowrap',
  }

  const saveTargets = async (targets: TargetValues) => {
    const saved = await updateWatch(selected, targets)
    if (saved !== false) setEditing(false)
    return saved
  }

  return (
    <div data-testid="stock-header" style={{ display: 'flex', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start', flex: '0 0 auto' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 13, flexWrap: 'wrap' }}>
          <Logo symbol={selected} size={42} domain={f?.website} />
          <span style={{ fontSize: '30px', fontWeight: 800, letterSpacing: '-.02em', color: 'var(--tx)' }}>{selected}</span>
          <span style={{ fontSize: '10.5px', fontWeight: 600, letterSpacing: '.04em', color: 'var(--tx3)', border: '1px solid var(--line2)', borderRadius: 5, padding: '2px 7px' }}>{u.exch}</span>
          <button
            className="stock-track-action"
            aria-label={tracked ? `Stop tracking ${selected}` : 'Track and set targets'}
            onClick={() => requireAuth(async () => {
              if (tracked) removeWatch(selected)
              else if (await addWatch(selected)) setEditing(true)
            })}
            title="Add to your Ticker Tracker list"
            style={trackStyle}
          >
            {tracked ? '✓ Tracking' : 'Track and set targets'}
          </button>
        </div>
        <span style={{ fontSize: '14px', color: 'var(--tx2)' }}>{u.name} · {sector}</span>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, marginTop: 6, flexWrap: 'wrap' }}>
          {live ? (
            <>
              {/* aria-live="polite" so screen readers hear price updates on each 60s poll (A7). */}
              {/* aria-atomic="true" announces the full region, not just the changed fragment.  */}
              <div role="status" aria-live="polite" aria-atomic="true"
                style={{ fontFamily: FONT_MONO, fontSize: '32px', fontWeight: 600, letterSpacing: '-.01em', lineHeight: 1, color: priceColor }}>
                {money(p)}
              </div>
              <span style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 11px', borderRadius: 9, fontFamily: FONT_MONO, fontSize: '14px', fontWeight: 600, background: up ? 'rgba(61,220,132,.12)' : 'rgba(255,93,115,.12)', color: up ? 'var(--up)' : 'var(--down)' }}>
                {up ? '▲' : '▼'} {pct(c)} <span style={{ opacity: 0.8 }}>{(dayAbs >= 0 ? '+' : '') + money(Math.abs(dayAbs)).replace('$', '$')}</span>
              </span>
              <span style={{ fontSize: '12px', color: 'var(--tx3)' }}>Today</span>
            </>
          ) : (
            <>
              <Skeleton width={150} height={32} radius={8} />
              <Skeleton width={92} height={26} radius={9} />
            </>
          )}
          {/* Market-status pill — text + color (WCAG 1.4.1: not color-only). Source: real  */}
          {/* backend computation via pollQuotes → /api/quotes → get_market_status() (ET).   */}
          {/* NOTE: market holidays are not accounted for (no holiday calendar on backend).   */}
          {statusDisplay && (
            <span
              aria-label={`Market status: ${statusDisplay.label}`}
              style={{ alignSelf: 'center', fontSize: '10px', fontWeight: 700, letterSpacing: '.06em', padding: '3px 8px', borderRadius: 5, background: statusDisplay.bg, color: statusDisplay.color }}
            >
              {statusDisplay.label}
            </span>
          )}
          {/* Freshness label — shows when first poll has landed (quotesFetchedAt is set). */}
          {quotesFetchedAt && (
            <span data-testid="stock-header-as-of" style={{ alignSelf: 'center', fontSize: '11px', color: 'var(--tx3)' }}>
              {asOf(quotesFetchedAt)}
            </span>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
      <PulseDial symbol={selected} size={78} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, alignItems: 'flex-end' }}>
        {tracked && editing ? (
          <TargetEditor buyTarget={buyTarget} sellTarget={sellTarget} onSave={saveTargets} onCancel={() => setEditing(false)} symbol={selected} />
        ) : tracked ? (
          <button
            aria-label="Edit buy and sell targets"
            onClick={() => setEditing(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 13px', borderRadius: 11, background: 'var(--card)', border: '1px solid var(--line)', cursor: 'pointer', fontFamily: FONT_SANS }}
          >
            <span aria-hidden="true" style={{ fontSize: '14px', color: 'var(--accent)' }}>◎</span>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.25 }}>
              <span style={{ fontSize: '10px', letterSpacing: '.04em', color: 'var(--tx3)' }}>BUY / SELL TARGETS</span>
              {buyTarget > 0 || sellTarget > 0
                ? <TargetSummary buyTarget={buyTarget} sellTarget={sellTarget} price={live ? p : null} compact />
                : <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--tx)' }}>Set buy and sell targets</span>}
            </div>
            <span style={{ fontSize: '11px', color: 'var(--tx3)', marginLeft: 2 }}>✎</span>
          </button>
        ) : null}
      </div>
      </div>
    </div>
  )
}
