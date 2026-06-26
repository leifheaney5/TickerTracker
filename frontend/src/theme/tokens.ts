// Design tokens — single source of truth, transcribed verbatim from the
// prototype's renderVals().rootStyle (Ticker Tracker.dc.html). These exact
// values are what make the React port pixel-identical to the prototype.

export const COLORS = {
  bg: '#0a0b0d',
  panel: '#0f1115',
  card: '#14171c',
  cardHi: '#1a1e25',
  line: 'rgba(255,255,255,.07)',
  line2: 'rgba(255,255,255,.12)',
  tx: '#e9ebee',
  tx2: '#9aa1ab',
  tx3: '#5b626c',
  up: '#3ddc84',
  down: '#ff5d73',
  accent: '#3ddc84',
  accentInk: '#06120b', // text on accent buttons (green is light)
  warn: '#ffb347',
  warn2: '#ff9f43',
} as const

// Compare-series palette (chart overlays), from cmpColors.
export const COMPARE_COLORS = ['#4f8cff', '#c6f24e', '#ff9f43', '#b794ff'] as const

// Index layer colors, from idxColors.
export const IDX_COLORS = {
  SPX: '#3ddc84', NDX: '#4f8cff', DJI: '#ffb347', RUT: '#b794ff', VIX: '#9aa1ab',
} as const

// Density presets driving --mpad/--gap/--lgap (balanced is the default).
export type Density = 'airy' | 'balanced' | 'dense'
export const DENSITY: Record<Density, { cpad: string; mpad: string; gap: string; lgap: string }> = {
  airy: { cpad: '15px 16px', mpad: '26px 32px', gap: '18px', lgap: '10px' },
  balanced: { cpad: '12px 14px', mpad: '22px 26px', gap: '16px', lgap: '8px' },
  dense: { cpad: '9px 12px', mpad: '16px 20px', gap: '12px', lgap: '6px' },
}

export const FONT_SANS = "'Sora',system-ui,sans-serif"
export const FONT_MONO = "'JetBrains Mono',monospace"

// Builds the CSS custom-property map applied to the app root, matching the
// prototype's rootStyle. Components reference var(--xxx) so the cascade carries
// the exact token values.
export function rootCssVars(accent: string = COLORS.accent, density: Density = 'balanced') {
  const d = DENSITY[density]
  return {
    '--bg': COLORS.bg,
    '--panel': COLORS.panel,
    '--card': COLORS.card,
    '--cardHi': COLORS.cardHi,
    '--line': COLORS.line,
    '--line2': COLORS.line2,
    '--tx': COLORS.tx,
    '--tx2': COLORS.tx2,
    '--tx3': COLORS.tx3,
    '--up': COLORS.up,
    '--down': COLORS.down,
    '--accent': accent,
    '--mpad': d.mpad,
    '--gap': d.gap,
    '--lgap': d.lgap,
  } as React.CSSProperties
}
