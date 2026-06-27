# URL Routing Design — real per-page URLs

**Status:** Design for review (not yet implemented). The interim `/?sym=NVDA`
deep-link is already shipped; this replaces it with proper routes.

## Problem

The app is a single-page app with **no routing** — every view lives at
`tickertracker.info`, driven by the Zustand store's `view` + `selected` state.
Consequences:

- Can't bookmark or share a page (e.g. send someone the Earnings view or a
  specific ticker).
- Browser **back/forward buttons don't work** between views.
- Email/SEO **deep-links are clumsy** (the alert-email "always shows NVDA" bug).
- No per-page URLs for search engines to index.

## Goal

Give every view and selected ticker a real URL, with working history, while
**not rewriting all 12 view files**. Standard, shareable, bookmarkable URLs.

## URL scheme

| Route | View | Notes |
|---|---|---|
| `/` | redirect → `/dashboard` | |
| `/dashboard` | Dashboard | selected ticker via `/ticker/:sym` (below) |
| `/ticker/:sym` | Dashboard, that ticker selected | e.g. `/ticker/NVDA` — the email/share target |
| `/at-a-glance` | AtAGlance (overview) | |
| `/deep-dive` | AtAGlance (deep) | |
| `/market`, `/map`, `/sectors` | MarketViews | |
| `/crypto` | Crypto | |
| `/screener` | Screener | |
| `/strategy` | Strategy | |
| `/earnings` | Earnings | |
| `/watchlist` | ManageWatchlist | |
| `/holdings` | Holdings | |
| `/alerts` | Alerts | |
| `/settings` | Settings | |
| `/s/:token` | SharedWatchlist | already special-cased; becomes a real route |
| `*` | redirect → `/dashboard` | unknown paths |

The existing `View` union values map 1:1 to paths via a small lookup table, so
there's a single source of truth (`VIEW_TO_PATH` / `PATH_TO_VIEW`).

## Architecture (key decision: keep the store API, drive it from the URL)

The codebase already routes all navigation through two store actions —
`setView(v)` and `setSelected(sym)` — used across 12 files. Rather than convert
every call site to `<Link>`/`navigate()`, we **keep those actions as the
navigation API and make them update the URL**:

1. Add `react-router-dom`. Wrap `<App>` in `<BrowserRouter>` (the backend SPA
   fallback already serves any path → `index.html`, so deep links work on
   refresh with no server change).
2. A small `RouterBridge` component (rendered inside the router) uses
   `useNavigate()` + `useLocation()` to:
   - **URL → store:** on location change, derive `view` + `selected` from the
     path and set them in the store (so the existing render logic — `view ===
     'earnings' && <Earnings/>` — keeps working unchanged).
   - **store → URL:** override `setView`/`setSelected` so calling them
     `navigate()`s to the matching path. (Implementation: the store actions emit
     an intent; the bridge subscribes and navigates. Simpler alternative: expose
     `navigate` to the store via a ref set by the bridge, and have setView/
     setSelected call it. Pick whichever is cleaner during implementation.)
3. `selected` lives in the URL only on `/ticker/:sym`; on other views it stays in
   store state (selecting a ticker from the watchlist navigates to
   `/ticker/<sym>`).

Net effect: **no view file changes.** Header nav buttons still call `setView`;
watchlist cards still call `setSelected`; both now change the URL and history.

## Email + sharing follow-through

- Alert email button → `https://tickertracker.info/ticker/<symbol>` (replaces the
  interim `/?sym=`).
- The interim `?sym=` handler in `App.tsx` is removed once routing lands
  (redirect `/?sym=X` → `/ticker/X` for any old links already sent).

## SEO

- With real paths, add per-route `<title>`/meta (via a tiny `useDocumentTitle`
  hook or react-helmet) and extend `sitemap.xml` to list the main public routes
  (`/dashboard`, `/earnings`, `/screener`, `/crypto`, `/market`). Public routes
  are indexable; auth-only routes (`/watchlist`, `/holdings`, `/settings`,
  `/alerts`) get `noindex`.

## Testing

- Unit: `VIEW_TO_PATH`/`PATH_TO_VIEW` are inverse for every view (table-driven).
- E2E (Playwright): navigating to `/earnings` renders Earnings; `/ticker/AAPL`
  selects AAPL on the dashboard; back button returns to the prior view; an
  unknown path redirects to `/dashboard`.
- The existing 6 E2E specs that click nav and assert the view still pass (they
  assert on rendered content, not URLs — and now the URL also updates).

## Risks / call-outs

- **Mobile header + SharedWatchlist** both branch on `view`/path today; verify
  they read from the bridge-derived state.
- **`replaceState` vs `pushState`:** nav between views should `push` (so back
  works); the email `?sym=`→`/ticker` redirect should `replace`.
- Keep it `BrowserRouter` (clean paths) not `HashRouter`; relies on the SPA
  fallback, which is already in place (`spa()` route in `backend/app.py`).

## Effort

Moderate, low-risk: ~1 new dep, ~2 new small files (route table + bridge),
`App.tsx` wrapped, email URL + sitemap updated. No view-component rewrites.
Best executed as its own task with the test suite as the gate.
