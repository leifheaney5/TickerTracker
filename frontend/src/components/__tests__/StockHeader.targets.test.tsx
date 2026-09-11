import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { StockHeader } from '../StockHeader'
import { useStore } from '../../state/store'

vi.mock('../PulseDial', () => ({ PulseDial: () => <span aria-hidden="true" /> }))

beforeEach(() => {
  useStore.setState({
    selected: 'AAPL', watchlist: [], fundamentals: {}, quotes: {}, flash: {},
    addWatch: vi.fn(), removeWatch: vi.fn(), updateWatch: vi.fn(async () => true),
  } as never)
})

describe('StockHeader targets', () => {
  it('offers an untracked ticker one honest combined action without an editor', () => {
    render(<StockHeader />)
    expect(screen.getByRole('button', { name: 'Track and set targets' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Buy target')).not.toBeInTheDocument()
  })

  it('opens the shared dual editor for a tracked ticker', async () => {
    const user = userEvent.setup()
    useStore.setState({
      watchlist: [{ symbol: 'AAPL', position: 0, buy_target: 185, sell_target: 240, target: 240, alert_price: 0, alert_dir: 'above', alert_active: false, kind: 'stock' }],
    })
    render(<StockHeader />)
    await user.click(screen.getByRole('button', { name: 'Edit buy and sell targets' }))
    expect(screen.getByLabelText('Buy target')).toHaveValue(185)
    expect(screen.getByLabelText('Sell target')).toHaveValue(240)
  })
})
