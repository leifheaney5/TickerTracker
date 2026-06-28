import { DOMAINS } from '../data/universe'

// Resolves the domain whose favicon represents a stock symbol, for the
// DuckDuckGo icon service. Order: an explicit override (the company website
// from fundamentals) wins, then the curated DOMAINS map. If neither is known
// we return null — the caller renders the monogram instead of guessing
// `<symbol>.com`, which produced wrong logos (e.g. WMT→wmt.com, an unrelated
// company) or placeholder icons (e.g. KO→ko.com).
export function resolveLogoDomain(symbol: string, override?: string): string | null {
  const bare = normalizeDomain(override)
  if (bare) return bare
  return DOMAINS[symbol] || null
}

// Strips scheme, leading www., and any path/query from a website URL, leaving
// the bare host. Returns null for empty/whitespace input.
function normalizeDomain(url?: string): string | null {
  const v = (url || '').trim()
  if (!v) return null
  return v
    .replace(/^[a-z]+:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/[/?#].*$/, '')
    .toLowerCase() || null
}
