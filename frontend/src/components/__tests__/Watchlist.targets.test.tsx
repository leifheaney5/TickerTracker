import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Watchlist } from '../Watchlist'
import { useStore } from '../../state/store'

vi.mock('../../charts/Sparkline', () => ({ Sparkline: () => <span aria-hidden="true" /> }))

const item = (symbol: string, position: number, buy_target: number, sell_target: number) => ({
  symbol, position, buy_target, sell_target, target: sell_target,
  alert_price: 0, alert_dir: 'above' as const, alert_active: false, kind: 'stock' as const,
})

beforeEach(() => {
  useStore.setState({
    currentUser: { id: 1, email: 'a@b.com', name: '', email_verified: true, plan: 'free' },
    selected: 'AAPL',
    group: 'All',
    sortBy: 'manual',
    watchlist: [item('AAPL', 0, 190, 250), item('MSFT', 1, 210, 0), item('NVDA', 2, 0, 0)],
    quotes: {
      AAPL: { price: 200, change_pct: 1, day_open: 0, day_high: 0, day_low: 0, prev_close: 0, volume: 0 },
      MSFT: { price: 200, change_pct: -2, day_open: 0, day_high: 0, day_low: 0, prev_close: 0, volume: 0 },
      NVDA: { price: 200, change_pct: 3, day_open: 0, day_high: 0, day_low: 0, prev_close: 0, volume: 0 },
    },
    history: { 'AAPL:1M': [], 'MSFT:1M': [], 'NVDA:1M': [] },
    flash: {},
    setSelected: vi.fn(),
    setView: vi.fn(),
  } as never)
})

describe('Watchlist target sorting and presentation', () => {
  it('offers every sort mode in an explicit labelled control', () => {
    render(<Watchlist />)
    const select = screen.getByRole('combobox', { name: 'Sort watchlist' })
    expect(select).toBeInTheDocument()
    expect(Array.from((select as HTMLSelectElement).options).map((option) => option.text)).toEqual([
      'Manual', 'Day gainers', 'Day losers', 'Price', 'A–Z', 'Closest to buy target', 'Closest to sell target',
    ])
  })

  it('renders both configured target rows with direction-aware status', () => {
    render(<Watchlist />)
    expect(screen.getByText('Buy $190.00 · 5.0% away')).toBeInTheDocument()
    expect(screen.getByText('Sell $250.00 · 25.0% away')).toBeInTheDocument()
    expect(screen.getByText('Buy $210.00 · ✓ Reached')).toBeInTheDocument()
  })

  it('sorts closest buy targets with reached rows first and missing targets last', async () => {
    const user = userEvent.setup()
    render(<Watchlist />)
    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort watchlist' }), 'closest-buy')
    const symbols = Array.from(document.querySelectorAll('[data-testid^="watchlist-row-"]')).map((node) => node.getAttribute('data-testid')!.replace('watchlist-row-', ''))
    expect(symbols).toEqual(['MSFT', 'AAPL', 'NVDA'])
  })
})
