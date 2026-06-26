// FNV-1a hash used for deterministic per-symbol colors (logo monogram hue),
// matching the prototype's _hash.
export function hashStr(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
