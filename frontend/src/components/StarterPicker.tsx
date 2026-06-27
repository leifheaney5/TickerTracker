import { useState } from 'react'
import { useStore } from '../state/store'
import { FONT_SANS, FONT_MONO } from '../theme/tokens'
import { STARTER_LISTS } from '../data/starterLists'

// Shown on ManageWatchlist when the authed user's watchlist is empty.
// Clicking a list bulk-adds all its symbols sequentially (same pattern as submitBulk).
export function StarterPicker() {
  const addWatch = useStore((s) => s.addWatch)
  const [loading, setLoading] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const card: React.CSSProperties = {
    background: 'var(--card)',
    border: '1px solid var(--line)',
    borderRadius: 16,
  }

  const handlePick = async (id: string, symbols: string[]) => {
    setLoading(id)
    setDone(null)
    for (const sym of symbols) {
      await addWatch(sym)
    }
    setLoading(null)
    setDone(id)
    setTimeout(() => setDone(null), 4000)
  }

  return (
    <div style={{ ...card, padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--tx)' }}>Start with a preset list</span>
        <span style={{ fontSize: '12px', color: 'var(--tx3)' }}>
          Pick a starter watchlist — you can add, remove, or edit tickers any time.
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
        {STARTER_LISTS.map((list) => {
          const isLoading = loading === list.id
          const isDone = done === list.id
          return (
            <button
              key={list.id}
              onClick={() => handlePick(list.id, list.symbols)}
              disabled={loading !== null}
              style={{
                background: 'var(--cardHi)',
                border: '1px solid var(--line2)',
                borderRadius: 11,
                padding: '13px 15px',
                cursor: loading !== null ? 'default' : 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: 6,
                textAlign: 'left',
                opacity: loading !== null && !isLoading ? 0.5 : 1,
                transition: 'opacity 0.15s',
              }}
            >
              <span style={{ fontSize: '13px', fontWeight: 700, color: isDone ? 'var(--up)' : 'var(--tx)', fontFamily: FONT_SANS }}>
                {isDone ? 'Added!' : isLoading ? 'Adding…' : list.label}
              </span>
              <span style={{ fontSize: '11px', color: 'var(--tx3)', fontFamily: FONT_MONO, letterSpacing: '.01em' }}>
                {list.symbols.join(' · ')}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
