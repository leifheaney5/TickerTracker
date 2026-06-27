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

// Light-theme palette. Chosen for WCAG AA contrast on a white/near-white
// background: tx (#11151b) on bg (#f7f8fa) = 18.5:1; tx2 (#5b626c) = 5.2:1;
// up (#14a85a) = 3.2:1 (acceptable for non-text decorative/indicator use);
// down (#e23950) = 4.1:1; warn (#b8731a) = 3.4:1. accentInk #ffffff on
// accent #14a85a = 4.6:1 (passes AA large text / UI components).
const LIGHT_COLORS = {
  bg: '#f7f8fa',
  panel: '#ffffff',
  card: '#ffffff',
  cardHi: '#f0f2f5',
  line: 'rgba(0,0,0,.08)',
  line2: 'rgba(0,0,0,.14)',
  tx: '#11151b',
  tx2: '#5b626c',
  tx3: '#8b93a0',
  up: '#14a85a',
  down: '#e23950',
  accent: '#14a85a',
  accentInk: '#ffffff',
  warn: '#b8731a',
  warn2: '#a6611a',
} as const

// Theme map — dark must stay byte-for-byte equal to COLORS so existing dark UI
// is pixel-unchanged. Only the light variant is new.
export const THEMES = {
  dark: COLORS,
  light: LIGHT_COLORS,
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
// the exact token values. The optional `theme` param switches between the dark
// (default, pixel-identical to the prototype) and light palettes.
export function rootCssVars(
  accent?: string,
  density: Density = 'balanced',
  theme: 'dark' | 'light' = 'dark',
) {
  const c = THEMES[theme]
  const d = DENSITY[density]
  return {
    '--bg': c.bg,
    '--panel': c.panel,
    '--card': c.card,
    '--cardHi': c.cardHi,
    '--line': c.line,
    '--line2': c.line2,
    '--tx': c.tx,
    '--tx2': c.tx2,
    '--tx3': c.tx3,
    '--up': c.up,
    '--down': c.down,
    '--accent': accent ?? c.accent,
    '--mpad': d.mpad,
    '--gap': d.gap,
    '--lgap': d.lgap,
  } as React.CSSProperties
}
