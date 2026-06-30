// Pure helpers for the Pulse signal metric. Kept framework-free so they're unit-tested
// at the logic layer (the repo's deliberate "no DOM tests" convention).
//
// Bands are quartiles, matching backend services/pulse.py and the brand Pulse-dial ramp.
// The color ramp is deliberately cool→warm→energized and NEVER uses --down (red): Pulse is a
// strength summary, not a buy/sell call, so it must not read as a "sell" signal.

export type PulseBand = 'Cooling' | 'Neutral' | 'Building' | 'Hot'

export function pulseBand(score: number): PulseBand {
  if (score >= 75) return 'Hot'
  if (score >= 50) return 'Building'
  if (score >= 25) return 'Neutral'
  return 'Cooling'
}

const BAND_COLORS: Record<PulseBand, string> = {
  Cooling: 'var(--compare0, #4f8cff)', // cool blue (COMPARE_COLORS[0])
  Neutral: 'var(--tx2, #9aa1ab)',      // muted text grey
  Building: 'var(--warn, #ffb347)',    // amber
  Hot: 'var(--up, #3ddc84)',           // energized green
}

export function pulseColor(band: PulseBand): string {
  return BAND_COLORS[band]
}

// Plain-language caption for the compact dial. The band words (Cooling/Building/…) are kept as the
// canonical model — used for color, the breakdown panel, and aria — but the dial shows this instead,
// because "Building" reads as a loading state and never names WHAT is building. Naming the subject
// ("signals") makes the dial impossible to misread as data-integrity or stock-quality.
const BAND_CAPTIONS: Record<PulseBand, string> = {
  Cooling: 'signals quiet',
  Neutral: 'signals mixed',
  Building: 'signals rising',
  Hot: 'signals strong',
}

export function pulseCaption(band: PulseBand): string {
  return BAND_CAPTIONS[band]
}

// Fraction (0..1) of the 270° gauge sweep for a given 0..100 score. Clamps out-of-range input.
export function pulseArc(score: number): number {
  const s = Math.max(0, Math.min(100, score))
  return s / 100
}
