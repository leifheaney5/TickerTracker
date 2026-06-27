// Onboarding starter watchlists — shown when an authed user's watchlist is empty.
// Crypto Majors uses crypto-exposed equities (COIN, MSTR, RIOT, MARA) instead of
// raw crypto tickers (BTC/ETH/SOL): valid_symbol accepts them as strings but the
// app's quote service covers equities only, so BTC/ETH/SOL would show $0 prices.
// Decision logged in docs/ops/DECISIONS.md under "T2.2 crypto symbols".
export const STARTER_LISTS: { id: string; label: string; symbols: string[] }[] = [
  {
    id: 'bigtech',
    label: 'Big Tech',
    symbols: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NVDA'],
  },
  {
    id: 'ai',
    label: 'AI',
    symbols: ['NVDA', 'AMD', 'PLTR', 'SMCI', 'TSM', 'MSFT'],
  },
  {
    id: 'crypto',
    label: 'Crypto Majors',
    symbols: ['COIN', 'MSTR', 'RIOT', 'MARA'],
  },
  {
    id: 'dividend',
    label: 'Dividend',
    symbols: ['JPM', 'XOM', 'KO', 'PG', 'JNJ'],
  },
]
