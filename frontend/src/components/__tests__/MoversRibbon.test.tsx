import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { MoversRibbon } from '../MoversRibbon'
import { useStore } from '../../state/store'

const item = (symbol: string, position: number) => ({
  symbol, position, buy_target: 0, sell_target: 0, target: 0,
  alert_price: 0, alert_dir: 'above' as const, alert_active: false, kind: 'stock' as const,
})

beforeEach(() => {
  useStore.setState({
    currentUser: { id: 1, email: 'a@b.com', name: '', email_verified: true, plan: 'free' },
    watchlist: [item('AAPL', 0), item('MSFT', 1), item('NVDA', 2)],
    quotes: {
      AAPL: { price: 200, change_pct: 1.5, day_open: 0, day_high: 0, day_low: 0, prev_close: 0, volume: 0 },
      MSFT: { price: 300, change_pct: -2, day_open: 0, day_high: 0, day_low: 0, prev_close: 0, volume: 0 },
    },
  } as never)
})

describe('MoversRibbon', () => {
  it('shows only positive loaded quotes when gainers exist', () => {
    render(<MoversRibbon />)
    const panel = screen.getByRole('region', { name: 'Watchlist movers' })
    expect(within(panel).getByText('AAPL')).toBeInTheDocument()
    expect(within(panel).queryByText('MSFT')).not.toBeInTheDocument()
    expect(within(panel).queryByText('NVDA')).not.toBeInTheDocument()
  })

  it('shows only negative loaded quotes in the losers view', async () => {
    const user = userEvent.setup()
    render(<MoversRibbon />)
    const panel = screen.getByRole('region', { name: 'Watchlist movers' })
    await user.click(within(panel).getByRole('button', { name: /losers/i }))
    expect(within(panel).getByText('MSFT')).toBeInTheDocument()
    expect(within(panel).queryByText('AAPL')).not.toBeInTheDocument()
    expect(within(panel).queryByText('NVDA')).not.toBeInTheDocument()
  })
})
