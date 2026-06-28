import { useState, useRef } from 'react'
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useStore, isAuthed } from '../state/store'
import { FONT_SANS, FONT_MONO } from '../theme/tokens'
import { UNIVERSE } from '../data/universe'
import { Logo } from '../components/Logo'
import { StarterPicker } from '../components/StarterPicker'
import { money, pct } from '../lib/format'
import { api } from '../api/client'
import type { WatchlistWithItems, WatchlistItemFull } from '../api/types'

// ── id encoding helpers ──────────────────────────────────────────────────────
// Each dnd-kit sortable id encodes the type so onDragEnd can dispatch the
// right store action without maintaining extra lookup maps.
//   list cards:  "list:<id>"
//   ticker rows: "item:<listId>:<symbol>"

function listId(id: number) { return `list:${id}` }
function itemId(listId: number, sym: string) { return `item:${listId}:${sym}` }

function parseId(sortableId: string):
  | { kind: 'list'; id: number }
  | { kind: 'item'; listId: number; sym: string }
  | null {
  if (sortableId.startsWith('list:')) {
    const id = parseInt(sortableId.slice(5), 10)
    return isNaN(id) ? null : { kind: 'list', id }
  }
  if (sortableId.startsWith('item:')) {
    const rest = sortableId.slice(5)
    const colon = rest.indexOf(':')
    if (colon < 0) return null
    const id = parseInt(rest.slice(0, colon), 10)
    const sym = rest.slice(colon + 1)
    return isNaN(id) || !sym ? null : { kind: 'item', listId: id, sym }
  }
  return null
}

// ── TickerRow ────────────────────────────────────────────────────────────────

interface TickerRowProps {
  item: WatchlistItemFull
  listId: number
  price: (s: string) => number
  chg: (s: string) => number
  setSelected: (s: string) => void
  setView: (v: 'dashboard') => void
  updateWatch: (s: string, f: Partial<WatchlistItemFull>) => void
  removeFromList: (listId: number, sym: string) => void
}

function TickerRow({
  item,
  listId: lid,
  price,
  chg,
  setSelected,
  setView,
  updateWatch,
  removeFromList,
}: TickerRowProps) {
  const [editSym, setEditSym] = useState<string | null>(null)
  const [editVal, setEditVal] = useState('')

  const sortableId = itemId(lid, item.symbol)
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: sortableId,
    disabled: item.locked,
  })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : item.locked ? 0.5 : 1,
  }

  const u = UNIVERSE[item.symbol] || ({ name: item.symbol } as typeof UNIVERSE[string])
  const c = chg(item.symbol)
  const up = c >= 0

  const saveTarget = (sym: string) => {
    const v = parseFloat(editVal)
    if (!isNaN(v)) updateWatch(sym, { target: v })
    setEditSym(null)
  }

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        display: 'grid',
        gridTemplateColumns: '28px minmax(140px,1.6fr) 100px 80px 140px 110px 80px',
        alignItems: 'center',
        borderTop: '1px solid var(--line)',
        background: isDragging ? 'var(--cardHi)' : undefined,
      }}
    >
      {/* drag handle */}
      {item.locked ? (
        <div style={{ padding: '12px 4px 12px 10px', color: 'var(--tx3)', fontSize: '14px' }}>🔒</div>
      ) : (
        <div
          {...attributes}
          {...listeners}
          style={{ padding: '12px 4px 12px 10px', cursor: 'grab', color: 'var(--tx3)', fontSize: '14px', userSelect: 'none' }}
          title="Drag to reorder"
        >
          ⠿
        </div>
      )}

      {/* ticker name */}
      <div
        onClick={() => { if (!item.locked) { setSelected(item.symbol); setView('dashboard') } }}
        style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '12px 14px 12px 4px', cursor: item.locked ? 'default' : 'pointer', minWidth: 0 }}
      >
        <Logo symbol={item.symbol} size={28} />
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <span style={{ fontWeight: 700, fontSize: '13.5px', color: 'var(--tx)' }}>{item.symbol}</span>
          <span style={{ fontSize: '11px', color: 'var(--tx3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</span>
        </div>
        {item.locked && (
          <span style={{ marginLeft: 6, padding: '2px 8px', borderRadius: 6, background: 'var(--accent)', color: 'var(--accentInk)', fontSize: '10.5px', fontWeight: 700, whiteSpace: 'nowrap' }}>
            Upgrade to unlock
          </span>
        )}
      </div>

      {/* price */}
      <div style={{ padding: '12px 14px', fontFamily: FONT_MONO, fontSize: '13px', color: 'var(--tx)' }}>
        {money(price(item.symbol))}
      </div>

      {/* 24h % */}
      <div style={{ padding: '12px 14px', fontFamily: FONT_MONO, fontSize: '12px', fontWeight: 600, color: up ? 'var(--up)' : 'var(--down)' }}>
        {pct(c)}
      </div>

      {/* target */}
      <div style={{ padding: '10px 14px' }}>
        {editSym === item.symbol ? (
          <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
            <input
              autoFocus
              value={editVal}
              onChange={(e) => setEditVal(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveTarget(item.symbol)}
              placeholder="$"
              aria-label={`Target price for ${item.symbol}`}
              style={{ width: 70, height: 30, padding: '0 8px', borderRadius: 7, border: '1px solid var(--accent)', background: 'var(--bg)', color: 'var(--tx)', fontFamily: FONT_MONO, fontSize: '12.5px' }}
            />
            <button
              onClick={() => saveTarget(item.symbol)}
              style={{ height: 30, padding: '0 10px', borderRadius: 7, border: 'none', background: 'var(--accent)', color: 'var(--accentInk)', fontWeight: 700, cursor: 'pointer' }}
            >
              ✓
            </button>
          </div>
        ) : (
          <span
            onClick={() => { if (!item.locked) { setEditVal(item.target ? String(item.target) : ''); setEditSym(item.symbol) } }}
            style={{ fontFamily: FONT_MONO, fontSize: '12.5px', color: item.target ? 'var(--tx)' : 'var(--tx3)', cursor: item.locked ? 'default' : 'pointer' }}
          >
            {item.target ? money(item.target) : 'set target ✎'}
          </span>
        )}
      </div>

      {/* alert */}
      <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
        <input
          title="Set price alert"
          aria-label={`Alert price for ${item.symbol}`}
          type="number"
          placeholder="$"
          defaultValue={item.alert_price || ''}
          disabled={item.locked}
          onBlur={(e) => !item.locked && updateWatch(item.symbol, { alert_price: parseFloat(e.target.value) || 0 })}
          style={{ width: 64, height: 28, padding: '0 7px', borderRadius: 7, border: '1px solid var(--line2)', background: 'var(--bg)', color: 'var(--tx)', fontFamily: FONT_MONO, fontSize: '12px', opacity: item.locked ? 0.5 : 1 }}
        />
        <button
          onClick={() => !item.locked && updateWatch(item.symbol, { alert_active: !item.alert_active })}
          disabled={item.locked}
          title={item.alert_active ? 'Alert on' : 'Alert off'}
          aria-label={`Toggle price alert for ${item.symbol}`}
          style={{ height: 28, padding: '0 8px', borderRadius: 7, border: 'none', cursor: item.locked ? 'default' : 'pointer', fontSize: '11px', fontWeight: 700, background: item.alert_active ? 'var(--up)' : 'var(--cardHi)', color: item.alert_active ? 'var(--accentInk)' : 'var(--tx3)' }}
        >
          {item.alert_active ? 'ON' : 'OFF'}
        </button>
      </div>

      {/* remove */}
      <div style={{ padding: '12px 14px' }}>
        {!item.locked && (
          <button
            onClick={() => removeFromList(lid, item.symbol)}
            title="Remove"
            aria-label={`Remove ${item.symbol}`}
            style={{ height: 30, padding: '0 12px', borderRadius: 7, border: '1px solid var(--line2)', background: 'transparent', color: 'var(--tx2)', fontFamily: FONT_SANS, fontSize: '12px', cursor: 'pointer' }}
          >
            Remove
          </button>
        )}
      </div>
    </div>
  )
}

// ── WatchlistCard ────────────────────────────────────────────────────────────

interface WatchlistCardProps {
  list: WatchlistWithItems
  totalLists: number
  price: (s: string) => number
  chg: (s: string) => number
  setSelected: (s: string) => void
  setView: (v: 'dashboard') => void
  updateWatch: (s: string, f: Partial<WatchlistItemFull>) => void
  removeFromList: (listId: number, sym: string) => void
  renameList: (id: number, name: string) => void
  deleteList: (id: number) => void
  addToList: (listId: number, sym: string) => Promise<boolean>
  onShare: (list: WatchlistWithItems) => void
}

function WatchlistCard({
  list,
  totalLists,
  price,
  chg,
  setSelected,
  setView,
  updateWatch,
  removeFromList,
  renameList,
  deleteList,
  addToList,
  onShare,
}: WatchlistCardProps) {
  const [renaming, setRenaming] = useState(false)
  const [renameVal, setRenameVal] = useState(list.name)
  const [menuOpen, setMenuOpen] = useState(false)
  const [addSym, setAddSym] = useState('')
  const [addError, setAddError] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const sortableId = listId(list.id)
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: sortableId })

  const cardStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    background: 'var(--card)',
    border: '1px solid var(--line)',
    borderRadius: 16,
    overflow: 'hidden',
    opacity: isDragging ? 0.6 : 1,
  }

  const commitRename = () => {
    const trimmed = renameVal.trim()
    if (trimmed && trimmed !== list.name) renameList(list.id, trimmed)
    setRenaming(false)
  }

  const handleAddTicker = async () => {
    const sym = addSym.trim().toUpperCase()
    if (!sym || !/^[A-Z0-9.-]{1,12}$/.test(sym)) return
    setAddError(null)
    const ok = await addToList(list.id, sym)
    if (ok) {
      setAddSym('')
    } else {
      setAddError('Limit reached or symbol invalid')
    }
  }

  const itemIds = list.items.map((item) => itemId(list.id, item.symbol))

  return (
    <div ref={setNodeRef} style={cardStyle}>
      {/* Card header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 16px', borderBottom: '1px solid var(--line)', background: 'var(--panel)' }}>
        {/* card drag handle */}
        <div
          {...attributes}
          {...listeners}
          style={{ cursor: 'grab', color: 'var(--tx3)', fontSize: '16px', userSelect: 'none', flexShrink: 0 }}
          title="Drag to reorder lists"
        >
          ⠿
        </div>

        {/* name / inline rename */}
        {renaming ? (
          <input
            autoFocus
            value={renameVal}
            onChange={(e) => setRenameVal(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenaming(false) }}
            onBlur={commitRename}
            aria-label="Rename list"
            style={{ flex: 1, height: 28, padding: '0 8px', borderRadius: 7, border: '1px solid var(--accent)', background: 'var(--bg)', color: 'var(--tx)', fontFamily: FONT_SANS, fontSize: '14px', fontWeight: 700 }}
          />
        ) : (
          <span
            onDoubleClick={() => { setRenameVal(list.name); setRenaming(true) }}
            style={{ flex: 1, fontSize: '14.5px', fontWeight: 800, color: 'var(--tx)', cursor: 'text', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            title="Double-click to rename"
          >
            {list.name}
          </span>
        )}

        <span style={{ fontSize: '12px', color: 'var(--tx3)', flexShrink: 0 }}>
          {list.items.length} ticker{list.items.length === 1 ? '' : 's'}
        </span>

        {/* ⋯ menu */}
        <div style={{ position: 'relative', flexShrink: 0 }} ref={menuRef}>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="List options"
            style={{ height: 28, width: 28, borderRadius: 7, border: '1px solid var(--line2)', background: menuOpen ? 'var(--cardHi)' : 'transparent', color: 'var(--tx2)', fontFamily: FONT_SANS, fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            ⋯
          </button>
          {menuOpen && (
            <div
              style={{ position: 'absolute', top: 32, right: 0, zIndex: 200, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.25)', minWidth: 140, overflow: 'hidden' }}
              onMouseLeave={() => setMenuOpen(false)}
            >
              <button
                onClick={() => { setRenameVal(list.name); setRenaming(true); setMenuOpen(false) }}
                style={menuItemStyle}
              >
                Rename
              </button>
              {/* Share seam — Task 12 will extend this to PNG download */}
              <button
                onClick={() => { onShare(list); setMenuOpen(false) }}
                style={menuItemStyle}
              >
                Share
              </button>
              <button
                onClick={() => { if (totalLists > 1) { deleteList(list.id); setMenuOpen(false) } }}
                disabled={totalLists <= 1}
                title={totalLists <= 1 ? 'Cannot delete the only list' : undefined}
                style={{ ...menuItemStyle, color: totalLists <= 1 ? 'var(--tx3)' : 'var(--down)', cursor: totalLists <= 1 ? 'default' : 'pointer' }}
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Ticker rows */}
      <div style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: 620 }}>
          {/* column headers */}
          <div style={{ display: 'grid', gridTemplateColumns: '28px minmax(140px,1.6fr) 100px 80px 140px 110px 80px', background: 'var(--panel)', borderBottom: '1px solid var(--line)' }}>
            {['', 'TICKER', 'PRICE', '24H', 'TARGET', 'ALERT', ''].map((h, i) => (
              <div key={i} style={{ padding: '10px 14px', fontSize: '11px', fontWeight: 600, letterSpacing: '.04em', color: 'var(--tx3)' }}>{h}</div>
            ))}
          </div>

          <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
            {list.items.map((item) => (
              <TickerRow
                key={item.symbol}
                item={item}
                listId={list.id}
                price={price}
                chg={chg}
                setSelected={setSelected}
                setView={setView}
                updateWatch={updateWatch}
                removeFromList={removeFromList}
              />
            ))}
          </SortableContext>

          {list.items.length === 0 && (
            <div style={{ padding: '32px 18px', textAlign: 'center', color: 'var(--tx3)', fontSize: '13px' }}>
              No tickers yet — add one below.
            </div>
          )}

          {/* Add ticker row */}
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--line)', display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              value={addSym}
              onChange={(e) => { setAddSym(e.target.value.toUpperCase()); setAddError(null) }}
              onKeyDown={(e) => e.key === 'Enter' && handleAddTicker()}
              placeholder="Add ticker…"
              aria-label={`Add ticker to ${list.name}`}
              style={{ flex: 1, height: 32, padding: '0 10px', borderRadius: 8, border: '1px solid var(--line2)', background: 'var(--bg)', color: 'var(--tx)', fontFamily: FONT_MONO, fontSize: '12.5px', textTransform: 'uppercase' }}
            />
            <button
              onClick={handleAddTicker}
              disabled={!addSym.trim()}
              style={{ height: 32, padding: '0 14px', borderRadius: 8, border: 'none', background: addSym.trim() ? 'var(--accent)' : 'var(--cardHi)', color: addSym.trim() ? 'var(--accentInk)' : 'var(--tx3)', fontFamily: FONT_SANS, fontSize: '12.5px', fontWeight: 700, cursor: addSym.trim() ? 'pointer' : 'default' }}
            >
              Add
            </button>
            {addError && <span style={{ fontSize: '12px', color: 'var(--down)' }}>{addError}</span>}
          </div>
        </div>
      </div>
    </div>
  )
}

const menuItemStyle: React.CSSProperties = {
  display: 'block', width: '100%', padding: '10px 16px', border: 'none', background: 'transparent',
  color: 'var(--tx)', fontFamily: FONT_SANS, fontSize: '13px', textAlign: 'left', cursor: 'pointer',
}

// ── ManageWatchlist (board) ──────────────────────────────────────────────────

export function ManageWatchlist() {
  const authed = useStore(isAuthed)
  const openAuth = useStore((s) => s.openAuth)
  const watchlists = useStore((s) => s.watchlists)
  const currentUser = useStore((s) => s.currentUser)
  const price = useStore((s) => s.price)
  const chg = useStore((s) => s.chg)
  const setSelected = useStore((s) => s.setSelected)
  const setView = useStore((s) => s.setView)
  const updateWatch = useStore((s) => s.updateWatch)
  const removeFromList = useStore((s) => s.removeFromList)
  const renameList = useStore((s) => s.renameList)
  const deleteList = useStore((s) => s.deleteList)
  const createList = useStore((s) => s.createList)
  const addToList = useStore((s) => s.addToList)
  const reorderListCards = useStore((s) => s.reorderListCards)
  const moveTicker = useStore((s) => s.moveTicker)
  const reorderTicker = useStore((s) => s.reorderTicker)
  const lastLimitError = useStore((s) => s.lastLimitError)
  const clearLimitError = useStore((s) => s.clearLimitError)
  // Legacy share state (per-list; Task 12 will extend with PNG)
  const [shareLabel, setShareLabel] = useState<'Share' | 'Copying…' | 'Copied!'>('Share')
  const [sharingListId, setSharingListId] = useState<number | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleShare = async (list: WatchlistWithItems) => {
    setSharingListId(list.id)
    setShareLabel('Copying…')
    try {
      const res = await api.createShare()
      const url = `${location.origin}/s/${res.data.token}`
      await navigator.clipboard.writeText(url)
      setShareLabel('Copied!')
      setTimeout(() => { setShareLabel('Share'); setSharingListId(null) }, 2500)
    } catch {
      setShareLabel('Share')
      setSharingListId(null)
    }
  }

  const handleNewList = async () => {
    const isPremium = currentUser?.plan === 'premium'
    if (!isPremium && watchlists.length >= 1) {
      // Non-premium with 1+ list: show upgrade gate instead of creating
      useStore.setState({ lastLimitError: 'premium_required' })
      return
    }
    await createList('New list')
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const activeStr = String(active.id)
    const overStr = String(over.id)
    const activeParsed = parseId(activeStr)
    const overParsed = parseId(overStr)

    if (!activeParsed || !overParsed) return

    if (activeParsed.kind === 'list' && overParsed.kind === 'list') {
      // Reorder list cards
      reorderListCards(activeParsed.id, overParsed.id)
      return
    }

    if (activeParsed.kind === 'item' && overParsed.kind === 'item') {
      if (activeParsed.listId === overParsed.listId) {
        // Reorder within the same list
        const list = watchlists.find((l) => l.id === activeParsed.listId)
        if (!list) return
        const fromIndex = list.items.findIndex((i) => i.symbol === activeParsed.sym)
        const toIndex = list.items.findIndex((i) => i.symbol === overParsed.sym)
        if (fromIndex >= 0 && toIndex >= 0 && fromIndex !== toIndex) {
          reorderTicker(activeParsed.listId, fromIndex, toIndex)
        }
      } else {
        // Move ticker from one list to another
        const toList = watchlists.find((l) => l.id === overParsed.listId)
        if (!toList) return
        const toIndex = toList.items.findIndex((i) => i.symbol === overParsed.sym)
        moveTicker(activeParsed.sym, activeParsed.listId, overParsed.listId, Math.max(0, toIndex))
      }
      return
    }

    // item dragged over a list card container (drop onto empty list or list header)
    if (activeParsed.kind === 'item' && overParsed.kind === 'list') {
      const toListId = overParsed.id
      if (activeParsed.listId !== toListId) {
        const toList = watchlists.find((l) => l.id === toListId)
        const toIndex = toList ? toList.items.length : 0
        moveTicker(activeParsed.sym, activeParsed.listId, toListId, toIndex)
      }
    }
  }

  if (!authed) {
    return (
      <div style={{ flex: 1, overflow: 'auto', padding: 'var(--mpad,22px 26px)' }}>
        <div style={{ maxWidth: 480, margin: '48px auto 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center' }}>
          <span style={{ fontSize: '21px', fontWeight: 800, color: 'var(--tx)' }}>Your Watchlist</span>
          <span style={{ fontSize: '13.5px', color: 'var(--tx2)', lineHeight: 1.5 }}>Create a free account to build and manage your own watchlist — add tickers in bulk, set price targets, and track them across the app.</span>
          <button onClick={() => openAuth('signup')} style={{ height: 40, padding: '0 20px', borderRadius: 11, border: 'none', background: 'var(--accent)', color: 'var(--accentInk)', fontFamily: FONT_SANS, fontSize: '13.5px', fontWeight: 700, cursor: 'pointer' }}>Sign in / Sign up</button>
        </div>
      </div>
    )
  }

  const listCardIds = watchlists.map((l) => listId(l.id))

  // Flatten all items to get total count for StarterPicker hint
  const totalItems = watchlists.reduce((sum, l) => sum + l.items.length, 0)

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 'var(--mpad,22px 26px)' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Page header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: '21px', fontWeight: 800, letterSpacing: '-.02em', color: 'var(--tx)' }}>Manage Watchlists</span>
            <span style={{ fontSize: '13px', color: 'var(--tx2)' }}>
              {watchlists.length} list{watchlists.length === 1 ? '' : 's'} · {totalItems} ticker{totalItems === 1 ? '' : 's'} total
            </span>
          </div>

          {/* + New list button / upgrade gate */}
          {currentUser?.plan !== 'premium' && watchlists.length >= 1 ? (
            <button
              onClick={handleNewList}
              title="Upgrade for unlimited lists"
              style={{ height: 36, padding: '0 16px', borderRadius: 9, border: '1px solid var(--line2)', background: 'var(--cardHi)', color: 'var(--tx3)', fontFamily: FONT_SANS, fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}
            >
              🔒 New list
            </button>
          ) : (
            <button
              onClick={handleNewList}
              style={{ height: 36, padding: '0 16px', borderRadius: 9, border: 'none', background: 'var(--accent)', color: 'var(--accentInk)', fontFamily: FONT_SANS, fontSize: '13px', fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
            >
              + New list
            </button>
          )}
        </div>

        {/* Limit error banner */}
        {lastLimitError && (
          <div style={{ padding: '12px 16px', borderRadius: 10, background: 'var(--down)', color: '#fff', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <span>
              {lastLimitError === 'premium_required'
                ? '🔒 Multiple watchlists require a Premium plan.'
                : '🔒 You\'ve reached the free-plan ticker limit (10 tickers).'}
            </span>
            <button onClick={clearLimitError} style={{ background: 'transparent', border: 'none', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '14px' }}>✕</button>
          </div>
        )}

        {/* StarterPicker — show when no tickers at all */}
        {totalItems === 0 && <StarterPicker />}

        {/* Board of watchlist cards */}
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={onDragEnd}>
          <SortableContext items={listCardIds} strategy={verticalListSortingStrategy}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {watchlists.map((list) => (
                <WatchlistCard
                  key={list.id}
                  list={list}
                  totalLists={watchlists.length}
                  price={price}
                  chg={chg}
                  setSelected={setSelected}
                  setView={(v) => setView(v)}
                  updateWatch={updateWatch}
                  removeFromList={removeFromList}
                  renameList={renameList}
                  deleteList={deleteList}
                  addToList={addToList}
                  onShare={handleShare}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {/* Share status toast */}
        {sharingListId !== null && shareLabel !== 'Share' && (
          <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 500, padding: '12px 20px', borderRadius: 10, background: shareLabel === 'Copied!' ? 'var(--up)' : 'var(--card)', border: '1px solid var(--line)', boxShadow: '0 4px 16px rgba(0,0,0,.2)', color: shareLabel === 'Copied!' ? 'var(--accentInk)' : 'var(--tx)', fontFamily: FONT_SANS, fontSize: '13px', fontWeight: 600 }}>
            {shareLabel === 'Copied!' ? '✓ Link copied!' : 'Copying…'}
          </div>
        )}
      </div>
    </div>
  )
}
