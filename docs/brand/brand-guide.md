# Ticker Tracker — Brand & Visual Identity System

> Status: design system doc for the Signal Intelligence track (2026-06-28).
> This is a **naming and refinement** of the dark system that already ships —
> not a rebrand. Every color cited is a real token from
> `frontend/src/theme/tokens.ts`. The new element is the **Pulse** motif.
>
> Honesty rule (non-negotiable): Pulse is **"a transparent summary of public
> signals."** It is never advice, never "AI prediction," never a proprietary
> ML model. Brand language must map to shipped behavior.

---

## 1. Brand essence & voice

**Essence.** Ticker Tracker is the calm, dark-native place to see the stocks and
crypto you actually care about — and, now, to understand *what changed and what it
means* through one honest score you can see the math behind.

**Positioning line (internal):** *Every other tracker shows you the market. Ticker
Tracker tells you what changed — in one honest score you can see the math behind.*

**Tagline / mark sign-off:** **"Signal, not noise."**

**Voice principles**
- **Calm over loud.** Restrained, confident, dark-native. No exclamation storms.
- **Signal over noise.** Say the one thing that matters; cut the rest.
- **Honest by construction.** We show the components behind every number. If a
  signal is a headline heuristic, we say so. We never imply certainty we don't have.
- **No hype, no emoji spam.** At most a single, purposeful glyph. Never "🚀📈🔥".
- **Plain-spoken finance.** "Reporting in 2 days," not "imminent earnings catalyst."

**Words we use:** signal, transparent, what changed, the math behind it, summary,
band, trend, public signals.
**Words we avoid:** prediction, guaranteed, AI says, buy/sell (as advice), alpha,
moonshot, to-the-moon, secret, proprietary model.

---

## 2. The Pulse motif (signature brand element)

**Pulse** is the headline metric and the visual heart of the brand: a single
**0–100 score per ticker** with a labeled **band** and an always-available
**"Why" breakdown** (each component + its raw value). It is computed only from real
inputs the app already fetches (price/OHLC → RSI/MACD/trend, 52-week position,
analyst consensus + target distance, news-headline sentiment; crypto substitutes
Fear & Greed + BTC dominance). See `docs/strategy/2026-06-28-moat-signal-intelligence.md` §2.3 / §4.

### 2.1 The Pulse dial — visual language
A **270° gauge arc** (gap at the bottom), low on the lower-left, high on the
lower-right, with a needle and a large numeral in the well. Reference asset:
`frontend/public/brand/pulse-dial.svg`.

- **Arc track:** `--line2` (`rgba(255,255,255,.12)`) — quiet, recessive.
- **Four bands**, each a 25-point quarter of the arc, on a deliberate
  **cool → warm → energized** gradient (not a red→green "sell→buy" axis):

| Band | Range | Token | Hex | Meaning (honest framing) |
|---|---|---|---|---|
| **Cooling** | 0–25 | compare-blue `COMPARE_COLORS[0]` | `#4f8cff` | signals quiet / weakening |
| **Neutral** | 26–50 | `--tx2` | `#9aa1ab` | mixed / balanced signals |
| **Building** | 51–75 | `--warn` | `#ffb347` | signals strengthening |
| **Hot** | 76–100 | `--accent` / `--up` | `#3ddc84` | signals strongly aligned |

- **Needle + hub:** `--tx` (`#e9ebee`) on a `--card` (`#14171c`) hub.
- **Value dot** on the arc takes the **active band's color**.
- **Numeral:** Sora 800, `--tx`. **Band label:** Sora 700, the active band color,
  uppercase, +2.5 letter-spacing. **Caption:** JetBrains Mono, `--tx2`.

**Why these tokens.** The dial reuses the exact palette the app already renders, so
it sits natively on any card with no new theme work. Critically, **`--down`
(`#ff5d73`) is intentionally NOT a band color** — a red band would read as "sell,"
which would violate the honesty rule. The bands describe the *state of the signals*,
not a recommendation.

### 2.2 Reduced forms
- **Inline chip** (tables, watchlist rows): a small pill — `Pulse 72` with a 6px dot
  in the band color, text `--tx`, background `--cardHi` (`#1a1e25`).
- **Sparkline** (signal history): a 1.5px polyline in the *current* band color over a
  `--line` baseline; this is the F3 "trending up 5 days" surface.
- **Mono micro-arc**: the 180° arc used inside the logo tile (see §5).

---

## 3. Color system

The dark palette is canonical and unchanged. This section **names** it and adds
Pulse semantics. All values from `frontend/src/theme/tokens.ts` (`COLORS`).

### 3.1 Surfaces (dark, canonical)
| Token | Hex | Role |
|---|---|---|
| `--bg` | `#0a0b0d` | app background, theme-color meta |
| `--panel` | `#0f1115` | panels / rails |
| `--card` | `#14171c` | cards, the icon tile |
| `--cardHi` | `#1a1e25` | raised/hover card, chips |
| `--line` | `rgba(255,255,255,.07)` | hairline dividers |
| `--line2` | `rgba(255,255,255,.12)` | stronger borders, dial track |

### 3.2 Text
| Token | Hex | Role |
|---|---|---|
| `--tx` | `#e9ebee` | primary text, numerals, needle |
| `--tx2` | `#9aa1ab` | secondary / captions / Neutral band |
| `--tx3` | `#5b626c` | tertiary, scale ticks, sign-off line |

### 3.3 Semantic & signal
| Token | Hex | Role |
|---|---|---|
| `--up` / `--accent` | `#3ddc84` | gains, primary action, **Hot** band |
| `--down` | `#ff5d73` | losses — **excluded from Pulse bands** |
| `--warn` | `#ffb347` | warnings, **Building** band |
| `--warn2` | `#ff9f43` | warning hover/emphasis |
| `--accentInk` | `#06120b` | text on green action surfaces |
| `COMPARE_COLORS[0]` | `#4f8cff` | chart overlay blue, **Cooling** band |

> Light theme (`LIGHT_COLORS`) is the existing AA-tuned variant. For the Pulse band
> scale on light, map: Cooling `#4f8cff`, Neutral `--tx2 #5b626c`, Building
> `--warn #b8731a`, Hot `--accent #14a85a`. Same semantics, theme-correct contrast.

---

## 4. Typography

Two families already loaded in `frontend/src/index.css` — no new fonts.

- **Display / UI — Sora** (`FONT_SANS`, weights 400–800).
- **Numeric / data — JetBrains Mono** (`FONT_MONO`, 400–700) for prices, scores in
  context, tickers, captions, code-like labels.

| Style | Family / weight | Use |
|---|---|---|
| Pulse numeral | Sora 800, ~56px | the dial score |
| Display / H1 | Sora 800, -0.5 tracking | hero, wordmark |
| Section head | Sora 700, ~18–22px | panel titles |
| Body | Sora 400–500, ~14–15px | prose, descriptions |
| Band label | Sora 700, uppercase, +2.5 tracking | the band name |
| Data / ticker | JetBrains Mono 500–600 | prices, symbols, %chg |
| Eyebrow / sign-off | JetBrains Mono, uppercase, +3 tracking | "SIGNAL, NOT NOISE" |

Rules: tickers and any number that must align are **always mono**; never set body
prose in mono; band labels always carry the band color.

---

## 5. Logo & app icon

**The mark.** The existing app icon (`frontend/public/favicon.svg`) is two
overlapping **T**s — an up-green `#3ddc84` T and a down-red `#ff5d73` T — in a
`--card` rounded tile. It already encodes "Ticker Tracker" + "up/down markets." We
**keep it** and give it a story.

**Icon story.** Two tickers, two directions, one calm surface. The green T leads
(optimistic, signal-positive); the red T grounds it (honest about downside). The
rounded `#14171c` tile is the app's own card — the brand literally lives on the
same surface the product is made of.

**Evolution — the Pulse arc.** The horizontal lockup
(`frontend/public/brand/wordmark.svg`) seats the dual-T mark above a 180° **Pulse
arc** sweeping cool `#4f8cff` → warn `#ffb347` → accent `#3ddc84`. This ties the
identity to the new headline metric without altering the standalone app icon (which
stays exactly as shipped, to avoid touching `index.html`/manifest on this track).

**Wordmark.** "Ticker" in `--tx` `#e9ebee`, "Tracker" in `--tx2` `#9aa1ab`, Sora
800, -0.5 tracking — the two-tone split echoes the dual-T duality. Optional
sign-off "SIGNAL, NOT NOISE" in mono `--tx3`.

**Clear space:** ≥ 0.5× tile height on all sides. **Min sizes:** tile 24px;
full lockup 160px wide. **Don'ts:** no gradients on the T's, no recoloring the
tile lighter than `--card`, no stretching, no red band in any Pulse-adjacent art.

---

## 6. Social / OG card (summary — full spec in `og-card-spec.md`)

Every share leads with **Pulse**. A 1200×630 dark card on `--bg`, the Pulse dial at
right, ticker + score + band at left, the wordmark and `tickertracker.info` as
footer. The card is the brand's primary growth surface (the existing PNG export and
shared-watchlist feature should adopt this template). Full layout, coordinates, and
the honesty disclaimer line are in `docs/brand/og-card-spec.md`.

---

## 7. Honesty checklist (apply to every brand surface)
- [ ] Does any claim imply prediction, certainty, or advice? → rewrite.
- [ ] Is Pulse described as "a transparent summary of public signals"? → required.
- [ ] If sentiment is shown, is it labeled as **headline-based**? → required.
- [ ] Is `--down` red used as a Pulse band or "sell" cue? → remove.
- [ ] Could a reasonable user think we have data we don't (options, insider, social)?
      → cut it. Only signals from the real inventory (strategy doc §3) may appear.

---

## 8. Asset index
| Asset | Path |
|---|---|
| Brand guide (this doc) | `docs/brand/brand-guide.md` |
| OG card spec | `docs/brand/og-card-spec.md` |
| Pulse dial demo (SVG) | `frontend/public/brand/pulse-dial.svg` |
| Wordmark lockup (SVG) | `frontend/public/brand/wordmark.svg` |
| App icon (existing, unchanged) | `frontend/public/favicon.svg` |
| Token source of truth | `frontend/src/theme/tokens.ts` |
