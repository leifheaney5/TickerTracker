// Allocation grouping helper — aggregates position values by a chosen mode.
// Pure function so it's easy to unit-test without any store/component overhead.

export type AllocationMode = 'Position' | 'Sector' | 'Asset Class'

export interface AllocationSlice {
  label: string
  value: number
}

type Row = { symbol: string; value: number }

/**
 * Aggregate an array of position rows into {label, value}[] slices.
 *
 * @param rows         Position rows — only symbol + value are read.
 * @param mode         Grouping mode: Position | Sector | Asset Class
 * @param sectorLookup Map of symbol → sector name; unknown symbols → 'Other'
 * @param cryptoSyms   Set of symbols that should be classified as 'Crypto'
 */
export function aggregateAllocation(
  rows: Row[],
  mode: AllocationMode,
  sectorLookup: Record<string, string>,
  cryptoSyms: Set<string>,
): AllocationSlice[] {
  if (!rows.length) return []

  const map = new Map<string, number>()

  for (const row of rows) {
    let label: string
    if (mode === 'Position') {
      label = row.symbol
    } else if (mode === 'Sector') {
      label = sectorLookup[row.symbol] ?? 'Other'
    } else {
      // Asset Class
      label = cryptoSyms.has(row.symbol) ? 'Crypto' : 'Stocks'
    }
    map.set(label, (map.get(label) ?? 0) + row.value)
  }

  return Array.from(map.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
}
