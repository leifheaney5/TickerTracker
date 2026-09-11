import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api/client'
import { UNIVERSE } from '../data/universe'
import { useStore } from '../state/store'
import { FONT_SANS } from '../theme/tokens'
import { Logo } from './Logo'

interface Match { symbol: string; description: string }

function localMatches(query: string): Match[] {
  const q = query.trim().toUpperCase()
  if (!q) return []
  return Object.keys(UNIVERSE)
    .filter((symbol) => symbol.includes(q) || (UNIVERSE[symbol].name || '').toUpperCase().includes(q))
    .slice(0, 12)
    .map((symbol) => ({ symbol, description: UNIVERSE[symbol].name }))
}

export function TickerFinder() {
  const intent = useStore((s) => s.tickerFinder)
  const close = useStore((s) => s.closeTickerFinder)
  const setSelected = useStore((s) => s.setSelected)
  const setView = useStore((s) => s.setView)
  const watchlist = useStore((s) => s.watchlist)
  const addWatch = useStore((s) => s.addWatch)
  const addToList = useStore((s) => s.addToList)
  const compare = useStore((s) => s.compare)
  const toggleCompare = useStore((s) => s.toggleCompare)
  const [query, setQuery] = useState('')
  const [remote, setRemote] = useState<Match[] | null>(null)
  const [searching, setSearching] = useState(false)
  const opener = useRef<HTMLElement | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!intent) return
    opener.current = document.activeElement as HTMLElement | null
    setQuery('')
    setRemote(null)
    requestAnimationFrame(() => inputRef.current?.focus())
    return () => opener.current?.focus()
  }, [intent])

  useEffect(() => {
    const q = query.trim()
    if (!q) { setRemote(null); setSearching(false); return }
    let cancelled = false
    setSearching(true)
    const timer = setTimeout(async () => {
      try {
        const result = await api.search(q)
        if (!cancelled) setRemote(result.data.map((hit) => ({ symbol: hit.symbol, description: hit.description })))
      } catch {
        if (!cancelled) setRemote([])
      } finally {
        if (!cancelled) setSearching(false)
      }
    }, 250)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [query])

  const matches = useMemo(() => remote?.length ? remote : localMatches(query), [query, remote])
  if (!intent) return null

  const title = intent.kind === 'compare' ? 'Compare a ticker' : intent.kind === 'list' ? 'Add ticker to list' : intent.kind === 'track' ? 'Track a ticker' : 'Find a ticker'
  const act = async (symbol: string) => {
    if (intent.kind === 'browse') { setSelected(symbol); setView('dashboard'); close(); return }
    if (intent.kind === 'compare') { toggleCompare(symbol); close(); return }
    if (intent.kind === 'list') { if (await addToList(intent.listId, symbol)) close(); return }
    if (await addWatch(symbol)) { setSelected(symbol); setView('dashboard'); close() }
  }

  return (
    <div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close() }} style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(3,6,16,.78)', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '10vh 16px 24px' }}>
      <div role="dialog" aria-modal="true" aria-labelledby="ticker-finder-title" onKeyDown={(event) => { if (event.key === 'Escape') close() }} style={{ width: 'min(620px,100%)', maxHeight: '76vh', overflow: 'hidden', background: 'var(--panel)', border: '1px solid var(--line2)', borderRadius: 18, boxShadow: '0 30px 90px rgba(0,0,0,.6)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '18px 18px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div><div id="ticker-finder-title" style={{ font: `800 18px ${FONT_SANS}`, color: 'var(--tx)' }}>{title}</div><div style={{ marginTop: 3, color: 'var(--tx3)', fontSize: 12 }}>Search once, then view, track, add, or compare.</div></div>
          <button onClick={close} aria-label="Close ticker finder" style={{ width: 34, height: 34, borderRadius: 9, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--tx2)', cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ margin: '0 18px 12px', display: 'flex', alignItems: 'center', gap: 10, border: '1px solid var(--accent)', borderRadius: 12, background: 'var(--bg)', padding: '0 13px' }}>
          <span aria-hidden="true" style={{ color: 'var(--accent)' }}>⌕</span>
          <input ref={inputRef} role="combobox" aria-expanded={matches.length > 0} aria-controls="ticker-results" aria-label="Search ticker or company" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Symbol or company name" style={{ flex: 1, height: 48, border: 0, outline: 0, background: 'transparent', color: 'var(--tx)', font: `500 14px ${FONT_SANS}` }} />
          {searching && <span style={{ color: 'var(--tx3)', fontSize: 11 }}>Searching…</span>}
        </div>
        <div id="ticker-results" role="listbox" style={{ overflowY: 'auto', padding: '0 8px 12px' }}>
          {query && !searching && matches.length === 0 && <div style={{ padding: 20, textAlign: 'center', color: 'var(--tx3)', fontSize: 13 }}>No matching ticker found.</div>}
          {matches.map((match) => {
            const tracked = watchlist.some((item) => item.symbol === match.symbol)
            const compared = compare.includes(match.symbol)
            return <div key={match.symbol} role="option" aria-selected={compared} style={{ width: '100%', display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center', padding: '4px 6px', borderRadius: 10, fontFamily: FONT_SANS }}>
              <button onClick={() => void act(match.symbol)} style={{ minWidth: 0, display: 'grid', gridTemplateColumns: '34px 62px 1fr', gap: 10, alignItems: 'center', padding: '8px 6px', border: 0, background: 'transparent', color: 'var(--tx)', cursor: 'pointer', textAlign: 'left', fontFamily: FONT_SANS }}><Logo symbol={match.symbol} size={30} /><strong>{match.symbol}</strong><span style={{ color: 'var(--tx2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{match.description}</span></button>
              {intent.kind === 'browse' ? <button disabled={tracked} onClick={async () => { if (await addWatch(match.symbol)) close() }} style={{ height: 32, padding: '0 10px', borderRadius: 8, border: '1px solid var(--line2)', background: tracked ? 'transparent' : 'var(--accent)', color: tracked ? 'var(--accent)' : 'var(--accentInk)', fontSize: 11.5, fontWeight: 700, cursor: tracked ? 'default' : 'pointer' }}>{tracked ? '✓ Tracking' : '+ Track'}</button> : <span style={{ color: tracked || compared ? 'var(--accent)' : 'var(--tx3)', fontSize: 12 }}>{intent.kind === 'compare' ? (compared ? 'Remove' : 'Compare') : tracked ? 'Tracking' : 'Add'}</span>}
            </div>
          })}
        </div>
      </div>
    </div>
  )
}
