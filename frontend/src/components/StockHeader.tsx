import { useState } from 'react'
import { useStore } from '../state/store'
import { FONT_SANS, FONT_MONO } from '../theme/tokens'
import { UNIVERSE } from '../data/universe'
import { Logo } from './Logo'
import { PulseDial } from './PulseDial'
import { money, pct } from '../lib/format'

// Stock header — ported from the prototype template (lines 241-296): logo,
// 30px symbol, exchange pill, Track/Tracking toggle, name·sector, big mono
// price + day-change pill, and the editable price-target chip.
export function StockHeader() {
  const selected = useStore((s) => s.selected)
  const price = useStore((s) => s.price)
  const chg = useStore((s) => s.chg)
  const flash = useStore((s) => s.flash)
  const watchlist = useStore((s) => s.watchlist)
  const fundamentals = useStore((s) => s.fundamentals)
  const addWatch = useStore((s) => s.addWatch)
  const removeWatch = useStore((s) => s.removeWatch)
  const updateWatch = useStore((s) => s.updateWatch)

  const [editing, setEditing] = useState(false)
  const [editVal, setEditVal] = useState('')

  const u = UNIVERSE[selected] || { name: selected, sector: '—', exch: '—' } as typeof UNIVERSE[string]
  const f = fundamentals[selected]
  const sector = f?.sector && f.sector !== '—' ? f.sector : u.sector
  const wl = watchlist.find((w) => w.symbol === selected)
  const tracked = !!wl
  const target = wl?.target ?? 0
  const p = price(selected)
  const c = chg(selected)
  const up = c >= 0
  const fl = flash[selected]
  const priceColor = fl === 'up' ? 'var(--up)' : fl === 'down' ? 'var(--down)' : 'var(--tx)'
  const dayAbs = p - p / (1 + c / 100)
  const targetHit = target > 0 && p >= target

  const trackStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 6, height: 32, padding: '0 13px',
    borderRadius: 9, cursor: 'pointer', fontFamily: FONT_SANS, fontWeight: 700, fontSize: '12.5px',
    border: tracked ? '1px solid var(--line2)' : 'none',
    background: tracked ? 'transparent' : 'var(--accent)',
    color: tracked ? 'var(--accent)' : 'var(--accentInk)',
  }

  const saveTarget = () => {
    const v = parseFloat(editVal)
    if (!isNaN(v)) updateWatch(selected, { target: v })
    setEditing(false)
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start', flex: '0 0 auto' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
          <Logo symbol={selected} size={42} />
          <span style={{ fontSize: '30px', fontWeight: 800, letterSpacing: '-.02em', color: 'var(--tx)' }}>{selected}</span>
          <span style={{ fontSize: '10.5px', fontWeight: 600, letterSpacing: '.04em', color: 'var(--tx3)', border: '1px solid var(--line2)', borderRadius: 5, padding: '2px 7px' }}>{u.exch}</span>
          <button
            onClick={() => (tracked ? removeWatch(selected) : addWatch(selected))}
            title="Add to your Ticker Tracker list"
            style={trackStyle}
          >
            {tracked ? '✓ Tracking' : '＋ Track'}
          </button>
        </div>
        <span style={{ fontSize: '14px', color: 'var(--tx2)' }}>{u.name} · {sector}</span>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, marginTop: 6, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: FONT_MONO, fontSize: '32px', fontWeight: 600, letterSpacing: '-.01em', lineHeight: 1, color: priceColor }}>{money(p)}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 11px', borderRadius: 9, fontFamily: FONT_MONO, fontSize: '14px', fontWeight: 600, background: up ? 'rgba(61,220,132,.12)' : 'rgba(255,93,115,.12)', color: up ? 'var(--up)' : 'var(--down)' }}>
            {up ? '▲' : '▼'} {pct(c)} <span style={{ opacity: 0.8 }}>{(dayAbs >= 0 ? '+' : '') + money(Math.abs(dayAbs)).replace('$', '$')}</span>
          </span>
          <span style={{ fontSize: '12px', color: 'var(--tx3)' }}>Today</span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
      <PulseDial symbol={selected} size={58} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, alignItems: 'flex-end' }}>
        {editing ? (
          <div style={{ display: 'flex', gap: 7, alignItems: 'center', padding: '7px 9px', borderRadius: 11, background: 'var(--card)', border: '1px solid var(--accent)' }}>
            <span style={{ fontSize: '11px', color: 'var(--tx2)' }}>Target $</span>
            <input
              autoFocus
              value={editVal}
              onChange={(e) => setEditVal(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveTarget()}
              style={{ width: 78, height: 28, padding: '0 8px', borderRadius: 7, border: '1px solid var(--line2)', background: 'var(--bg)', color: 'var(--tx)', fontFamily: FONT_MONO, fontSize: '13px' }}
            />
            <button onClick={saveTarget} style={{ height: 28, padding: '0 11px', borderRadius: 7, border: 'none', background: 'var(--accent)', color: 'var(--accentInk)', fontWeight: 700, fontSize: '12px', cursor: 'pointer', fontFamily: FONT_SANS }}>Save</button>
          </div>
        ) : (
          <button
            onClick={() => { setEditVal(target ? String(target) : ''); setEditing(true) }}
            style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 13px', borderRadius: 11, background: 'var(--card)', border: `1px solid ${targetHit ? 'var(--accent)' : 'var(--line)'}`, cursor: 'pointer', fontFamily: FONT_SANS }}
          >
            <span style={{ fontSize: '14px', color: targetHit ? 'var(--accent)' : 'var(--tx3)' }}>◎</span>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.25 }}>
              <span style={{ fontSize: '10px', letterSpacing: '.04em', color: 'var(--tx3)' }}>PRICE TARGET</span>
              <span style={{ fontFamily: FONT_MONO, fontSize: '13.5px', fontWeight: 600, color: 'var(--tx)' }}>{target ? money(target) : 'Set target'}</span>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--tx3)', marginLeft: 2 }}>✎</span>
          </button>
        )}
        {targetHit && <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--accent)' }}>● Target reached</span>}
      </div>
      </div>
    </div>
  )
}
