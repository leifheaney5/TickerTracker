// Deterministic seeded series generators — ported from the prototype's
// _hash/_rng/_master_/_agg/_intraday/_series. Used as the client-side fallback
// when the backend history hasn't loaded yet, so charts always render. Real
// OHLC comes from /api/history; this guarantees a stable shape meanwhile.

import { UNIVERSE } from './universe'
import type { Bar, Timeframe } from '../api/types'

export function hashStr(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function makeRng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
}

const masterCache: Record<string, Bar[]> = {}

function basePrice(sym: string): number {
  return UNIVERSE[sym]?.price ?? 100
}

// 1300-day daily OHLC, deterministic per symbol (matches _master_).
function master(sym: string): Bar[] {
  if (masterCache[sym]) return masterCache[sym]
  const r = makeRng(hashStr(sym) + 7)
  const N = 1300
  const drift = (r() - 0.46) * 0.0007
  const vol = 0.013 + r() * 0.012
  let p = basePrice(sym) * (0.4 + r() * 0.45)
  const arr: Bar[] = []
  const today = new Date(2026, 5, 25)
  for (let i = 0; i < N; i++) {
    const o = p
    let c = o * (1 + (r() - 0.5) * vol * 2 + drift)
    if (c <= 0.2) c = 0.2
    const hi = Math.max(o, c) * (1 + r() * vol)
    const lo = Math.min(o, c) * (1 - r() * vol)
    const v = Math.round((0.6 + r()) * 1e6)
    const dt = new Date(today)
    dt.setDate(today.getDate() - (N - 1 - i))
    arr.push({ o, h: hi, l: lo, c, v, date: dt.toISOString().slice(0, 10) })
    p = c
  }
  const f = basePrice(sym) / arr[N - 1].c
  arr.forEach((a) => { a.o *= f; a.h *= f; a.l *= f; a.c *= f })
  masterCache[sym] = arr
  return arr
}

function agg(slice: Bar[], g: number): Bar[] {
  const out: Bar[] = []
  for (let i = 0; i < slice.length; i += g) {
    const ch = slice.slice(i, i + g)
    if (!ch.length) continue
    out.push({
      o: ch[0].o, c: ch[ch.length - 1].c,
      h: Math.max(...ch.map((x) => x.h)), l: Math.min(...ch.map((x) => x.l)),
      v: ch.reduce((a, x) => a + x.v, 0), date: ch[ch.length - 1].date,
    })
  }
  return out
}

function intraday(sym: string): Bar[] {
  const r = makeRng(hashStr(sym) + 99)
  const n = 78
  const arr: Bar[] = []
  const u = UNIVERSE[sym]
  let p = basePrice(sym) / (1 + (u?.dchg ?? 0) / 100)
  const base = new Date(2026, 5, 25, 9, 30)
  for (let i = 0; i < n; i++) {
    const o = p
    const c = o * (1 + (r() - 0.5) * 0.004)
    const hi = Math.max(o, c) * (1 + r() * 0.0025)
    const lo = Math.min(o, c) * (1 - r() * 0.0025)
    const dt = new Date(base.getTime() + i * 5 * 60000)
    arr.push({ o, h: hi, l: lo, c, v: Math.round((0.4 + r()) * 4e5), date: dt.toISOString() })
    p = c
  }
  const f = basePrice(sym) / arr[n - 1].c
  arr.forEach((a) => { a.o *= f; a.h *= f; a.l *= f; a.c *= f })
  return arr
}

const seriesCache: Record<string, Bar[]> = {}

// Returns a fallback bar series for the symbol/timeframe (matches _series).
export function fallbackSeries(sym: string, tf: Timeframe): Bar[] {
  const k = sym + tf
  if (seriesCache[k]) return seriesCache[k]
  const m = master(sym)
  let s: Bar[]
  if (tf === '1D') s = intraday(sym)
  else if (tf === '1W') s = m.slice(-7)
  else if (tf === '1M') s = m.slice(-22)
  else if (tf === '3M') s = m.slice(-66)
  else if (tf === '1Y') s = agg(m.slice(-252), 5)
  else s = agg(m, 21)
  seriesCache[k] = s
  return s
}

// 30-day close fallback for sparklines (matches _spark's source).
export function fallbackSpark(sym: string): number[] {
  return master(sym).slice(-30).map((x) => x.c)
}
