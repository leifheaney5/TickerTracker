// Zustand store — replaces the prototype's Component class state. Holds UI
// state (view/selection/chart controls) plus fetched market data, and exposes
// actions that call the API with graceful fallback to seeded values.

import { create } from 'zustand'
import { api } from '../api/client'
import type {
  Quote, Bar, Fundamentals, NewsItem, Ratings, WatchlistItem, Settings, Timeframe,
} from '../api/types'
import { UNIVERSE, DEFAULT_WATCH } from '../data/universe'

export type View =
  | 'dashboard' | 'overview' | 'deep' | 'market' | 'map' | 'sectors'
  | 'crypto' | 'screener' | 'strategy' | 'holdings' | 'alerts' | 'settings'

export type ChartType = 'candles' | 'line' | 'area'
export type SortBy = 'manual' | 'change' | 'price' | 'az'

// Module-level guard so the first-run watchlist seed runs at most once even if
// loadWatchlist is invoked twice (React StrictMode double-invokes effects).
let seedInFlight = false

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
  news: Record<string, NewsItem[]> // key sym or 'MARKET'
  ratings: Record<string, Ratings>
  watchlist: WatchlistItem[]
  settings: Settings | null
  flash: Record<string, 'up' | 'down' | null>

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
  loadSettings: () => Promise<void>
  pollQuotes: () => Promise<void>
  loadHistory: (sym: string, tf: Timeframe) => Promise<void>
  loadFundamentals: (sym: string) => Promise<void>
  loadNews: (sym?: string) => Promise<void>
  loadRatings: (sym: string) => Promise<void>
  addWatch: (sym: string, target?: number) => Promise<void>
  removeWatch: (sym: string) => Promise<void>

  // ── selectors ──
  price: (sym: string) => number
  chg: (sym: string) => number
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
  news: {},
  ratings: {},
  watchlist: [],
  settings: null,
  flash: {},

  setView: (v) => set({ view: v }),
  setSelected: (s) => set({ selected: s, hover: null, compare: [] }),
  setTimeframe: (tf) => set({ timeframe: tf, hover: null }),
  setChartType: (c) => set({ chartType: c }),
  setGroup: (g) => set({ group: g }),
  setSortBy: (s) => set({ sortBy: s }),
  setHover: (i) => set({ hover: i }),
  setSearchOpen: (b) => set({ searchOpen: b }),
  setSearch: (q) => set({ search: q }),
  toggleCompare: (sym) =>
    set((st) => {
      if (st.compare.includes(sym)) return { compare: st.compare.filter((x) => x !== sym) }
      if (st.compare.length >= 4) return {}
      return { compare: [...st.compare, sym] }
    }),

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
          alert_price: 0, alert_dir: 'above' as const,
        })),
      })
    }
  },

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

  pollQuotes: async () => {
    const syms = get().watchSymbols()
    const selected = get().selected
    const all = Array.from(new Set([...syms, selected])).filter(Boolean)
    if (!all.length) return
    try {
      const { data } = await api.quotes(all)
      const prev = get().quotes
      const flash: Record<string, 'up' | 'down' | null> = {}
      for (const sym of Object.keys(data.quotes)) {
        const old = prev[sym]?.price
        const now = data.quotes[sym].price
        flash[sym] = old === undefined ? null : now > old ? 'up' : now < old ? 'down' : null
      }
      set({ quotes: { ...prev, ...data.quotes }, marketStatus: data.market_status, flash })
      // clear flash after the prototype's ~650ms window
      setTimeout(() => set({ flash: {} }), 650)
    } catch {
      // keep last-known quotes; selectors fall back to UNIVERSE
    }
  },

  loadHistory: async (sym, tf) => {
    const key = `${sym}:${tf}`
    if (get().history[key]) return
    try {
      const { data } = await api.history(sym, tf)
      set((st) => ({ history: { ...st.history, [key]: data } }))
    } catch {
      /* chart uses fallbackSeries */
    }
  },

  loadFundamentals: async (sym) => {
    if (get().fundamentals[sym]) return
    try {
      const { data } = await api.fundamentals(sym)
      set((st) => ({ fundamentals: { ...st.fundamentals, [sym]: data } }))
    } catch { /* uses UNIVERSE */ }
  },

  loadNews: async (sym) => {
    const key = sym || 'MARKET'
    if (get().news[key]) return
    try {
      const { data } = await api.news(sym)
      set((st) => ({ news: { ...st.news, [key]: data } }))
    } catch { /* leave empty */ }
  },

  loadRatings: async (sym) => {
    if (get().ratings[sym]) return
    try {
      const { data } = await api.ratings(sym)
      set((st) => ({ ratings: { ...st.ratings, [sym]: data } }))
    } catch { /* leave empty */ }
  },

  addWatch: async (sym, target = 0) => {
    try {
      await api.addWatch({ symbol: sym, target })
      const { data } = await api.getWatchlist()
      set({ watchlist: data })
    } catch { /* ignore offline */ }
  },

  removeWatch: async (sym) => {
    try {
      await api.removeWatch(sym)
      set((st) => ({ watchlist: st.watchlist.filter((w) => w.symbol !== sym) }))
    } catch { /* ignore */ }
  },

  price: (sym) => get().quotes[sym]?.price ?? UNIVERSE[sym]?.price ?? 0,
  chg: (sym) => get().quotes[sym]?.change_pct ?? UNIVERSE[sym]?.dchg ?? 0,
  watchSymbols: () => get().watchlist.slice().sort((a, b) => a.position - b.position).map((w) => w.symbol),
}))
