export type TargetSide = 'buy' | 'sell'

type TargetNumber = number | null | undefined

function validTargetNumber(value: TargetNumber): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

export function targetDistancePct(price: TargetNumber, target: TargetNumber, side: TargetSide): number | null {
  if (!validTargetNumber(price) || !validTargetNumber(target)) return null
  const distance = side === 'buy'
    ? (price - target) / price * 100
    : (target - price) / price * 100
  return Math.max(0, distance)
}

export function targetReached(price: TargetNumber, target: TargetNumber, side: TargetSide): boolean {
  if (!validTargetNumber(price) || !validTargetNumber(target)) return false
  return side === 'buy' ? price <= target : price >= target
}

interface TargetSortable {
  symbol: string
  position: number
  buy_target: number
  sell_target: number
}

type PriceQuote = { price: number } | undefined

export function compareTargetDistance(
  a: TargetSortable,
  b: TargetSortable,
  quotes: Record<string, PriceQuote>,
  side: TargetSide,
): number {
  const targetKey = side === 'buy' ? 'buy_target' : 'sell_target'
  const aPrice = quotes[a.symbol]?.price
  const bPrice = quotes[b.symbol]?.price
  const aDistance = targetDistancePct(aPrice, a[targetKey], side)
  const bDistance = targetDistancePct(bPrice, b[targetKey], side)

  if (aDistance == null && bDistance == null) return a.position - b.position
  if (aDistance == null) return 1
  if (bDistance == null) return -1

  const aReached = targetReached(aPrice, a[targetKey], side)
  const bReached = targetReached(bPrice, b[targetKey], side)
  if (aReached !== bReached) return aReached ? -1 : 1
  return aDistance - bDistance || a.position - b.position
}
