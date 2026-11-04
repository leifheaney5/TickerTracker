// Market data — sector heatmap (HM), sector list (SECTORS), and indices (IDX),
// transcribed from the prototype. These power the Market/Map/Sectors views.
// (No dedicated real-data backend endpoint; the spec keeps these synthetic.)

import { hashStr } from '../lib/hash'

export const SECTORS = [
  { name: 'Energy', chg: 1.51 }, { name: 'Technology', chg: 1.24 },
  { name: 'Communication Svcs', chg: 0.82 }, { name: 'Consumer Disc.', chg: 0.64 },
  { name: 'Materials', chg: 0.41 }, { name: 'Health Care', chg: 0.12 },
  { name: 'Industrials', chg: -0.18 }, { name: 'Financials', chg: -0.34 },
  { name: 'Utilities', chg: -0.52 }, { name: 'Real Estate', chg: -0.71 },
]

export const IDX = {
  SPX: { name: 'S&P 500', value: 5478.20, chg: 0.62 },
  NDX: { name: 'Nasdaq 100', value: 19620.50, chg: 0.94 },
  DJI: { name: 'Dow Jones', value: 39150.30, chg: -0.21 },
  RUT: { name: 'Russell 2000', value: 2022.40, chg: 0.38 },
  VIX: { name: 'Volatility · VIX', value: 13.24, chg: -3.10 },
}

// Heatmap: sector → [[symbol, marketCapBillions], …] (subset of the prototype HM).
export const HM: Record<string, [string, number][]> = {
  Technology: [['AAPL', 3280], ['MSFT', 3470], ['NVDA', 3230], ['AVGO', 780], ['ORCL', 380], ['CRM', 270], ['AMD', 263], ['ADBE', 240], ['CSCO', 200], ['ACN', 210], ['TXN', 160], ['QCOM', 190], ['INTC', 130], ['IBM', 170], ['NOW', 170], ['INTU', 175], ['AMAT', 160], ['MU', 110], ['PLTR', 64]],
  Communication: [['GOOGL', 2190], ['META', 1430], ['NFLX', 290], ['DIS', 200], ['CMCSA', 160], ['T', 140], ['VZ', 170], ['TMUS', 220], ['CHTR', 50]],
  'Consumer Cyclical': [['AMZN', 2060], ['TSLA', 792], ['HD', 380], ['MCD', 200], ['NKE', 110], ['LOW', 140], ['SBUX', 100], ['BKNG', 130], ['TJX', 130]],
  'Consumer Defensive': [['WMT', 600], ['PG', 380], ['KO', 280], ['PEP', 230], ['COST', 360], ['PM', 150], ['MO', 95], ['MDLZ', 90]],
  Healthcare: [['LLY', 800], ['JNJ', 360], ['UNH', 480], ['ABBV', 300], ['MRK', 320], ['TMO', 210], ['ABT', 190], ['PFE', 160], ['DHR', 190], ['BMY', 100], ['AMGN', 150]],
  Financial: [['JPM', 591], ['V', 540], ['MA', 420], ['BAC', 300], ['WFC', 210], ['MS', 160], ['GS', 150], ['AXP', 170], ['SPGI', 140], ['BLK', 130], ['C', 120]],
  Industrials: [['GE', 180], ['CAT', 160], ['RTX', 150], ['HON', 130], ['UNP', 140], ['BA', 110], ['LMT', 110], ['DE', 110], ['UPS', 110], ['ETN', 130]],
  Energy: [['XOM', 498], ['CVX', 280], ['COP', 130], ['SLB', 65], ['EOG', 70], ['MPC', 60]],
  Utilities: [['NEE', 150], ['DUK', 80], ['SO', 90], ['D', 45]],
  'Real Estate': [['PLD', 100], ['AMT', 90], ['EQIX', 80], ['SPG', 55]],
  Materials: [['LIN', 220], ['SHW', 80], ['APD', 60], ['FCX', 65], ['NEM', 50]],
}

// Listing exchange for the heatmap tickers. Only NASDAQ-listed symbols are
// enumerated; every other symbol in HM lists on the NYSE. A company's listing
// venue is a stable, public fact (verified against each issuer's current quote
// listing) — unlike index membership, which churns and is deliberately not
// modelled here. Consistent with UNIVERSE.exch for the symbols both cover.
const HM_NASDAQ = new Set([
  // Technology
  'AAPL', 'MSFT', 'NVDA', 'AVGO', 'AMD', 'ADBE', 'CSCO', 'TXN', 'QCOM', 'INTC', 'INTU', 'AMAT', 'MU',
  // Communication
  'GOOGL', 'META', 'NFLX', 'CMCSA', 'TMUS', 'CHTR',
  // Consumer Cyclical
  'AMZN', 'TSLA', 'SBUX', 'BKNG',
  // Consumer Defensive
  'PEP', 'COST', 'MDLZ',
  // Healthcare
  'AMGN',
  // Industrials
  'HON',
  // Real Estate
  'EQIX',
  // Materials
  'LIN',
])

export function hmExchange(sym: string): 'NASDAQ' | 'NYSE' {
  return HM_NASDAQ.has(sym) ? 'NASDAQ' : 'NYSE'
}

// Deterministic daily change for a heatmap symbol (matches _hchg).
export function hmChange(sym: string): number {
  const h = hashStr('HM_' + sym)
  return ((h % 901) / 100) - 4.5
}

// Sector × timeframe performance matrix value (deterministic).
export function sectorPerf(sector: string, tf: string): number {
  const h = hashStr('SP_' + sector + tf)
  return ((h % 1400) / 100) - 6
}
