import { useState, useRef, useEffect, useCallback } from 'react'
import { toPng } from 'html-to-image'
import QRCode from 'qrcode'
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
import { Skeleton } from '../components/Skeleton'
import { money, pct } from '../lib/format'
import { api } from '../api/client'
import type { WatchlistWithItems, WatchlistItemFull } from '../api/types'
import { ShareCard } from '../components/ShareCard'
import { Sparkline } from '../charts/Sparkline'
import { dailyChangeDollar } from '../lib/dailyChg'
import { useToastStore } from '../state/toastStore'

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
  // quotes subscribed at ManageWatchlist level so rows re-render on price updates
  quotes: Record<string, { price: number }>
  setSelected: (s: string) => void
  setView: (v: 'dashboard') => void
  updateListWatch: (listId: number, s: string, f: Partial<WatchlistItemFull>) => void
  removeFromList: (listId: number, sym: string) => void
}

function TickerRow({
  item,
  listId: lid,
  price,
  chg,
  quotes: _quotes,
  setSelected,
  setView,
  updateListWatch,
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
  const live = useStore((s) => s.hasQuote(item.symbol))
  const c = chg(item.symbol)
  const up = c >= 0
  const chgDollar = dailyChangeDollar(price(item.symbol), c)

  const saveTarget = (sym: string) => {
    const v = parseFloat(editVal)
    if (!isNaN(v)) updateListWatch(lid, sym, { target: v })
    setEditSym(null)
  }

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        display: 'grid',
        gridTemplateColumns: '28px minmax(140px,1.6fr) 100px 80px 76px 90px 140px 170px 80px',
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
        {live ? money(price(item.symbol)) : <Skeleton inline width={56} height={12} />}
      </div>

      {/* 24h % */}
      <div style={{ padding: '12px 14px', fontFamily: FONT_MONO, fontSize: '12px', fontWeight: 600, color: live ? (up ? 'var(--up)' : 'var(--down)') : undefined }}>
        {live ? pct(c) : <Skeleton inline width={40} height={11} />}
      </div>

      {/* CHG $ */}
      <div data-testid={`chg-dollar-${item.symbol}`} style={{ padding: '12px 8px', fontFamily: FONT_MONO, fontSize: '12px', fontWeight: 600, color: live ? (chgDollar >= 0 ? 'var(--up)' : 'var(--down)') : undefined }}>
        {live ? (chgDollar >= 0 ? '+' : '') + money(chgDollar) : <Skeleton inline width={44} height={11} />}
      </div>

      {/* Sparkline */}
      <div data-testid={`sparkline-${item.symbol}`} style={{ padding: '8px 8px' }}>
        <Sparkline symbol={item.symbol} width={80} height={28} />
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
      <div style={{ padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: 5 }}>
        {/* direction toggle — above / below */}
        <div role="group" aria-label={`Alert direction for ${item.symbol}`} style={{ display: 'flex', gap: 3 }}>
          <button
            type="button"
            aria-pressed={item.alert_dir === 'above'}
            data-testid={`alert-dir-above-${item.symbol}`}
            disabled={item.locked}
            onClick={() => !item.locked && updateListWatch(lid, item.symbol, { alert_dir: 'above' })}
            style={{
              height: 22, padding: '0 7px', borderRadius: 5, border: 'none',
              cursor: item.locked ? 'default' : 'pointer',
              fontSize: '10.5px', fontWeight: 700, fontFamily: FONT_SANS,
              background: item.alert_dir === 'above' ? 'var(--up)' : 'var(--cardHi)',
              color: item.alert_dir === 'above' ? 'var(--accentInk)' : 'var(--tx3)',
              opacity: item.locked ? 0.5 : 1,
            }}
          >
            ↑ Above
          </button>
          <button
            type="button"
            aria-pressed={item.alert_dir === 'below'}
            data-testid={`alert-dir-below-${item.symbol}`}
            disabled={item.locked}
            onClick={() => !item.locked && updateListWatch(lid, item.symbol, { alert_dir: 'below' })}
            style={{
              height: 22, padding: '0 7px', borderRadius: 5, border: 'none',
              cursor: item.locked ? 'default' : 'pointer',
              fontSize: '10.5px', fontWeight: 700, fontFamily: FONT_SANS,
              background: item.alert_dir === 'below' ? 'var(--down)' : 'var(--cardHi)',
              color: item.alert_dir === 'below' ? 'var(--accentInk)' : 'var(--tx3)',
              opacity: item.locked ? 0.5 : 1,
            }}
          >
            ↓ Below
          </button>
        </div>
        {/* price input + active toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <input
            title="Set price alert"
            aria-label={`Alert price for ${item.symbol}`}
            type="number"
            placeholder="$"
            defaultValue={item.alert_price || ''}
            disabled={item.locked}
            onBlur={(e) => !item.locked && updateListWatch(lid, item.symbol, { alert_price: parseFloat(e.target.value) || 0 })}
            style={{ width: 60, height: 26, padding: '0 6px', borderRadius: 7, border: '1px solid var(--line2)', background: 'var(--bg)', color: 'var(--tx)', fontFamily: FONT_MONO, fontSize: '12px', opacity: item.locked ? 0.5 : 1 }}
          />
          <button
            onClick={() => !item.locked && updateListWatch(lid, item.symbol, { alert_active: !item.alert_active })}
            disabled={item.locked}
            title={item.alert_active ? 'Alert on' : 'Alert off'}
            aria-label={`Toggle price alert for ${item.symbol}`}
            style={{ height: 26, padding: '0 7px', borderRadius: 7, border: 'none', cursor: item.locked ? 'default' : 'pointer', fontSize: '11px', fontWeight: 700, background: item.alert_active ? 'var(--up)' : 'var(--cardHi)', color: item.alert_active ? 'var(--accentInk)' : 'var(--tx3)' }}
          >
            {item.alert_active ? 'ON' : 'OFF'}
          </button>
        </div>
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
  quotes: Record<string, { price: number }>
  setSelected: (s: string) => void
  setView: (v: 'dashboard') => void
  updateListWatch: (listId: number, s: string, f: Partial<WatchlistItemFull>) => void
  removeFromList: (listId: number, sym: string) => void
  renameList: (id: number, name: string) => void
  deleteList: (id: number) => void
  addToList: (listId: number, sym: string) => Promise<boolean>
  onCopyLink: (list: WatchlistWithItems) => void
  onDownloadImage: (list: WatchlistWithItems) => void
}

function WatchlistCard({
  list,
  totalLists,
  price,
  chg,
  quotes,
  setSelected,
  setView,
  updateListWatch,
  removeFromList,
  renameList,
  deleteList,
  addToList,
  onCopyLink,
  onDownloadImage,
}: WatchlistCardProps) {
  const [renaming, setRenaming] = useState(false)
  const [renameVal, setRenameVal] = useState(list.name)
  const [menuOpen, setMenuOpen] = useState(false)
  const [addSym, setAddSym] = useState('')
  const [addError, setAddError] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close the ⋯ menu on any click outside it.
  useEffect(() => {
    if (!menuOpen) return
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [menuOpen])

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
            >
              <button
                onClick={() => { setRenameVal(list.name); setRenaming(true); setMenuOpen(false) }}
                style={menuItemStyle}
              >
                Rename
              </button>
              <button
                onClick={() => { onCopyLink(list); setMenuOpen(false) }}
                style={menuItemStyle}
              >
                Copy link
              </button>
              <button
                onClick={() => { onDownloadImage(list); setMenuOpen(false) }}
                style={menuItemStyle}
              >
                Download image
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
        <div style={{ minWidth: 780 }}>
          {/* column headers */}
          <div style={{ display: 'grid', gridTemplateColumns: '28px minmax(140px,1.6fr) 100px 80px 76px 90px 140px 170px 80px', background: 'var(--panel)', borderBottom: '1px solid var(--line)' }}>
            {['', 'TICKER', 'PRICE', '24H', 'CHG $', 'CHART', 'TARGET', 'ALERT', ''].map((h, i) => (
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
                quotes={quotes}
                setSelected={setSelected}
                setView={setView}
                updateListWatch={updateListWatch}
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
  const price = useStore((s) => s.price)
  const chg = useStore((s) => s.chg)
  // Subscribe to quotes so rows re-render on price updates (Zustand gotcha:
  // selecting s.price fn-ref alone wouldn't trigger a re-render on quote changes).
  const quotes = useStore((s) => s.quotes)
  const setSelected = useStore((s) => s.setSelected)
  const setView = useStore((s) => s.setView)
  const updateListWatch = useStore((s) => s.updateListWatch)
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
  const pushToast = useToastStore((s) => s.pushToast)
  // Download-image state: which list is being snapshotted + its QR data URL
  const [downloadList, setDownloadList] = useState<WatchlistWithItems | null>(null)
  const [downloadQr, setDownloadQr] = useState<string>('')
  const cardRef = useRef<HTMLDivElement>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleCopyLink = async (list: WatchlistWithItems) => {
    try {
      const res = await api.shareList(list.id)
      const url = `${location.origin}/s/${res.data.token}`
      await navigator.clipboard.writeText(url)
      pushToast('Link copied!', { kind: 'success' })
    } catch {
      // ignore — clipboard permission denied or API error
    }
  }

  const handleDownloadImage = useCallback(async (list: WatchlistWithItems) => {
    try {
      const res = await api.shareList(list.id)
      const link = `${location.origin}/s/${res.data.token}`
      const qr = await QRCode.toDataURL(link)
      setDownloadQr(qr)
      setDownloadList(list)
      // Wait a tick for the card to render into the DOM
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
      if (!cardRef.current) return
      const dataUrl = await toPng(cardRef.current, { pixelRatio: 2, cacheBust: true })
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = `${list.name.replace(/\s+/g, '-').toLowerCase()}-watchlist.png`
      a.click()
    } finally {
      setDownloadList(null)
      setDownloadQr('')
    }
  }, [])

  const handleNewList = async () => {
    // Attempt to create; the backend is the source of truth on plan limits and
    // returns 402 when a free (billing-enforced) user already has a list — the
    // store turns that into lastLimitError, which renders the upgrade banner.
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

          {/* + New list button (backend enforces plan limits → 402 → banner) */}
          <button
            onClick={handleNewList}
            style={{ height: 36, padding: '0 16px', borderRadius: 9, border: 'none', background: 'var(--accent)', color: 'var(--accentInk)', fontFamily: FONT_SANS, fontSize: '13px', fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
          >
            + New list
          </button>
        </div>

        {/* Limit error banner */}
        {lastLimitError && (
          <div style={{ padding: '12px 16px', borderRadius: 10, background: 'var(--cardHi)', border: '1px solid var(--line2)', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ color: 'var(--tx)', flex: 1 }}>
              {lastLimitError === 'premium_required'
                ? 'Multiple watchlists are a premium feature. Upgrade to create more.'
                : 'Free watchlists hold 15 tickers. Upgrade to Pro for unlimited.'}
            </span>
            <a
              href="#pricing"
              style={{ flexShrink: 0, height: 30, padding: '0 14px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: 'var(--accentInk)', fontFamily: FONT_SANS, fontSize: '12.5px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}
            >
              Upgrade
            </a>
            <button onClick={clearLimitError} aria-label="Dismiss" style={{ flexShrink: 0, background: 'transparent', border: 'none', color: 'var(--tx2)', fontWeight: 700, cursor: 'pointer', fontSize: '16px', lineHeight: 1, padding: '0 2px' }}>✕</button>
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
                  quotes={quotes}
                  setSelected={setSelected}
                  setView={(v) => setView(v)}
                  updateListWatch={updateListWatch}
                  removeFromList={removeFromList}
                  renameList={renameList}
                  deleteList={deleteList}
                  addToList={addToList}
                  onCopyLink={handleCopyLink}
                  onDownloadImage={handleDownloadImage}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {/* Off-screen ShareCard for PNG snapshot */}
        {downloadList && (
          <ShareCard
            ref={cardRef}
            list={downloadList}
            qrDataUrl={downloadQr}
            quote={(sym) => ({ price: price(sym), pct: chg(sym) })}
          />
        )}
      </div>
    </div>
  )
}
