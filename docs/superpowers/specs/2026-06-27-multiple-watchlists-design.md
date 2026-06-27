# Multiple Watchlists + Branded PNG Sharing — Design

**Date:** 2026-06-27
**Status:** Approved (pending spec review)
**Scope:** Sub-projects A (premium primitive, stub) + B (multiple watchlists & PNG share). Stripe billing is sub-project C, a separate later cycle.

## Summary

Let users organize tickers into multiple named, draggable watchlists (e.g. "Active Watch", "Prospective", "Tech Only") under the Manage view. Each list supports add / edit / delete / reorder / share. Sharing produces both the existing read-only link and a new **branded PNG** download intended for social sharing to drive signups.

Gating:
- **Free** users: exactly **1 list**, **10 active tickers** max (hard cap; overflow locked).
- **Premium** users: **unlimited** lists and tickers.

Premium status is a manually-flippable `User.plan` flag for now; real Stripe billing is a later cycle (C) that will set this flag.

## Decomposition rationale

The original request bundled two independent subsystems: subscription **billing** and the **watchlists feature**. They share exactly one seam — "is this user premium?" We build that seam (a `plan` flag + `require_premium` guard) as a tiny stub now so the watchlists feature can be built and tested against a manually-set flag, and real billing wires the flag for real in a later spec/plan/build cycle. This keeps billing's payment-security concerns out of feature work and keeps each spec implementable in one plan.

## Data model

### New `Watchlist` table
| Column | Type | Notes |
|---|---|---|
| `id` | Integer PK | |
| `user_id` | FK users.id, indexed | |
| `name` | String | e.g. "My Watchlist" |
| `position` | Integer | order of list cards |
| `share_token` | String, nullable, indexed | per-list share token |
| `created_at` | DateTime | server default now |

### `WatchlistItem` changes
- Add `watchlist_id` (FK → `watchlists.id`, indexed).
- A symbol may now belong to more than one list. Alert/target settings remain per-item, so the same ticker can carry a different alert in different lists (intentional side effect).

### Migration (Alembic, additive & safe)
For every existing user:
1. Create one list `"My Watchlist"` at `position 0`.
2. Reassign all of that user's existing `WatchlistItem` rows to the new list, preserving `position`.
3. Carry any existing `Settings.share_token` onto the new list's `share_token`.

Additive schema (new table + nullable column backfilled) — safe to deploy before the frontend. Zero data loss; every current user keeps their list and share link.

**New users:** signup (and first watchlist access for any user lacking a list) lazily creates a default `"My Watchlist"` so there is always exactly one list to add to. Item-add and list endpoints get-or-create the primary list rather than assuming one exists.

### Premium predicate (single source of truth)
A helper `allowance(user)` is the only place tier rules live:
- **Free:** 1 list; within it, items at `position 0–9` are **active**, `position ≥ 10` are **locked**.
- **Premium:** unlimited lists; nothing locked.

`locked` is **computed, never stored**. On upgrade, locked items light up with no data fix-up.
An item that is locked is excluded from: the compatibility union (below), quotes fetching, alert firing, digest, sentiment, and dashboard.

## Backend API

### Premium primitive (sub-project A — built here as a stub)
- Add `User.plan` (`'free' | 'premium'`, default `'free'`).
- `GET /api/me` exposes `{ id, email, name, plan }`.
- `require_premium()` helper for route/service guards. Flippable manually in DB until Stripe (cycle C).

### Compatibility union (do not break existing readers)
`GET /api/watchlist` stays alive as a **read-only deduped union** of active items across all the user's lists. Dashboard, alerts cron, digest, and sentiment continue to consume it unchanged — they only ever needed the set of symbols the user tracks.

### New list-scoped routes
All auth-scoped. Premium gating enforced in the **service layer** via `require_premium()` / `allowance()`, not scattered in routes.

| Method | Route | Purpose | Gating |
|---|---|---|---|
| `GET` | `/api/watchlists` | All lists w/ items, `locked` flags, counts | — |
| `POST` | `/api/watchlists` | Create list | premium (free has 1 → 402 `premium_required`) |
| `PATCH` | `/api/watchlists/:id` | Rename / reorder (`name`, `position`) | — |
| `DELETE` | `/api/watchlists/:id` | Delete list | blocked if it's the user's last list → 409 `last_list` |
| `POST` | `/api/watchlists/:id/items` | Add ticker | free 10-cap → 402 `free_limit` |
| `PATCH` | `/api/watchlists/:id/items/:sym` | Edit target/alert, move (`watchlist_id`), reorder | — |
| `DELETE` | `/api/watchlists/:id/items/:sym` | Remove from that list | — |
| `POST` | `/api/watchlists/:id/share` | Mint/return that list's share token | — |
| `GET` | `/api/shared/:token` | Public resolve → list name + owner + items | public |

Error contract: blocked actions return `402` with `{ "error": "free_limit" }` or `{ "error": "premium_required" }` (frontend renders upgrade nudges, never a crash); deleting the last list returns `409 { "error": "last_list" }`.

### `store.py` refactor
A list-aware service layer underneath the existing symbol-keyed functions; the old functions become thin wrappers over the user's **primary list** so no other module changes. Functions stay small and focused.

## Frontend

### State (Zustand)
- Add a `watchlists` array (lists with their items) as the source of truth for the Manage view.
- **Derive** the existing flat `watchlist` (union of active items) from `watchlists` so Dashboard / Alerts / Header — which subscribe to `watchlist` — work unchanged.

### Manage view → board of list cards (`ManageWatchlist.tsx`)
- Each **list card**: header (name, inline rename, ticker count, ⋯ menu = Rename / Share / Delete) + ticker rows (existing row UI: price/%, inline target, alert, remove) + an "Add ticker" box.
- **`+ New list`** button; for free users a locked/upgrade affordance.
- Free overflow rows (`pos ≥ 10`) render dimmed with 🔒 and an "Upgrade to unlock" nudge.

### Drag & drop (`@dnd-kit`)
- One `DndContext`. List cards form a `SortableContext` (reorder). Each list's items form a nested `SortableContext` sharing the same context → cross-list ticker dragging.
- A drag handle (⠿) separates row-click (open ticker) from dragging.
- Drag end → optimistic store update → PATCH to persist `position` / `watchlist_id`; roll back on failure.
- Pointer **and** keyboard sensors (accessible drag). Mobile: pointer sensor with activation constraint; cards stack and a "Move to ▸" menu is the reliable cross-list fallback.

### Branded PNG share
- `<ShareCard>` — off-screen, fixed 1080×1350 (social ratio) — renders the list with heavy TickerTracker branding: `Logo`, gradient header, list name, ticker rows w/ prices, a **QR code** to the `/s/<token>` link, and "Made with TickerTracker · tickertracker.info" footer.
- "Download image" action runs `html-to-image` → PNG download. Share menu offers **Copy link** (existing) + **Download image** (new).

### New dependencies
- `@dnd-kit/core` + `@dnd-kit/sortable` (React 19-ready, accessible, multi-container DnD).
- `html-to-image` (DOM → PNG).
- `qrcode` (scannable share link on the card).

### API client / types
New methods mirroring the routes above; types added to `api/types.ts`.

## Testing (TDD)

### Backend (pytest)
- **Migration:** seed pre-migration user with N flat items → migrate → one list "My Watchlist" owns all N at correct positions; `share_token` carried over.
- **Gating:** free blocked at 11th active item (402 `free_limit`); free blocked creating 2nd list (402 `premium_required`); premium unlimited; locked items (`pos ≥ 10`) excluded from union + alerts query.
- **Auth-scoping:** user A cannot read/mutate user B's lists/items (extend `test_auth_scoping`).
- **Share:** per-list token resolves to that list's items + name; legacy `Settings.share_token` still resolves post-migration.
- **Move/reorder** persistence.

### Frontend (vitest)
- Pure reducers: reorder-list, move-item-between-lists.
- Store derives flat `watchlist` union correctly.
- Free-tier locked-row rendering. `html-to-image` mocked.

## Error handling
- 402 → inline upgrade nudge, not a crash.
- Optimistic DnD rolls back on PATCH failure.
- Deleting the last list blocked client- and server-side.
- Share-token failure degrades to "try again."

## Rollout
- Additive migration; safe to deploy backend before frontend.
- **Minor** version bump; CHANGELOG updated.
- Premium flag flippable in DB for immediate dogfooding.

## Out of scope (deferred)
- Stripe billing (sub-project C).
- Server-side OG preview images for link unfurls.
- Collaborative / shared-edit lists.
- Per-list alert digests.
