// Zustand store — replaces the prototype's Component class state. Holds UI
// state (view/selection/chart controls) plus fetched market data, and exposes
// actions that call the API with graceful fallback to seeded values.

import { create } from 'zustand'
import { api, ApiError } from '../api/client'
import type {
  Quote, Bar, Fundamentals, NewsItem, Ratings, WatchlistItem, Settings, Holding,
  CryptoResponse, Fng, Timeframe, AuthUser, WatchlistWithItems, WatchlistItemFull,
  BillingState, EarningsRow, Pulse, PulsePoint, SignalAlerts,
} from '../api/types'
import { UNIVERSE, DEFAULT_WATCH } from '../data/universe'
import { reorderLists, moveItem, reorderWithinList, flattenActive } from './watchlistReducers'
import { pathForView } from '../routes'

function errStatus(e: unknown): number | null {
  const m = String((e as Error)?.message || '').match(/→\s*(\d+)/)
  return m ? Number(m[1]) : null
}

// ── URL routing bridge ───────────────────────────────────────────────────────
// The RouterBridge (rendered inside <BrowserRouter>) registers a navigate fn
// here so setView/setSelected can drive the URL. When it's unset (e.g. in unit
// tests, or before mount) the store falls back to plain state updates.
type Nav = (path: string, opts?: { replace?: boolean }) => void
let _navigate: Nav | null = null
let _syncingFromUrl = false  // guard: don't navigate while applying a URL change

export function registerNavigate(fn: Nav | null) { _navigate = fn }
export function applyFromUrl(fn: () => void) {
  _syncingFromUrl = true
  try { fn() } finally { _syncingFromUrl = false }
}

export type View =
  | 'dashboard' | 'overview' | 'deep' | 'market' | 'map' | 'sectors'
  | 'crypto' | 'screener' | 'strategy' | 'holdings' | 'alerts' | 'settings'
  | 'managewatch'

export type ChartType = 'candles' | 'line' | 'area'
export type SortBy = 'manual' | 'change' | 'price' | 'az'

// Module-level guard so the first-run watchlist seed runs at most once even if
// loadWatchlist is invoked twice (React StrictMode double-invokes effects).
let seedInFlight = false

// Symbols whose brand logo we've already requested this session (success or a
// confirmed "no logo"), so repeated polls don't re-hit /api/logos for them.
const logosAttempted = new Set<string>()

interface StoreState {
  // ── UI state (mirrors prototype state) ──
  view: View
  selected: string
  timeframe: Timeframe
  chartType: ChartType
  group: string
  compare: string[]
  sortBy: SortBy
  hover: number | null
  searchOpen: boolean
  search: string

  // ── data caches keyed by symbol ──
  quotes: Record<string, Quote>
  marketStatus: string
  history: Record<string, Bar[]> // key `${sym}:${tf}`
  fundamentals: Record<string, Fundamentals>
  logos: Record<string, string> // symbol → Finnhub brand-logo URL
  news: Record<string, NewsItem[]> // key sym or 'MARKET'
  newsLoaded: Record<string, boolean> // keys whose news fetch has completed
  ratings: Record<string, Ratings>
  pulse: Record<string, Pulse>
  pulseHistory: Record<string, PulsePoint[]>
  signalAlerts: Record<string, SignalAlerts>
  earnings: Record<string, EarningsRow | null>
  watchlist: WatchlistItem[]
  watchlists: WatchlistWithItems[]
  lastLimitError: 'free_limit' | 'premium_required' | null
  settings: Settings | null
  holdings: Holding[]
  billing: BillingState | null
  upgradePrompt: { feature: string; message: string } | null
  crypto: CryptoResponse | null
  cryptoLimit: 25 | 50 | 100
  fng: Fng | null
  flash: Record<string, 'up' | 'down' | null>
  quotesFetchedAt: string

  // ── actions ──
  setView: (v: View) => void
  setSelected: (s: string) => void
  setTimeframe: (tf: Timeframe) => void
  setChartType: (c: ChartType) => void
  setGroup: (g: string) => void
  setSortBy: (s: SortBy) => void
  setHover: (i: number | null) => void
  setSearchOpen: (b: boolean) => void
  setSearch: (q: string) => void
  toggleCompare: (sym: string) => void

  loadWatchlist: () => Promise<void>
  loadWatchlists: () => Promise<void>
  createList: (name: string) => Promise<boolean>
  renameList: (id: number, name: string) => Promise<void>
  deleteList: (id: number) => Promise<void>
  reorderListCards: (activeId: number, overId: number) => Promise<void>
  moveTicker: (sym: string, fromId: number, toId: number, toIndex: number) => Promise<void>
  reorderTicker: (listId: number, fromIndex: number, toIndex: number) => Promise<void>
  addToList: (listId: number, sym: string) => Promise<boolean>
  removeFromList: (listId: number, sym: string) => Promise<void>
  updateListWatch: (listId: number, sym: string, fields: Partial<WatchlistItemFull>) => Promise<void>
  clearLimitError: () => void
  loadSettings: () => Promise<void>
  updateSettings: (fields: Partial<Settings>) => Promise<void>
  loadHoldings: () => Promise<void>
  loadBilling: () => Promise<void>
  openUpgrade: (feature?: string, message?: string) => void
  closeUpgrade: () => void
  loadCrypto: () => Promise<void>
  setCryptoLimit: (n: 25 | 50 | 100) => Promise<void>
  cryptoWatchIds: () => string[]
  addCryptoWatch: (coin: { id: string; symbol: string; name: string }) => Promise<void>
  removeCryptoWatch: (id: string) => Promise<void>
  loadFng: () => Promise<void>
  pollQuotes: () => Promise<void>
  loadHistory: (sym: string, tf: Timeframe) => Promise<void>
  loadFundamentals: (sym: string) => Promise<void>
  loadLogos: (syms: string[]) => Promise<void>
  loadNews: (sym?: string) => Promise<void>
  loadRatings: (sym: string) => Promise<void>
  loadPulse: (sym: string) => Promise<void>
  loadPulseHistory: (sym: string) => Promise<void>
  loadSignalAlerts: (sym: string) => Promise<void>
  loadEarnings: (sym: string) => Promise<void>
  addWatch: (sym: string, target?: number) => Promise<void>
  removeWatch: (sym: string) => Promise<void>
  updateWatch: (sym: string, fields: Partial<WatchlistItem>) => Promise<void>

  // ── theme ──
  theme: 'dark' | 'light'
  setTheme: (t: 'dark' | 'light') => void

  // ── auth modal ──
  authModal: boolean
  authIntent: 'login' | 'signup'
  openAuth: (intent?: 'login' | 'signup') => void
  closeAuth: () => void

  // ── auth ──
  currentUser: AuthUser | null
  authChecked: boolean
  loadMe: () => Promise<void>
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>
  signup: (email: string, password: string, name?: string) => Promise<{ ok: boolean; error?: string }>
  logout: () => Promise<void>
  forgot: (email: string) => Promise<{ ok: boolean; error?: string }>
  reset: (token: string, password: string) => Promise<{ ok: boolean; error?: string }>

  // ── selectors ──
  price: (sym: string) => number
  chg: (sym: string) => number
  // True once a LIVE quote has loaded for the symbol. Display sites gate on
  // this to show a skeleton instead of a fabricated number; price()/chg()
  // return 0 when false, which is safe for math but must never be shown.
  hasQuote: (sym: string) => boolean
  watchSymbols: () => string[]
}

export const useStore = create<StoreState>((set, get) => ({
  view: 'dashboard',
  selected: 'NVDA',
  timeframe: '3M',
  chartType: 'candles',
  group: 'All',
  compare: [],
  sortBy: 'manual',
  hover: null,
  searchOpen: false,
  search: '',

  quotes: {},
  marketStatus: 'Unknown',
  history: {},
  fundamentals: {},
  logos: {},
  news: {},
  newsLoaded: {},
  ratings: {},
  pulse: {},
  pulseHistory: {},
  signalAlerts: {},
  earnings: {},
  watchlist: [],
  watchlists: [],
  lastLimitError: null,
  settings: null,
  holdings: [],
  billing: null,
  upgradePrompt: null,
  crypto: null,
  cryptoLimit: 50,
  fng: null,
  flash: {},
  quotesFetchedAt: '',

  theme: (typeof localStorage !== 'undefined'
    ? (localStorage.getItem('tt_theme') as 'dark' | 'light') || 'dark'
    : 'dark'),
  setTheme: (t) => {
    if (typeof localStorage !== 'undefined') localStorage.setItem('tt_theme', t)
    set({ theme: t })
  },

  authModal: false,
  authIntent: 'login',
  openAuth: (intent = 'login') => set({ authModal: true, authIntent: intent }),
  closeAuth: () => set({ authModal: false }),

  currentUser: null,
  authChecked: false,
  loadMe: async () => {
    try {
      const r = await fetch('/api/auth/me', { credentials: 'include' })
      const j = await r.json()
      set({ currentUser: j.user ?? null, authChecked: true })
    } catch { set({ authChecked: true }) }
  },
  login: async (email, password) => {
    const r = await fetch('/api/auth/login', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })
    if (!r.ok) { const j = await r.json().catch(() => ({})); return { ok: false, error: j.error || 'Login failed' } }
    const j = await r.json(); set({ currentUser: j.user ?? null })
    // Re-fetch personalized data so the newly-logged-in user sees their own
    // watchlist/settings/holdings without a page reload.
    await get().loadWatchlist(); await get().loadWatchlists(); await get().loadSettings(); await get().loadHoldings(); await get().loadBilling()
    return { ok: true }
  },
  signup: async (email, password, name) => {
    const r = await fetch('/api/auth/signup', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, name }) })
    const j = await r.json().catch(() => ({}))
    // Intentionally does NOT set currentUser — email verification is required
    // before login. The backend signup route does not create a session.
    return r.ok ? { ok: true } : { ok: false, error: j.error || 'Signup failed' }
  },
  logout: async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    set({ currentUser: null, watchlist: [], holdings: [], settings: null, billing: null })
  },
  forgot: async (email) => {
    const r = await fetch('/api/auth/forgot', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) })
    // Backend is enumeration-safe and always returns 200; treat any 200 as ok.
    return r.ok ? { ok: true } : { ok: false, error: 'Request failed' }
  },
  reset: async (token, password) => {
    const r = await fetch('/api/auth/reset', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, password }) })
    if (!r.ok) { const j = await r.json().catch(() => ({})); return { ok: false, error: j.error || 'Reset failed' } }
    return { ok: true }
  },

  setView: (v) => {
    set({ view: v })
    if (!_syncingFromUrl && _navigate) _navigate(pathForView(v))
  },
  setSelected: (s) => {
    set({ selected: s, hover: null, compare: [] })
    // Selecting a ticker navigates to its dedicated page + the dashboard view.
    if (!_syncingFromUrl && _navigate) {
      set({ view: 'dashboard' })
      _navigate(`/ticker/${encodeURIComponent(s)}`)
    }
  },
  setTimeframe: (tf) => set({ timeframe: tf, hover: null }),
  setChartType: (c) => set({ chartType: c }),
  setGroup: (g) => set({ group: g }),
  setSortBy: (s) => set({ sortBy: s }),
  setHover: (i) => set({ hover: i }),
  setSearchOpen: (b) => set({ searchOpen: b }),
  setSearch: (q) => set({ search: q }),
  toggleCompare: (sym) => {
    const st = get()
    if (st.compare.includes(sym)) {
      set({ compare: st.compare.filter((x) => x !== sym) })
      return
    }
    const cap = st.billing?.limits.compare ?? 2
    if (st.compare.length >= cap) {
      get().openUpgrade('compare',
        `Free plan compares up to ${cap} stocks at once. Upgrade to Pro to compare up to 10.`)
      return
    }
    set({ compare: [...st.compare, sym] })
  },

  loadWatchlist: async () => {
    // Guard against concurrent/double invocation (React StrictMode) so the
    // first-run seed can't run twice.
    if (seedInFlight) return
    seedInFlight = true
    try {
      const { data } = await api.getWatchlist()
      if (data.length === 0) {
        // First run: seed the server with the default watchlist (sequentially;
        // add_watch upserts by symbol so this is idempotent).
        for (let i = 0; i < DEFAULT_WATCH.length; i++) {
          await api.addWatch({ symbol: DEFAULT_WATCH[i], target: UNIVERSE[DEFAULT_WATCH[i]]?.target ?? 0 })
        }
        const seeded = await api.getWatchlist()
        set({ watchlist: seeded.data })
      } else {
        set({ watchlist: data })
      }
    } catch {
      // offline fallback: synthesize from defaults
      set({
        watchlist: DEFAULT_WATCH.map((symbol, i) => ({
          symbol, position: i, target: UNIVERSE[symbol]?.target ?? 0,
          alert_price: 0, alert_dir: 'above' as const, alert_active: false,
          kind: 'stock' as const,
        })),
      })
    }
  },

  loadWatchlists: async () => {
    try {
      const { data } = await api.getWatchlists()
      set({ watchlists: data, watchlist: flattenActive(data) })
    } catch { /* offline: keep existing */ }
  },
  createList: async (name) => {
    try {
      await api.createWatchlist(name)
      await get().loadWatchlists()
      return true
    } catch (e) {
      if (errStatus(e) === 402) set({ lastLimitError: 'premium_required' })
      return false
    }
  },
  renameList: async (id, name) => {
    set((st) => ({ watchlists: st.watchlists.map((l) => (l.id === id ? { ...l, name } : l)) }))
    try { await api.patchWatchlist(id, { name }) } catch { /* keep optimistic */ }
  },
  deleteList: async (id) => {
    try {
      await api.deleteWatchlist(id)
      await get().loadWatchlists()
    } catch { /* last_list 409: surface via reload (button disabled in UI) */ }
  },
  reorderListCards: async (activeId, overId) => {
    const next = reorderLists(get().watchlists, activeId, overId)
    set({ watchlists: next, watchlist: flattenActive(next) })
    const list = next.find((l) => l.id === activeId)
    if (list) { try { await api.patchWatchlist(activeId, { position: list.position }) } catch { await get().loadWatchlists() } }
  },
  moveTicker: async (sym, fromId, toId, toIndex) => {
    const prev = get().watchlists
    const next = moveItem(prev, sym, fromId, toId, toIndex)
    set({ watchlists: next, watchlist: flattenActive(next) })
    try {
      await api.patchListItem(fromId, sym, { watchlist_id: toId, position: toIndex })
    } catch { set({ watchlists: prev, watchlist: flattenActive(prev) }) }
  },
  reorderTicker: async (listId, fromIndex, toIndex) => {
    const prev = get().watchlists
    const next = reorderWithinList(prev, listId, fromIndex, toIndex)
    set({ watchlists: next, watchlist: flattenActive(next) })
    const item = next.find((l) => l.id === listId)?.items[toIndex]
    if (item) { try { await api.patchListItem(listId, item.symbol, { position: toIndex }) } catch { set({ watchlists: prev, watchlist: flattenActive(prev) }) } }
  },
  addToList: async (listId, sym) => {
    try {
      await api.addListItem(listId, { symbol: sym })
      await get().loadWatchlists()
      return true
    } catch (e) {
      if (errStatus(e) === 402) set({ lastLimitError: 'free_limit' })
      return false
    }
  },
  removeFromList: async (listId, sym) => {
    set((st) => ({ watchlists: st.watchlists.map((l) => (l.id === listId ? { ...l, items: l.items.filter((i) => i.symbol !== sym) } : l)) }))
    try { await api.removeListItem(listId, sym) } catch { /* ignore */ }
    set((st) => ({ watchlist: flattenActive(st.watchlists) }))
  },
  updateListWatch: async (listId, sym, fields) => {
    const prev = get().watchlists
    const next = prev.map((l) => l.id === listId
      ? { ...l, items: l.items.map((i) => (i.symbol === sym ? { ...i, ...fields } : i)) }
      : l)
    set({ watchlists: next, watchlist: flattenActive(next) })
    try { await api.patchListItem(listId, sym, fields) }
    catch { set({ watchlists: prev, watchlist: flattenActive(prev) }) }
  },
  clearLimitError: () => set({ lastLimitError: null }),

  loadSettings: async () => {
    try {
      const { data } = await api.getSettings()
      set({ settings: data })
    } catch {
      set({
        settings: {
          broker_connected: false, broker_name: '', live_updates: true,
          alert_notifs: true, news_digest: false, hide_balances: false, currency: 'USD',
        },
      })
    }
  },

  updateSettings: async (fields) => {
    set((st) => ({ settings: st.settings ? { ...st.settings, ...fields } : st.settings }))
    try {
      const { data } = await api.updateSettings(fields)
      set({ settings: data })
    } catch { /* keep optimistic value offline */ }
  },

  loadHoldings: async () => {
    try {
      const { data } = await api.getHoldings()
      set({ holdings: data })
    } catch { /* leave empty */ }
  },

  loadBilling: async () => {
    try {
      const { data } = await api.getBilling()
      set({ billing: data })
    } catch { /* anonymous or offline: leave null */ }
  },

  openUpgrade: (feature = 'pro', message = '') =>
    set({ upgradePrompt: { feature, message } }),
  closeUpgrade: () => set({ upgradePrompt: null }),

  loadCrypto: async () => {
    try {
      const { data } = await api.crypto(get().cryptoLimit, get().cryptoWatchIds())
      set({ crypto: data })
    } catch { /* leave null */ }
  },

  setCryptoLimit: async (n) => {
    set({ cryptoLimit: n })
    await get().loadCrypto()
  },

  cryptoWatchIds: () =>
    get().watchlist.filter((w) => w.kind === 'crypto').map((w) => w.symbol),

  addCryptoWatch: async (coin) => {
    try {
      await api.addWatch({ symbol: coin.id, kind: 'crypto', coin_name: coin.name })
      const { data } = await api.getWatchlist()
      set({ watchlist: data })
      await get().loadCrypto()   // surface a newly-added off-top-N coin
    } catch { /* ignore offline */ }
  },

  removeCryptoWatch: async (id) => {
    try {
      await api.removeWatch(id)
      set((st) => ({ watchlist: st.watchlist.filter((w) => w.symbol !== id) }))
    } catch { /* ignore */ }
  },

  loadFng: async () => {
    try {
      const { data } = await api.fng()
      set({ fng: data })
    } catch { /* leave null */ }
  },

  pollQuotes: async () => {
    const syms = get().watchSymbols()
    const selected = get().selected
    const all = Array.from(new Set([...syms, selected])).filter(Boolean)
    if (!all.length) return
    // Fire-and-forget: ensure brand logos exist for everything currently visible.
    get().loadLogos(all)
    try {
      const { data, fetchedAt } = await api.quotes(all)
      const prev = get().quotes
      const flash: Record<string, 'up' | 'down' | null> = {}
      for (const sym of Object.keys(data.quotes)) {
        const old = prev[sym]?.price
        const now = data.quotes[sym].price
        flash[sym] = old === undefined ? null : now > old ? 'up' : now < old ? 'down' : null
      }
      set({ quotes: { ...prev, ...data.quotes }, marketStatus: data.market_status, flash, quotesFetchedAt: fetchedAt })
      // clear flash after the prototype's ~650ms window
      setTimeout(() => set({ flash: {} }), 650)
    } catch {
      // keep last-known quotes; symbols without one render a skeleton (hasQuote=false)
    }
  },

  loadHistory: async (sym, tf) => {
    const key = `${sym}:${tf}`
    if (get().history[key]) return
    try {
      const { data } = await api.history(sym, tf)
      set((st) => ({ history: { ...st.history, [key]: data } }))
    } catch {
      /* no history → chart renders a skeleton until a later load succeeds */
    }
  },

  loadFundamentals: async (sym) => {
    if (get().fundamentals[sym]) return
    try {
      const { data } = await api.fundamentals(sym)
      set((st) => ({ fundamentals: { ...st.fundamentals, [sym]: data } }))
    } catch { /* no fundamentals → cells render a skeleton until a later load succeeds */ }
  },

  loadLogos: async (syms) => {
    // Fetch brand logos only for symbols we haven't tried yet (logos are stable,
    // so one attempt per symbol per session is enough; the backend caches too).
    const fresh = Array.from(new Set(syms)).filter((s) => s && !logosAttempted.has(s))
    if (!fresh.length) return
    fresh.forEach((s) => logosAttempted.add(s))
    try {
      const { data } = await api.logos(fresh)
      set((st) => ({ logos: { ...st.logos, ...data } }))
    } catch {
      // On failure, allow a later retry and let Logo fall back to favicon/monogram.
      fresh.forEach((s) => logosAttempted.delete(s))
    }
  },

  loadNews: async (sym) => {
    const key = sym || 'MARKET'
    if (get().newsLoaded[key]) return // already fetched (even if it returned 0 items)
    try {
      const { data } = await api.news(sym)
      set((st) => ({
        news: { ...st.news, [key]: data },
        newsLoaded: { ...st.newsLoaded, [key]: true },
      }))
    } catch {
      // mark loaded so the UI shows an empty state, not a perpetual spinner
      set((st) => ({ newsLoaded: { ...st.newsLoaded, [key]: true } }))
    }
  },

  loadRatings: async (sym) => {
    if (get().ratings[sym]) return
    try {
      const { data } = await api.ratings(sym)
      set((st) => ({ ratings: { ...st.ratings, [sym]: data } }))
    } catch { /* leave empty */ }
  },

  loadPulse: async (sym) => {
    if (get().pulse[sym]) return
    try {
      const { data } = await api.pulse(sym)
      set((st) => ({ pulse: { ...st.pulse, [sym]: data } }))
    } catch { /* leave unset — the dial simply doesn't render */ }
  },

  loadPulseHistory: async (sym) => {
    if (get().pulseHistory[sym]) return
    try {
      const { data } = await api.pulseHistory(sym)
      set((st) => ({ pulseHistory: { ...st.pulseHistory, [sym]: data } }))
    } catch { /* leave unset — the trend simply doesn't render */ }
  },

  loadSignalAlerts: async (sym) => {
    if (get().signalAlerts[sym]) return
    try {
      const { data } = await api.signalAlerts(sym)
      set((st) => ({ signalAlerts: { ...st.signalAlerts, [sym]: data } }))
    } catch { /* leave unset — no chips render */ }
  },

  loadEarnings: async (sym) => {
    if (get().earnings[sym] !== undefined) return
    try {
      const { data } = await api.earnings([sym])
      set((st) => ({ earnings: { ...st.earnings, [sym]: data[0] ?? null } }))
    } catch { /* leave unset → card shows loading/empty */ }
  },

  addWatch: async (sym, target = 0) => {
    try {
      await api.addWatch({ symbol: sym, target })
      const { data } = await api.getWatchlist()
      set({ watchlist: data })
    } catch (e) {
      if (e instanceof ApiError && e.status === 402) {
        get().openUpgrade(e.body?.feature ?? 'watchlist', e.body?.message ?? '')
      }
      // otherwise ignore (offline)
    }
  },

  removeWatch: async (sym) => {
    try {
      await api.removeWatch(sym)
      set((st) => ({ watchlist: st.watchlist.filter((w) => w.symbol !== sym) }))
    } catch { /* ignore */ }
  },

  updateWatch: async (sym, fields) => {
    // Optimistic local update, then persist.
    const prev = get().watchlist
    set((st) => ({
      watchlist: st.watchlist.map((w) => (w.symbol === sym ? { ...w, ...fields } : w)),
    }))
    try {
      await api.updateWatch(sym, fields)
    } catch (e) {
      if (e instanceof ApiError && e.status === 402) {
        set({ watchlist: prev }) // roll back optimistic change
        get().openUpgrade(e.body?.feature ?? 'alerts', e.body?.message ?? '')
      }
      // otherwise keep optimistic value (offline)
    }
  },

  // Live-only: no UNIVERSE seed fallback. Returns 0 when no quote has loaded so
  // dependent math stays defined, but callers MUST gate display on hasQuote()
  // and render a <Skeleton> instead — never show this 0 as a real price.
  price: (sym) => get().quotes[sym]?.price ?? 0,
  chg: (sym) => get().quotes[sym]?.change_pct ?? 0,
  hasQuote: (sym) => get().quotes[sym]?.price != null,
  // Effective symbols shown to the user: the authed user's saved watchlist, or
  // the read-only demo list when anonymous. Used by the cards, quote polling,
  // the movers ribbon, and At-a-Glance so anonymous users get LIVE prices too
  // (not stale seed values).
  watchSymbols: () => {
    const st = get()
    if (st.currentUser && st.watchlist.length) {
      return st.watchlist.slice().sort((a, b) => a.position - b.position).map((w) => w.symbol)
    }
    return DEFAULT_WATCH.slice()
  },
}))

export const isAuthed = (s: { currentUser: AuthUser | null }) => s.currentUser !== null
