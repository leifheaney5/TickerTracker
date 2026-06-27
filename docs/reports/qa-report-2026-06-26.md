# Ticker Tracker QA Report
**Site:** https://tickertracker.info  
**Tested:** 2026-06-26 (anonymous user, desktop 1440px, tablet 768px, mobile 390px)  
**Tester:** Automated Playwright session  

---

## SEARCH FINDINGS (priority concern)

### How search works
Search is **100% client-side filtering** of a hardcoded universe — no API call is ever made to look up arbitrary tickers. The universe appears to be the demo watchlist (~11 tickers) plus some additional preset stocks (total ~14 based on Screener).

### Search test results

| Input | Result | Notes |
|-------|--------|-------|
| `AAPL` | **Found** — dropdown shows AAPL/Apple/$214.10 | Works (ticker is in universe) |
| `apple` (lowercase) | **Found** — AAPL result returned | Company name matching works |
| `RKLB` | **No results, no feedback** | Rocket Lab not in universe; search box stays open but empty — no "not found" message |
| `KRKNF` | **No results, no feedback** | Kraken Robotics not in universe; same silent failure |
| `zzzzz` | **No results, no feedback** | Gibberish; silent — no "no results" message shown |
| `RKLB` + Enter | **Nothing happens** | Enter key does not trigger API lookup or show any error |
| empty | Search box closes | No crash |

**Verdict:** Search is fundamentally limited to a ~14-stock hardcoded universe. Any ticker outside that list silently returns nothing with zero user feedback. There is no "no results found" message, no API fallback, and no way for the user to discover or browse outside the preset list. This is a major gap for any real tracking use case.

---

## SEVERITY: BLOCKER

### BUG-001: "Connect account" button freezes the entire app
**Where:** Header → "⊕ Connect account" button  
**Repro:**
1. Load site as anonymous user
2. Click "⊕ Connect account" button in header

**Observed:** The entire main content area is replaced with "Loading…" and never resolves. The app is stuck — no modal appears, no timeout, no error. Only fix is to navigate to another tab.  
**Expected:** Should open a sign-up/connect modal or redirect to registration.  
**Impact:** Every anonymous visitor who clicks the most prominent CTA in the header hits a broken state.

---

## SEVERITY: MAJOR

### BUG-002: Watchlist card prices are stale seed data — do not match live prices
**Where:** Dashboard → sidebar watchlist cards  
**Repro:** Load dashboard, compare price on watchlist cards vs price shown in chart after clicking the card.

**Observed (confirmed discrepancies):**

| Ticker | Card price (stale) | Live chart price | Stale by |
|--------|-------------------|-----------------|---------|
| AAPL | $214.10 | $283.78 | ~$70 low |
| PLTR | $28.40 | $112.90 | ~$84 low (4x stale!) |
| NVDA | $192.53 | $192.53 | Appears current on this run |

PLTR at $28.40 is a seed value from roughly 2023 when PLTR traded at those levels. AAPL at $214 is also months stale. The watchlist cards display hardcoded/cached prices that are not being updated from the live `/api/quotes` endpoint that powers the chart panel.  
**Expected:** Card prices should reflect the same live quote as the chart.

### BUG-003: "Sign in" button opens Sign Up modal instead of Login
**Where:** Header → "Sign in" button  
**Repro:** Click "Sign in" as anonymous user  
**Observed:** Opens "Create your account / Start tracking your portfolio" sign-up form  
**Expected:** Should open the Login form ("Welcome back / Log in to your account"). The login form does exist (triggered by "Add ticker") — it just isn't wired to the "Sign in" button.  
**Impact:** Confuses users who already have an account.

### BUG-004: At-a-Glance view shows "0 tickers at a glance" — table is empty
**Where:** At-a-Glance tab  
**Repro:** Click "At-a-Glance" nav button as anonymous user  
**Observed:** Table header renders but body shows "0 tickers at a glance — click any column to sort" with no rows  
**Expected:** Should show the same 11 demo watchlist tickers in a sortable table view  
**Console:** No JS errors — the component renders but receives an empty data set

### BUG-005: Gainers/Losers widget always shows "No movers"
**Where:** Dashboard → top bar → "▲ Gainers" / "▼ Losers" buttons  
**Repro:** Load dashboard (NVDA is first selected). Click "Gainers". Click "Losers".  
**Observed:** Both tabs show "No movers" even though the watchlist clearly shows movers: COIN +5.84%, AMD +4.08%, PLTR -3.42%, TSLA -2.13%  
**Expected:** Should list the top gainers/losers from the demo watchlist  
**Notes:** Appears the widget may be querying a separate data source that is not populated, or the threshold is set incorrectly.

### BUG-006: Key Statistics — Open, Prev Close, Day High, Day Low all show "…" 
**Where:** Dashboard → Key Statistics panel → any ticker  
**Repro:** Click any watchlist card (AAPL, PLTR, NVDA confirmed)  
**Observed:** Open, Prev Close, Day High, Day Low all display "…" (ellipsis / loading placeholder that never resolves). The other stats (52W High/Low, Volume, Mkt Cap, P/E, etc.) load correctly.  
**Expected:** Intraday OHLC stats should populate — likely a missing field in the `/api/fundamentals` or `/api/quotes` response  
**Network:** `/api/fundamentals/AAPL` returns 200 — data may be missing from the response payload

### BUG-007: Mobile layout (390px) is severely broken
**Where:** Site-wide at mobile viewport  
**Repro:** Resize browser to 390px width  
**Observed:**
- Header nav completely overflows: "Dashboard", "Ticker Tracker" (center title), "Connect account", "Sign in" all collide and overlap into an unreadable mess
- No hamburger menu or mobile nav adaptation
- The main content panel (chart + stats) is pushed off-screen to the right; only fragments are visible
- The sidebar watchlist occupies the full viewport, making the main content inaccessible
- The page is effectively unusable on any phone  
**Expected:** Responsive layout with collapsed nav, single-column view, or at minimum horizontal scroll with usable content

### BUG-008: Search — no feedback when a ticker is not found
**Where:** Header search → any ticker outside the ~14-stock universe  
**Repro:** Click search, type "RKLB" or "KRKNF" or any arbitrary ticker  
**Observed:** Search dropdown stays blank with no message. Pressing Enter does nothing. No API lookup is attempted. The user has no idea why nothing appears.  
**Expected:** Show "No results for RKLB" message with optionally a CTA like "Search the full market →". This is especially bad since the app implies it is a market tracker, not a 14-stock viewer.

---

## SEVERITY: MINOR

### BUG-009: Tablet layout (768px) — header title overlaps nav
**Where:** Dashboard at 768px viewport  
**Repro:** Resize to 768px  
**Observed:** The centered "Ticker Tracker" wordmark in the header overlaps the nav buttons (the `Market` label merges visually with "Ticker Tracker"). Layout remains usable but looks broken in the header area.  
**Expected:** Nav and title should not overlap at tablet widths

### BUG-010: Page title is "frontend" — unbranded
**Where:** Browser tab title, anywhere on site  
**Observed:** `<title>frontend</title>` — the default Create React App title was never changed  
**Expected:** "Ticker Tracker" or "Ticker Tracker – Dashboard"

### BUG-011: "Compare" feature shows "No tickers to compare" with no instructions
**Where:** Dashboard → chart panel → "⊕ Compare" button  
**Repro:** Click "⊕ Compare" on any ticker  
**Observed:** Opens a small panel that says "No tickers to compare" — with no way to add comparison tickers as an anonymous user  
**Expected:** Either explain how to add tickers for comparison, prompt login to use the feature, or disable the button with a tooltip

### BUG-012: Screener is limited to the same ~14 demo tickers
**Where:** Screener tab  
**Observed:** Screener shows exactly 14 results — the same tickers as the demo watchlist. The filter dropdowns (Sector, Performance, Market Cap) work within this set but the universe is tiny.  
**Expected:** A screener should draw from a much broader market universe (hundreds or thousands of stocks). As-is it provides no value beyond the watchlist view.

### BUG-013: NVDA analyst price target appeared stale on initial page load
**Where:** Dashboard → NVDA → Analyst Ratings (first load)  
**Observed:** On initial page load, NVDA Analyst Ratings showed avg price target of $135.20 (range $115–$155) while NVDA was at $192. On subsequent load the correct avg $198.31 appeared.  
**Notes:** May be a race condition between stale seed data and live data resolution, or a caching artifact. Intermittent.

### BUG-014: Password fields lack `autocomplete` attributes
**Where:** Auth modal — Login and Sign Up forms  
**Observed:** Browser console logs: "Input elements should have autocomplete attributes (suggested: 'current-password')"  
**Expected:** `autocomplete="current-password"` on login, `autocomplete="new-password"` on signup — improves password manager support and removes console warnings

---

## SEVERITY: POLISH

### BUG-015: NVDA target card shows "reached" but target was $160 and price is $192 — misleading
**Where:** Sidebar → NVDA card  
**Observed:** NVDA card shows "Target $160.00 / reached" which is accurate (price > target). However the "reached" label is the same style whether you're 2% past target or 20% past — no indication of how far past the target the stock has run. The visual progress bar likely reads as "full green" in both cases.

### BUG-016: AAPL target label flipped mid-session
**Where:** Sidebar → AAPL card  
**Observed:** On initial load, AAPL card showed "Target $230.00 / 7.4% to go" (because card price was stale $214). After price updated to $283, it flipped to "Target $230.00 / reached". This creates a confusing experience where target status changes without user action.  
**Root cause:** Symptom of BUG-002 (stale card prices).

### BUG-017: "Crypto Fear & Greed: 13 · Extreme Fear" displayed on Market Overview
**Where:** Market → Overview page  
**Observed:** Fear & Greed index shows 13 (Extreme Fear). This value seems plausible to display but has no timestamp — the user cannot tell if this is current or cached.

### BUG-018: News links open to Finnhub API URLs, not actual articles
**Where:** Dashboard → News panel → any article link  
**Observed:** Links go to `https://finnhub.io/api/news?id=...` — these are API endpoints, not the actual article URLs. Clicking an article link takes the user to a JSON response, not a readable news article.  
**Expected:** Links should go to the article's actual URL (e.g. Yahoo Finance, SeekingAlpha). The Finnhub API response should include a `url` field that the app should be using.

---

## Summary Table

| # | Severity | Issue |
|---|----------|-------|
| 001 | Blocker | "Connect account" button freezes app in loading state |
| 002 | Major | Watchlist card prices are stale (PLTR shows $28 instead of $113) |
| 003 | Major | "Sign in" opens Sign Up modal — wrong modal |
| 004 | Major | At-a-Glance tab shows 0 tickers (empty table) |
| 005 | Major | Gainers/Losers widget always shows "No movers" |
| 006 | Major | Open/Prev Close/Day High/Day Low always show "…" |
| 007 | Major | Mobile 390px — layout completely broken, unusable |
| 008 | Major | Search returns no results for any non-preset ticker with zero user feedback |
| 009 | Minor | Tablet 768px — header title overlaps nav |
| 010 | Minor | Page title is "frontend" (unbranded) |
| 011 | Minor | Compare feature has no way to add tickers as anon user |
| 012 | Minor | Screener limited to same 14 demo tickers |
| 013 | Minor | NVDA analyst target data showed stale values on first load |
| 014 | Minor | Password fields lack autocomplete attributes |
| 015 | Polish | Target progress bar doesn't distinguish "just reached" vs "far past" |
| 016 | Polish | AAPL target label flips mid-session due to stale price |
| 017 | Polish | Fear & Greed index has no timestamp |
| 018 | Polish | News article links go to Finnhub API URLs, not actual articles |

**Totals: 1 Blocker, 7 Major, 4 Minor, 4 Polish**

---

## Data Accuracy Spot-Check

| Ticker | Card Price | Chart/Live Price | Status |
|--------|-----------|-----------------|--------|
| NVDA | $192.53 | $192.53 | OK |
| AAPL | $214.10 | $283.78 | STALE — off by ~$70 |
| MSFT | $467.30 | ~$467 (chart $332-$572 1Y) | Plausible |
| TSLA | $248.50 | $248.50 | OK |
| PLTR | $28.40 | $112.90 | STALE — off by ~$84 (4x) |
| JPM | $205.60 | Not spot-checked | — |
| S&P 500 | 5,478.20 | — | Plausible |
| NASDAQ 100 | 19,620.50 | — | Plausible |

**Note:** Open/Prev Close/Day High/Day Low show "…" for all tickers tested — intraday stats are broken site-wide.

---

## Auth/Moat Check

- Clicking "Add ticker" → Login modal appears (correct — moat works)
- Clicking "Sign in" → Sign Up modal appears (BUG-003 — wrong modal)
- Clicking "Connect account" → app freezes (BUG-001 — blocker)
- Login form: email + password fields, Google SSO, "Sign up" link, "Forgot password?" link — all rendered correctly
- Sign up form: name (optional), email, password, Google SSO, "Log in" link — renders correctly
- Google SSO button present on both forms
- Neither form was submitted (per instructions)

---

## Console / Network Health

- **JS errors:** 0 errors across all tested views
- **Failed API calls:** 0 non-200 responses observed
- **APIs called:** `/api/quotes`, `/api/history`, `/api/fundamentals`, `/api/ratings`, `/api/news`, `/api/fng`, `/api/crypto`, `/api/auth/me` — all 200
- **Verbose warnings:** 2 autocomplete attribute warnings (password fields)
