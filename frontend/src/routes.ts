// Single source of truth mapping the store's view values to URL paths.
// Kept free of store imports so the store can import it without a cycle.
// (The view strings here must match the store's `View` union.)

export const VIEW_TO_PATH: Record<string, string> = {
  dashboard: '/dashboard',
  overview: '/at-a-glance',
  deep: '/deep-dive',
  market: '/market',
  map: '/map',
  sectors: '/sectors',
  crypto: '/crypto',
  screener: '/screener',
  strategy: '/strategy',
  holdings: '/holdings',
  alerts: '/alerts',
  settings: '/settings',
  managewatch: '/watchlist',
  earnings: '/earnings',
}

// Inverse: path → view. Built from VIEW_TO_PATH so the two never drift.
export const PATH_TO_VIEW: Record<string, string> = Object.fromEntries(
  Object.entries(VIEW_TO_PATH).map(([v, p]) => [p, v]),
)

// Views that should NOT be indexed (auth-only / personal).
export const NOINDEX_VIEWS = ['holdings', 'alerts', 'settings', 'managewatch']

export function pathForView(view: string): string {
  return VIEW_TO_PATH[view] ?? '/dashboard'
}

// Resolve a pathname to a view string, or null if not a known view path.
export function viewForPath(pathname: string): string | null {
  return PATH_TO_VIEW[pathname] ?? null
}

const SYM_RE = /^[A-Z0-9.\-]{1,12}$/

// Parse '/ticker/NVDA' → 'NVDA' (uppercased, validated), else null.
export function tickerForPath(pathname: string): string | null {
  const m = pathname.match(/^\/ticker\/([^/]+)\/?$/)
  if (!m) return null
  const sym = decodeURIComponent(m[1]).toUpperCase()
  return SYM_RE.test(sym) ? sym : null
}

export function isValidSymbol(sym: string): boolean {
  return SYM_RE.test(sym.toUpperCase())
}
