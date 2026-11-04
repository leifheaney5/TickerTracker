# Ticker Tracker Feedback and Performance Pass Design

**Date:** 2026-09-10
**Status:** Approved in chat
**Scope:** Dashboard, watchlist targets and sorting, ticker discovery, news presentation, authentication branding, contact affordance, and first-load performance

## Goal

Make the main Ticker Tracker journey faster and more decisive: users can set explicit buy and sell targets, find and track a ticker from one search surface, notice Pulse and Compare immediately, scan a genuinely varied news list, and reach the Dashboard or Market page without duplicate background work.

## Product decisions

- A watchlist item can have both an optional buy target and an optional sell target.
- Every existing `target` value retains its current meaning and becomes the sell target.
- Buy targets are reached at or below the configured value. Sell targets are reached at or above the configured value.
- Targets remain informational values and continue to power Pro target-hit emails in the matching direction.
- Missing targets and missing live prices sort after actionable rows.
- “Signals rising” is reserved for a positive change measured from real Pulse history. A score band alone must not make a temporal claim.
- Gainers and losers continue to describe the user’s watchlist, not the whole market.
- The application is dark-only. Existing stored light-mode preferences are ignored.
- News-source variety is selected from real upstream articles. The UI never invents a publisher or article.
- No package dependency, production access, deployment, or Git-history mutation is part of this change.

## Data model and compatibility

The existing database column `watchlist_items.target` is the persisted sell target. This preserves all values without a destructive rename. Add nullable-compatible `buy_target REAL DEFAULT 0.0`.

The API returns both explicit fields:

```json
{
  "buy_target": 185.0,
  "sell_target": 240.0
}
```

During this release the backend continues accepting and returning legacy `target` as an alias of `sell_target`, so old clients, shared-watchlist consumers, and rollback builds remain compatible. New frontend code uses only the explicit names.

The schema migration has both current Alembic heads (`cc01_multi_watchlist` and `ff01_signal_snapshots`) as its parents. The same additive column is included in `db._ensure_columns()` because production boot currently performs additive runtime repair.

Target validation accepts finite values greater than zero or zero to clear. Negative, infinite, NaN, and non-numeric values are rejected with a 400 response. Buy and sell values may coexist. The interface warns when buy is greater than sell but does not block it, because the user may intentionally configure targets around a changing market.

Target-hit evaluation is directional:

```text
buy reached  = current_price <= buy_target
sell reached = current_price >= sell_target
```

The existing explicit alert (`alert_price`, `alert_dir`, `alert_active`) remains independent. When an explicit alert and a target are both reached in the same run, the explicit alert retains priority, matching current behavior.

## Target presentation and sorting

Create pure target utilities for status and percentage distance. Distance uses current price as the denominator:

```text
buy distance  = max(0, (current - buy_target) / current * 100)
sell distance = max(0, (sell_target - current) / current * 100)
```

Zero or unavailable current prices return unknown rather than a fabricated distance. Relevant reached targets sort first, then ascending percentage distance, then stable manual position. Rows without the selected target sort last.

Replace the watchlist’s click-to-cycle sort with an explicit, labelled control containing:

- Manual
- Day gainers
- Day losers
- Price
- A–Z
- Closest to buy target
- Closest to sell target

Day gainers and losers use the same daily-change data but opposite ordering. The compact watchlist card shows two short target rows only when configured: `Buy $185 · 3.2% away` and `Sell $240 · 18.4% away`. Reached states use text and an icon in addition to color.

The selected-ticker header uses a shared dual-target editor. An untracked ticker cannot display a false editable state; it offers “Track and set targets.” Manage Watchlists exposes the same two labelled values per row.

## Unified ticker finder

One dialog owns ticker lookup. It is opened with an intent:

```ts
type FinderIntent =
  | { kind: 'browse' }
  | { kind: 'track' }
  | { kind: 'add-to-list'; listId: number }
  | { kind: 'compare' }
```

The header search opens `browse`. Sidebar Add ticker opens `track`. A list-card Add ticker opens `add-to-list`. Compare stocks opens `compare`.

Every result has a primary open/details action and a trailing intent-specific action. In browse mode the trailing action is Track/Tracking. In add mode the primary action adds to the destination. In compare mode it adds/removes the symbol from comparison. Existing search debounce, Finnhub endpoint, and local universe fallback are retained.

The dialog is a labelled modal with a combobox and keyboard-operable result list. Escape closes it, focus returns to the opener, and result actions are native buttons. Authentication and the requested intent remain available after the auth modal closes.

## Visual direction

The existing Ticker Tracker visual identity remains intact.

### Tokens

- Canvas: `#0a0b0d`
- Panel: `#0f1115`
- Card: `#14171c`
- Primary text: `#e9ebee`
- Positive/accent: `#3ddc84`
- Negative: `#ff5d73`
- Interface type: Sora
- Market values: JetBrains Mono

### Layout

```text
┌ [larger TT] Dashboard At-a-Glance Market Crypto     [Search] [Account] ┐
├──────────────────────┬──────────────────────────────────────────────────┤
│ Watchlist            │ NVDA  price             Pulse 64                │
│ Sort: Closest buy    │ Buy ≤ $185  Sell ≥ $240  ↑ +8 over 7d           │
│ Watchlist movers     │ [timeframe] [chart type] [Compare stocks]       │
│ ticker decision rows │                     chart                        │
│ [Add ticker]         │ stats               publisher-logo news         │
└──────────────────────┴──────────────────────────────────────────────────┘
```

The memorable visual emphasis is the decision rail: buy target, sell target, and measured Pulse movement beside the selected price. Other surfaces remain quiet.

- Use the bundled canonical `/favicon.svg` as the header mark at about 40px desktop and 36px mobile.
- Remove both theme buttons and hard-code the dark token set.
- Increase the selected Pulse dial to about 72px. The measured trend is a readable 12–13px badge; the current strength caption remains secondary.
- Compare stocks is always accent outlined with a minimum 40px target; active comparisons use a filled state and colored removable chips.
- Move the existing mover toggle into the watchlist column and label it “Watchlist movers.” It shows a small ranked subset instead of a wide ribbon above the selected security.
- Contact us becomes an accent-outlined footer button and remains visible in the mobile utility area.

The design avoids introducing a new card style, decorative gradient, animation system, or typeface. This keeps the product recognizably Ticker Tracker rather than turning the feedback pass into a visual rebrand.

## Pulse semantics

`pulseCaption()` describes current score strength only:

```text
Cooling  -> Signals quiet
Neutral  -> Signals mixed
Building -> Signals positive
Hot      -> Signals strong
```

A pure helper derives temporal direction from at least two real `PulsePoint` records. It compares the latest value with the earliest available value in the last seven dated points and returns the actual day span. Positive delta is “Signals rising,” negative delta is “Signals cooling,” and zero is “Signals steady.” The badge includes the signed score delta and period. With insufficient history no temporal badge renders.

## News diversity and publisher identity

Finnhub remains the only news provider. The provider adapter reads a larger response pool before normalization. The service:

1. removes invalid links and blank headlines;
2. deduplicates normalized URLs and case-folded headlines;
3. groups by normalized publisher;
4. selects round-robin by publisher, with at most two articles per source;
5. returns at most twelve articles in recency-preserving order.

The desired output is up to six or more publishers when the upstream response contains them. A smaller real set is preferable to fabricated diversity.

`NewsSourceLogo` derives the HTTPS article hostname, asks the already-used Google favicon endpoint for that domain, and falls back to a publisher monogram when the image fails. The article URL remains subject to the existing HTTP(S)-only validation.

The login and signup forms use a local copy of Google’s approved multicolor G asset inside the existing button. The OAuth redirect flow is unchanged.

## Performance architecture

### Frontend request ownership

- Initialize the Zustand view synchronously from `window.location.pathname`, so a hard `/market` visit never mounts Dashboard.
- App owns quote polling. Changing the selected symbol participates in that effect; Dashboard stops calling `pollQuotes()`.
- Add module-level in-flight promise maps to keyed store loaders. A request for an already-loaded or already-pending key reuses the existing promise.
- Watchlist owns sparkline history loading; `Sparkline` becomes a pure renderer. Start visible sparkline loads after the selected chart request has begun, using bounded batches rather than an all-at-once burst.
- Authenticated bootstrap calls the list-aware `/api/watchlists` endpoint once and derives the flat active watchlist from it. Do not also call `/api/watchlist`.
- `loadFng()` stores `fetchedAt`; Market removes its direct second `api.fng()` call.

### Backend coalescing

`cache.cached()` adds a per-key lock. After acquiring the lock it checks the cache again before running the producer. Concurrent cold callers receive the single produced value. Stale-on-error and LRU eviction semantics remain unchanged.

Pulse history, fundamentals, ratings, and news are independent and are fetched with bounded concurrency. Cache the composed Pulse briefly so `/pulse` and `/signals` do not recompute the same context during one page load. Ratings cache becomes 24 hours, matching repository policy. Fear & Greed uses a daily-aware cache duration rather than five minutes.

### Performance acceptance criteria

- A mocked hard load of `/market` makes no Dashboard history, fundamentals, Pulse, news, ratings, signals, or earnings requests.
- React StrictMode produces one request per unique resource key while the first request is pending.
- Dashboard initial work contains one quotes request and one history request per required timeframe.
- Watchlist sparkline history no longer has two owners and is not in the first critical batch.
- Market requests Fear & Greed once.
- Authenticated bootstrap requests `/api/watchlists` once and does not request `/api/watchlist`.
- Eight concurrent calls to one cold cache key invoke its producer once.
- Cold Pulse dependencies overlap and total time is near the slowest fake dependency, not their sum.

## Error handling and accessibility

- Failed target saves roll back optimistic state and present an actionable error.
- Failed search preserves the query and exposes an error/empty state.
- Failed publisher icons fall back locally without hiding the source name.
- Missing Pulse history shows no directional claim.
- All new interactive elements are native buttons, inputs, or selects.
- Target inputs have persistent labels, validation text, and keyboard save/cancel.
- Buy/sell/reached/Pulse states never rely on color alone.
- Global `:focus-visible` styling replaces invisible keyboard focus on new controls.
- Reduced-motion preferences disable the live pulse and loading/price-flash animation.

## Verification

- Backend: pytest for explicit targets, compatibility alias, directional alert evaluation, migration/runtime column creation, news diversity, cache single-flight, Pulse concurrency, and route contracts.
- Frontend: Vitest/Testing Library for target math/sorting, target editor, unified finder intents, Google mark, dark-only header, publisher logos, Compare prominence, Pulse direction, mover placement, and request coalescing.
- E2E: mocked hard navigation to Dashboard and Market, unified search-to-track, dual targets and sorting, Compare, mobile contact, and request-count assertions.
- Canonical gates: backend `python -m pytest -q`; frontend `npm run test`, `npm run lint`, `npm run build`, and focused Playwright tests.

