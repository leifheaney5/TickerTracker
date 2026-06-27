# Roadmap

Parking lot for prospective ideas — things intentionally deferred until the
product and user base justify the investment. Not a commitment; a place so good
ideas aren't lost when we pull them out of the shipping product.

## Conventions
- **Status:** `Idea` → `Exploring` → `Planned` → `In progress` → `Shipped` / `Dropped`
- Keep entries short. Capture the _why_ it was deferred, not just the feature.
- When something ships, move it to the CHANGELOG and either delete the entry or mark it `Shipped`.

---

## Prospective features

### Brokerage / account connection ("Connect account")
- **Status:** Idea
- **Deferred:** 2026-06-27
- **Why deferred:** Too prospective right now — implies broker integration
  (portfolio sync, holdings, balances) we don't have. The header "⊕ Connect
  account" button was removed (v1.13.1) to avoid promising functionality that
  isn't built. Market doc sequences this *after* the quick wins.
- **What it would take:** Broker/aggregator integration (e.g. SnapTrade, Plaid,
  or direct broker OAuth), secure token storage, holdings sync, and the
  Portfolio surface to consume it. The header already conditionally renders a
  "Portfolio" chip when `settings.broker_connected` is true — that wiring stays
  in place for when this is revived.

### Native crypto tickers
- **Status:** Idea
- **Why deferred:** The quote service is equities-only, so `BTC/ETH/SOL` would
  silently show $0 and never resolve. The "Crypto Majors" starter list uses
  equity proxies (COIN, MSTR, RIOT, MARA) instead (DECISIONS T2.2,
  2026-06-27).
- **What it would take:** A crypto quote data path (CoinGecko or Finnhub-crypto),
  symbol routing so crypto symbols hit it instead of the equity provider, and
  formatting for crypto-scale prices/precision.

### In-app / push notifications
- **Status:** Idea
- **Why deferred:** Alerts and the weekly digest are **email-only** today. Email
  was the fastest channel to ship and the one with a built moat (Resend domain).
- **What it would take:** A notification channel abstraction (browser Web Push
  and/or an in-app inbox), user opt-in + subscription storage, and a fan-out step
  in the existing alert/digest cron jobs.

---

## Known debt / follow-ups

Logged during the overnight run (see `docs/ops/DECISIONS.md`) but not tracked
durably anywhere else. Low-risk; revisit opportunistically.

- **Component-level DOM tests (RTL + jsdom)** — deliberately skipped; all frontend
  tests are store/logic-layer only. Add `@testing-library/react` + jsdom if we
  want render-level UI assertions.
- **`npm ci` in CI** — currently `npm install` due to the rolldown/emnapi
  cross-platform optional-dep lockfile issue. Stricter fix: generate & commit a
  Linux-built `package-lock.json` so `npm ci` works.
- **Light-mode `<body>` edge** — `index.css` sets a static dark body background,
  so in light mode the page edge behind the app root stays dark (app itself is
  light). Cosmetic; fix = body bg uses `var(--bg)`.
- **Misc minors** — TOCTOU on first share/unsub token write; `asOf()` NaN guard;
  MarketViews double `/api/fng` fetch; saved-screens dropdown lacks click-outside.

---

## Ideas (unsorted)

_Add new prospective ideas here._
