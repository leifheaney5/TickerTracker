import { useState } from 'react'
import { FONT_MONO, FONT_SANS } from '../theme/tokens'
import { money } from '../lib/format'
import { targetDistancePct, targetReached, type TargetSide } from '../lib/targets'

export interface TargetValues {
  buy_target: number
  sell_target: number
}

interface Props {
  buyTarget: number
  sellTarget: number
  onSave: (targets: TargetValues) => void | boolean | Promise<void | boolean>
  onCancel: () => void
  symbol?: string
}

function parseTarget(value: string): number | null {
  if (value.trim() === '') return 0
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

export function TargetEditor({ buyTarget, sellTarget, onSave, onCancel, symbol }: Props) {
  const [buy, setBuy] = useState(buyTarget > 0 ? String(buyTarget) : '')
  const [sell, setSell] = useState(sellTarget > 0 ? String(sellTarget) : '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    const buyValue = parseTarget(buy)
    const sellValue = parseTarget(sell)
    if (buyValue == null || sellValue == null) {
      setError('Enter a positive price or leave the field blank to clear it.')
      return
    }
    setError(null)
    setSaving(true)
    try {
      const saved = await onSave({ buy_target: buyValue, sell_target: sellValue })
      if (saved === false) throw new Error('save failed')
    } catch {
      setError('Targets could not be saved. Try again.')
    } finally {
      setSaving(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: 96,
    height: 32,
    padding: '0 9px',
    borderRadius: 7,
    border: '1px solid var(--line2)',
    background: 'var(--bg)',
    color: 'var(--tx)',
    fontFamily: FONT_MONO,
    fontSize: '12.5px',
  }

  return (
    <div
      onKeyDown={(event) => {
        if (event.key === 'Escape') onCancel()
        if (event.key === 'Enter') { event.preventDefault(); void save() }
      }}
      style={{ display: 'flex', flexDirection: 'column', gap: 9, padding: 11, borderRadius: 11, background: 'var(--card)', border: '1px solid var(--accent)', minWidth: 250 }}
    >
      {symbol && <span style={{ color: 'var(--tx2)', fontSize: '11.5px', fontWeight: 700 }}>{symbol} targets</span>}
      <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, color: 'var(--tx2)', fontFamily: FONT_SANS, fontSize: '11px' }}>
          Buy target
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span aria-hidden="true" style={{ color: 'var(--tx3)' }}>$</span>
            <input aria-label="Buy target" type="number" min="0" step="any" inputMode="decimal" value={buy} onChange={(e) => setBuy(e.target.value)} style={inputStyle} />
            <button type="button" aria-label="Clear buy target" onClick={() => setBuy('')} style={{ border: 0, background: 'transparent', color: 'var(--tx3)', cursor: 'pointer', padding: 4 }}>×</button>
          </span>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, color: 'var(--tx2)', fontFamily: FONT_SANS, fontSize: '11px' }}>
          Sell target
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span aria-hidden="true" style={{ color: 'var(--tx3)' }}>$</span>
            <input aria-label="Sell target" type="number" min="0" step="any" inputMode="decimal" value={sell} onChange={(e) => setSell(e.target.value)} style={inputStyle} />
            <button type="button" aria-label="Clear sell target" onClick={() => setSell('')} style={{ border: 0, background: 'transparent', color: 'var(--tx3)', cursor: 'pointer', padding: 4 }}>×</button>
          </span>
        </label>
      </div>
      {parseTarget(buy) != null && parseTarget(sell) != null && Number(buy) > 0 && Number(sell) > 0 && Number(buy) > Number(sell) && (
        <span style={{ color: 'var(--tx2)', fontSize: '11px' }}>Buy is above sell. You can still save these targets.</span>
      )}
      {error && <span role="alert" style={{ color: 'var(--down)', fontSize: '11px' }}>{error}</span>}
      <div style={{ display: 'flex', gap: 7, justifyContent: 'flex-end' }}>
        <button type="button" aria-label="Cancel target editing" onClick={onCancel} disabled={saving} style={{ height: 30, padding: '0 11px', borderRadius: 7, border: '1px solid var(--line2)', background: 'transparent', color: 'var(--tx2)', fontFamily: FONT_SANS, cursor: 'pointer' }}>Cancel</button>
        <button type="button" aria-label="Save targets" onClick={save} disabled={saving} style={{ height: 30, padding: '0 11px', borderRadius: 7, border: 'none', background: 'var(--accent)', color: 'var(--accentInk)', fontWeight: 700, fontFamily: FONT_SANS, cursor: 'pointer' }}>{saving ? 'Saving…' : 'Save'}</button>
      </div>
    </div>
  )
}

interface SummaryProps {
  buyTarget: number
  sellTarget: number
  price?: number | null
  compact?: boolean
}

function targetLine(label: 'Buy' | 'Sell', target: number, price: number | null | undefined, side: TargetSide) {
  if (targetReached(price, target, side)) return `${label} ${money(target)} · ✓ Reached`
  const distance = targetDistancePct(price, target, side)
  return `${label} ${money(target)}${distance == null ? '' : ` · ${distance.toFixed(1)}% away`}`
}

export function TargetSummary({ buyTarget, sellTarget, price, compact = false }: SummaryProps) {
  const rows = [
    buyTarget > 0 ? { side: 'buy' as const, text: targetLine('Buy', buyTarget, price, 'buy') } : null,
    sellTarget > 0 ? { side: 'sell' as const, text: targetLine('Sell', sellTarget, price, 'sell') } : null,
  ].filter((row): row is { side: TargetSide; text: string } => row != null)

  if (!rows.length) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 2 : 4, minWidth: 0 }}>
      {rows.map((row) => {
        const reached = row.text.includes('Reached')
        return (
          <span key={row.side} style={{ fontFamily: FONT_MONO, fontSize: compact ? '10.5px' : '12px', color: reached ? 'var(--accent)' : 'var(--tx2)', fontWeight: reached ? 700 : 500, whiteSpace: 'nowrap' }}>
            {row.text}
          </span>
        )
      })}
    </div>
  )
}
