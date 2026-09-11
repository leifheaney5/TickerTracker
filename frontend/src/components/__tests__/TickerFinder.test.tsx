import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TickerFinder } from '../TickerFinder'
import { useStore } from '../../state/store'

beforeEach(() => {
  useStore.setState({ tickerFinder: { kind: 'browse' }, watchlist: [], compare: [], addWatch: vi.fn().mockResolvedValue(true), setSelected: vi.fn(), setView: vi.fn(), closeTickerFinder: vi.fn() } as never)
  global.fetch = vi.fn().mockRejectedValue(new Error('offline')) as never
})

describe('TickerFinder', () => {
  it('uses local results immediately and browse opens ticker details', async () => {
    const user = userEvent.setup()
    render(<TickerFinder />)
    await user.type(screen.getByRole('combobox', { name: 'Search ticker or company' }), 'AAPL')
    await user.click(screen.getByText('AAPL').closest('button')!)
    expect(useStore.getState().setSelected).toHaveBeenCalledWith('AAPL')
    expect(useStore.getState().setView).toHaveBeenCalledWith('dashboard')
  })

  it('exposes tracking without requiring a second search flow', async () => {
    const user = userEvent.setup()
    render(<TickerFinder />)
    await user.type(screen.getByRole('combobox'), 'AAPL')
    await user.click(screen.getByRole('button', { name: '+ Track' }))
    expect(useStore.getState().addWatch).toHaveBeenCalledWith('AAPL')
  })
})
