// Deterministic RNG helper. The synthetic OHLC/sparkline generators that used
// to live here were removed: the app now renders ONLY real /api/history data
// (charts show a skeleton while it loads) rather than fabricating candles.
// `makeRng` is retained for the illustrative equity curve (Strategy view).

export function makeRng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
}
