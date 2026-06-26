// Default ticker universe — transcribed from the prototype's `U` map. This
// provides display metadata (name, sector, group, exchange) and seed values.
// Live numbers (price, change) come from the backend; these are the fallback
// floor and the source of names/sectors the API's fundamentals augment.

export interface UniverseEntry {
  name: string
  sector: string
  group: string
  exch: string
  price: number
  dchg: number
  shares: number
  cost: number
  target: number
  cap: string
  pe: string
  div: string
  vol: string
  industry?: string
}

export const UNIVERSE: Record<string, UniverseEntry> = {
  NVDA: { name: 'NVIDIA', sector: 'Semiconductors', group: 'Tech', exch: 'NASDAQ', price: 131.26, dchg: 3.21, shares: 40, cost: 98, target: 160, cap: '3.23T', pe: '58.2', div: '0.03%', vol: '248M', industry: 'Semiconductors' },
  AAPL: { name: 'Apple', sector: 'Consumer Tech', group: 'Tech', exch: 'NASDAQ', price: 214.10, dchg: 0.82, shares: 25, cost: 180, target: 230, cap: '3.28T', pe: '33.1', div: '0.44%', vol: '54M', industry: 'Consumer Electronics' },
  MSFT: { name: 'Microsoft', sector: 'Software', group: 'Tech', exch: 'NASDAQ', price: 467.30, dchg: 1.44, shares: 12, cost: 410, target: 500, cap: '3.47T', pe: '38.6', div: '0.72%', vol: '21M', industry: 'Software — Infra' },
  TSLA: { name: 'Tesla', sector: 'Automotive', group: 'Tech', exch: 'NASDAQ', price: 248.50, dchg: -2.13, shares: 18, cost: 210, target: 300, cap: '792B', pe: '71.4', div: '—', vol: '98M', industry: 'Auto Manufacturers' },
  AMZN: { name: 'Amazon', sector: 'E-Commerce', group: 'Tech', exch: 'NASDAQ', price: 197.85, dchg: 1.92, shares: 15, cost: 165, target: 220, cap: '2.06T', pe: '44.2', div: '—', vol: '41M', industry: 'Internet Retail' },
  GOOGL: { name: 'Alphabet', sector: 'Internet', group: 'Tech', exch: 'NASDAQ', price: 178.40, dchg: -0.41, shares: 20, cost: 142, target: 200, cap: '2.19T', pe: '26.8', div: '0.48%', vol: '28M', industry: 'Internet Content' },
  META: { name: 'Meta Platforms', sector: 'Social', group: 'Tech', exch: 'NASDAQ', price: 564.20, dchg: 2.61, shares: 8, cost: 430, target: 620, cap: '1.43T', pe: '28.1', div: '0.39%', vol: '15M', industry: 'Internet Content' },
  AMD: { name: 'Adv. Micro Devices', sector: 'Semiconductors', group: 'Tech', exch: 'NASDAQ', price: 162.90, dchg: 4.08, shares: 30, cost: 120, target: 190, cap: '263B', pe: '102', div: '—', vol: '62M', industry: 'Semiconductors' },
  NFLX: { name: 'Netflix', sector: 'Media', group: 'Tech', exch: 'NASDAQ', price: 678.10, dchg: 0.34, shares: 5, cost: 520, target: 720, cap: '290B', pe: '47.5', div: '—', vol: '4.2M', industry: 'Entertainment' },
  PLTR: { name: 'Palantir', sector: 'Software', group: 'Tech', exch: 'NYSE', price: 28.40, dchg: -3.42, shares: 60, cost: 21, target: 35, cap: '64B', pe: '198', div: '—', vol: '60M', industry: 'Software — Infra' },
  COIN: { name: 'Coinbase', sector: 'Crypto', group: 'Crypto', exch: 'NASDAQ', price: 245.70, dchg: 5.84, shares: 10, cost: 190, target: 300, cap: '61B', pe: '38.9', div: '—', vol: '12M', industry: 'Capital Markets' },
  JPM: { name: 'JPMorgan Chase', sector: 'Banking', group: 'Finance', exch: 'NYSE', price: 205.60, dchg: -0.72, shares: 14, cost: 175, target: 215, cap: '591B', pe: '12.4', div: '2.21%', vol: '9.1M', industry: 'Banks — Diversified' },
  XOM: { name: 'Exxon Mobil', sector: 'Energy', group: 'Energy', exch: 'NYSE', price: 112.30, dchg: 1.12, shares: 22, cost: 105, target: 125, cap: '498B', pe: '14.1', div: '3.30%', vol: '17M', industry: 'Oil & Gas Integrated' },
  SHEL: { name: 'Shell plc', sector: 'Energy', group: 'Energy', exch: 'NYSE', price: 71.20, dchg: 0.58, shares: 0, cost: 0, target: 0, cap: '224B', pe: '12.8', div: '3.90%', vol: '6M', industry: 'Oil & Gas Integrated' },
}

export const GROUPS = ['All', 'Tech', 'Energy', 'Finance', 'Crypto']

export const DEFAULT_WATCH = ['NVDA', 'AAPL', 'MSFT', 'TSLA', 'AMZN', 'GOOGL', 'AMD', 'COIN', 'XOM', 'JPM', 'PLTR']

// Logo domain map (DuckDuckGo icon service), from prototype DOMAINS.
export const DOMAINS: Record<string, string> = {
  NVDA: 'nvidia.com', AAPL: 'apple.com', MSFT: 'microsoft.com', TSLA: 'tesla.com',
  AMZN: 'amazon.com', GOOGL: 'google.com', META: 'meta.com', AMD: 'amd.com',
  NFLX: 'netflix.com', PLTR: 'palantir.com', COIN: 'coinbase.com',
  JPM: 'jpmorganchase.com', XOM: 'exxonmobil.com', SHEL: 'shell.com',
}
