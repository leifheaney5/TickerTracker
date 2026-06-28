# Watchlist PNG Sharing — Design

**Date:** 2026-06-27
**Status:** Approved (design), pending implementation plan

## Problem

The Share button on the Manage Watchlist page (`frontend/src/views/ManageWatchlist.tsx`)
currently mints a server-side share token, builds a `/s/:token` URL, and copies that
link to the clipboard ("Copied!"). The user expected it to share an **image (PNG)** of
their watchlist instead of a link.

## Goal

Clicking Share generates a clean, branded PNG of the user's watchlist and either opens
the OS native share sheet (mobile / supported browsers) or downloads the file (desktop).

## Decisions

- **Image content:** a clean, purpose-built share card — not a screenshot of the
  editable table (no Remove buttons, alert inputs, target editors).
- **Delivery:** smart — `navigator.share({ files })` when supported, else download the
  `.png` file.
- **Link sharing:** image-only. The Share button no longer produces a link. The existing
  `/s/:token` backend (`api.createShare`) and the public `SharedWatchlist` page remain in
  the codebase but are no longer reachable from this button (dormant, intact).

## Architecture

Rather than draw to a `<canvas>` imperatively, build a presentational JSX card, render it
off-screen, and rasterize that DOM node with `html-to-image`. Design stays in JSX/CSS,
consistent with the codebase's inline-style convention.

A shared image must look the same for every user, so the card uses **fixed explicit
colors** rather than `var(--…)` theme tokens (otherwise light- vs dark-mode users would
produce different PNGs).

### Dependency

Add `html-to-image` (small, modern, `toBlob`/`toPng`, no peer deps). Rasterize at
`pixelRatio: 2` for crisp retina output.

### Components

**`frontend/src/components/ShareCard.tsx`** — purpose-built, fixed-width (~640px) card,
deterministic colors. Pure presentational; props: `items`, `price`, `chg`. No store
coupling, independently testable.

- Header: `Logo` + "Ticker Tracker" wordmark; subtitle "My Watchlist · <date>".
- Rows: per ticker — logo, symbol, company name, price (mono font), 24h % (green/red).
- Footer: "N tickers · tickertracker.info".

**`frontend/src/lib/shareImage.ts`** — `shareImage(node, filename)`:

1. `toBlob(node, { pixelRatio: 2 })`.
2. If `navigator.canShare?.({ files: [file] })` → `navigator.share({ files, title })`.
3. Else → create an object URL and trigger an `<a download>` click; revoke the URL.
4. Swallow user-cancel (`AbortError`) silently; surface other errors to the caller.

### Wiring — `ManageWatchlist.tsx`

- Render `ShareCard` into an off-screen container (`position: absolute; left: -99999px`)
  via a ref.
- `handleShare`: label `Rendering…` → `shareImage(ref, 'my-watchlist.png')` → label
  `Done!` → reset to `Share` after a delay. Replaces the `api.createShare()`/clipboard
  logic. The label state type becomes `'Share' | 'Rendering…' | 'Done!'`.
- `api.createShare`, the `/s/:token` route, and `SharedWatchlist` are left untouched.

## Data flow

`watchlist` items + the store's `price()` / `chg()` selectors are already available in
`ManageWatchlist`. They are passed as props into `ShareCard`. No new store state.

## Error handling

- `shareImage` wraps rasterization + share/download in try/catch.
- User-cancelled native share (`AbortError`) is a no-op (no error label).
- Any other failure resets the button label to `Share`.

## Testing (TDD)

`html-to-image`'s `toBlob` requires a canvas, which jsdom lacks, so it is mocked.

- **`shareImage.ts`** — mock `navigator.canShare` / `navigator.share`, the object-URL +
  anchor download path, and `toBlob`. Assert it chooses share vs. download correctly and
  treats `AbortError` as a no-op.
- **`ShareCard`** — renders one row per ticker; shows formatted price and signed 24h %.

## Out of scope

- Changing or removing the `/s/:token` link-share backend.
- Customizing card themes / multiple export sizes.
- Server-side image generation.
