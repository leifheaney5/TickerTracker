# Crypto Watchlist + Expandable Map — Design

**Date:** 2026-06-27
**Status:** Approved
**Target version:** v1.14.0

## Problem

The Crypto page tracks a fixed 7 coins (hardcoded `_IDS` in
`backend/providers/coingecko.py`). Both the coins table and the "Crypto Map"
treemap render only those 7. Users want to (1) keep a personal crypto
**watchlist** and (2) **expand the map** to browse more coins.

The existing watchlist is stock-only: `WatchlistItem` is keyed by a ticker
`symbol` validated against a stock-ticker regex, and those symbols feed stock
quote-polling. Crypto uses CoinGecko **IDs** (`solana`, `shiba-inu`) — which
contain hyphens and fail `valid_symbol` — so crypto cannot cleanly share that
path without changes.

## Decisions (from brainstorming)

1. **Feature shape:** Browse top-N **and** a personal watchlist. The map/table
   expands to a user-selectable top-N (25/50/100); users also star coins into a
   "My Coins" list that's pinned and highlighted on the map.
2. **Add mechanism:** Star from the top-N table **plus** a search box
   (CoinGecko search API) for coins outside the top-N.
3. **Coin scope:** Tracking **+ price-target alerts** — reuse the existing
   email-alert engine so crypto coins fire targets/alerts like stocks.

## Data model (Approach A — `kind` discriminator)

Add a `kind` column to the existing `WatchlistItem` table rather than a parallel
crypto table. This reuses the alert engine, cooldown, target/alert fields, and
email templates. The alert engine already iterates `WatchlistItem`; we branch
the quote lookup by `kind`.

`models.py` — `WatchlistItem`:

- `kind = Column(String, default="stock")` — `"stock"` | `"crypto"`.
- `coin_name = Column(String, default="")` — cached display name for crypto
  rows so they render without a CoinGecko lookup.

For crypto rows, the CoinGecko **id** (e.g. `solana`) is stored in `symbol`.
The cached `coin_name` holds the display name (e.g. `Solana`). The display
ticker (e.g. `SOL`) is derived/cached client-side from the markets payload.

Idempotent migration in `db.init_db()`: `ALTER TABLE watchlist_items ADD COLUMN
IF NOT EXISTS kind ...` / `coin_name ...` (Postgres + SQLite-safe guarded by a
column-exists check).

## Backend

`providers/coingecko.py`:

- `fetch_crypto(limit=50, extra_ids=())` — drop hardcoded `_IDS`; call
  `/coins/markets` with `order=market_cap_desc`, `per_page=limit`, `page=1`,
  unioned with any `extra_ids` (watchlisted coins outside top-N) in the **same**
  request. Returns existing shape: `{coins, total_market_cap, btc_dominance}`
  with each coin gaining `id` (CoinGecko id) for star/watch wiring.
- `search_coins(query)` — wrap `/search`, return `[{id, symbol, name}]`
  (capped, e.g. 10).
- `fetch_prices(ids)` — `/coins/markets?ids=...`; returns
  `{id: {price, change_pct}}` for the alert engine.

`services/crypto.py`:

- `get_crypto(limit, extra_ids)` — pass-through with cache key including limit +
  sorted extra_ids; mock fallback honors `limit`.
- `get_crypto_search(q)` — cached wrapper; empty list on failure.
- `get_crypto_prices(ids)` — for alerts.

`app.py`:

- `/api/crypto?limit=50&watch=<id,id>` — `limit` validated to `{25,50,100}`
  (default 50); `watch` parsed to a bounded list of valid coin ids.
- `/api/crypto/search?q=` — min length guard; returns search results envelope.
- `valid_coin_id(s)` — regex `^[a-z0-9-]{1,64}$`.
- Extend `/api/watchlist` POST to accept `kind` (default `"stock"`) and
  `coin_name`; when `kind=="crypto"` validate via `valid_coin_id` instead of
  `valid_symbol`. PATCH/DELETE already key by the stored identifier and work
  unchanged.

`services/store.py`:

- `add_watch(...)` gains `kind="stock"`, `coin_name=""`; stored on the row.
- `get_watchlist()` returns `kind` + `coin_name` in the dict.

`services/alerts.py`:

- In `check_alerts`, partition `due` items by `kind`. Price stock symbols via
  `get_quotes` and crypto ids via `fetch_prices`. Merge into one price map keyed
  by the row identifier; the rest of the firing/cooldown/`AlertLog`/email path is
  unchanged.
- `_alert_email_html` price formatting becomes precision-aware: sub-$1 coins use
  more decimals (mirror frontend `cmoney`) so e.g. a $0.00012 coin isn't shown
  as `$0.00`.

## Frontend

`api/types.ts`: `WatchlistItem` gains `kind: 'stock' | 'crypto'` and
`coin_name?: string`; `CryptoCoin` gains `id: string`. New `CryptoSearchResult`.

`api/client.ts`: `crypto(limit, watchIds)`, `cryptoSearch(q)`.

`state/store.ts`:

- `cryptoLimit: 25|50|100` (default 50) + `setCryptoLimit`.
- `loadCrypto(limit?)` passes `limit` and the current crypto watch ids as
  `watch`.
- Derived `cryptoWatch = watchlist.filter(w => w.kind === 'crypto')`.
- `addCryptoWatch(coin)` / `removeCryptoWatch(id)` — call existing watchlist
  endpoints with `kind:'crypto'`, optimistic update, reload crypto so a
  newly-added off-top-N coin appears.

`views/Crypto.tsx`:

- Map card header: segmented `25 · 50 · 100` selector beside the legend;
  re-fetches on change. "COINS TRACKED" stat reflects selected limit.
- Treemap: watchlisted tiles get a highlight ring (pass a `highlight` set into
  `Treemap`).
- **"My Coins"** card above the main table: renders `cryptoWatch` with
  price/24h/target + alert affordance (reuse stock card pattern). Empty state:
  "Star a coin below to start tracking." Shown when authed or has items.
- Main table: leading **star** column (filled = watchlisted); toggles
  add/remove optimistically. Anonymous click prompts login (mirror stocks).
- **Search**: "+ Add coin" input above the table; debounced 300ms →
  `cryptoSearch`; dropdown of results (logo/name/symbol); selecting adds with
  `kind:'crypto'` and caches `coin_name`.

## Error handling

- CoinGecko failure → existing mock fallback, extended to honor `limit` (N
  synthetic coins). Search failure → empty dropdown + inline "Search
  unavailable."
- Anonymous users: top-N browsing + N-selector fully work; stars/search-add
  prompt login.
- `limit` invalid → clamped/rejected to default. Bad coin id → 400 via
  `valid_coin_id`.

## Testing (TDD)

Backend (`backend/tests/`):

- `valid_coin_id` accepts `solana`, `shiba-inu`; rejects `Sol Ana`, empty,
  overlong, `../x`.
- `fetch_crypto(limit, extra_ids)` — shape, includes `id`, unions extra ids
  (mock the HTTP layer).
- `/api/crypto?limit=` validation (25/50/100 ok; 7/999/abc → default).
- `/api/crypto/search` — min length, result shape.
- watchlist POST with `kind:'crypto'` + valid coin id persists & returns kind;
  invalid coin id → 400.
- `check_alerts` fires a **crypto** target via injected `quote_fn`/`send_fn`
  (no network); cooldown respected; stock + crypto in one run both fire.

Frontend (`frontend/src/`):

- store: `addCryptoWatch` adds a `kind:'crypto'` row; `cryptoWatch` selector
  filters by kind; `setCryptoLimit` triggers reload.
- Crypto view: renders N-selector and star column; selecting a search result
  calls the client.

## Versioning & workflow

- Minor bump → **v1.14.0**; update `CHANGELOG.md`.
- Small modular commits/branches per workflow prefs (model/migration →
  provider → routes → alerts → store → view → tests).

## Out of scope (YAGNI)

- Per-tier numeric caps (handled by the separate Stripe freemium spec).
- Crypto news / per-coin deep view.
- Drag-to-reorder for crypto watchlist (uses insertion order initially).
