# Ticker Tracker — Open Graph / Social Share Card Spec

> A precise build spec for the 1200×630 share card. Every share leads with
> **Pulse**, the brand's headline metric. Colors are real tokens from
> `frontend/src/theme/tokens.ts`. Use this for: the static site OG image, the
> existing PNG export, and shared-watchlist cards.
>
> Honesty: the card always carries the disclaimer line (§6). Pulse is "a
> transparent summary of public signals" — never advice, never a prediction.

---

## 1. Canvas
- **Size:** 1200 × 630 px (standard OG / Twitter `summary_large_image`).
- **Background:** `--bg` `#0a0b0d`, with a subtle top-to-bottom plate from
  `--card #14171c` (top) to `--panel #0f1115` (bottom) at ~6% strength, optional.
- **Safe margin:** 64px on all sides. Nothing critical outside it.
- **Outer hairline (optional):** 1px `rgba(255,255,255,.07)` inset by 24px.

## 2. Grid (two columns)
Split the safe area into a **left content column** and a **right dial column**.

- **Left column:** x = 64 → 700 (width ~636).
- **Right column (Pulse dial):** centered at **cx = 940, cy = 300**, dial radius
  **r = 150** (so a 270° arc fits within ~x 770–1110, y 150–470).

## 3. Right column — the Pulse dial (hero element)
Reuse `frontend/public/brand/pulse-dial.svg` geometry, scaled to r=150:
- **Track:** `--line2` `rgba(255,255,255,.12)`, stroke-width 22.
- **Bands** (each a 25-pt quarter of the 270° arc, cool→energized):
  - Cooling 0–25 → `#4f8cff`
  - Neutral 26–50 → `#9aa1ab` (`--tx2`)
  - Building 51–75 → `#ffb347` (`--warn`)
  - Hot 76–100 → `#3ddc84` (`--accent`/`--up`)
- **Needle:** `--tx` `#e9ebee`, 4px, rounded; **hub** `--card` `#14171c` with
  `--tx` ring.
- **Value dot** on the arc: the active band color, 8px, `--panel` halo.
- **Center numeral:** the score, Sora 800, ~120px, `--tx`.
- **Band label** under numeral: Sora 700, ~26px, uppercase, +3 tracking, in the
  **active band color**.

## 4. Left column — identity & context
Top-to-bottom:
1. **Wordmark / mark** at top-left (y≈64): the dual-T tile (64px) + "Ticker Tracker"
   (Sora 800, 34px; "Ticker" `--tx`, "Tracker" `--tx2`). Ref
   `frontend/public/brand/wordmark.svg`.
2. **Ticker** (y≈230): JetBrains Mono 700, ~96px, `--tx`. e.g. `AAPL`.
   Optional sub-line: company/asset name, Sora 500, 24px, `--tx2`.
3. **Headline stat** (y≈360): "Pulse **72** · Building" — "Pulse" Sora 600 `--tx2`;
   the number Sora 800 `--tx`; band name in the active band color.
4. **One-line context** (y≈430), Sora 500, 22px, `--tx2`, e.g.
   *"Momentum and trend strengthening; analyst target 8% above."* Must be generated
   from real Pulse components, not embellished.

## 5. Footer band (full width, y ≈ 566)
- `tickertracker.info` — JetBrains Mono 600, 22px, `--tx2`, left at x=64.
- Right at x=1136 (right-aligned): the sign-off **"Signal, not noise."** Sora 600,
  22px, `--tx3`.
- Hairline above the footer: 1px `--line`.

## 6. Disclaimer (required, honesty rule)
Small line directly beneath the headline stat or in the footer, JetBrains Mono,
14px, `--tx3` `#5b626c`:

> `Pulse is a transparent summary of public signals — not investment advice.`

If the card shows news sentiment anywhere, it must read "headline-based sentiment."

## 7. Variants
- **Single-ticker (default):** as above — the share surface for a stock/coin card.
- **Watchlist card:** replace the single dial with up to 3 small inline Pulse chips
  (band-dot + `Pulse NN`) stacked in the left column, keep one representative dial
  (e.g. the list's top mover) at right. Title becomes the watchlist name.
- **Crypto variant:** band scale identical; context line uses Fear & Greed regime +
  BTC dominance instead of analyst target (those don't exist for coins).

## 8. Color quick-reference (exact hex)
| Use | Hex | Token |
|---|---|---|
| Background | `#0a0b0d` | `--bg` |
| Plate top / tile | `#14171c` | `--card` |
| Plate bottom | `#0f1115` | `--panel` |
| Arc track / hairline | `rgba(255,255,255,.12)` / `.07` | `--line2` / `--line` |
| Primary text / numeral / needle | `#e9ebee` | `--tx` |
| Secondary text | `#9aa1ab` | `--tx2` |
| Tertiary / disclaimer | `#5b626c` | `--tx3` |
| Cooling band | `#4f8cff` | `COMPARE_COLORS[0]` |
| Neutral band | `#9aa1ab` | `--tx2` |
| Building band | `#ffb347` | `--warn` |
| Hot band | `#3ddc84` | `--accent` / `--up` |

> Never use `--down #ff5d73` as a band or a "sell" cue on the card — it would imply
> advice and breaks the honesty rule.

## 9. Export notes
- Author as SVG → rasterize to PNG at 1200×630 (and 2× = 2400×1260 for retina).
- Fonts: embed/convert Sora + JetBrains Mono to paths for portable rendering.
- Reference the live dial geometry in `frontend/public/brand/pulse-dial.svg`.
