import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ShareCard } from './ShareCard'
import type { WatchlistItem } from '../api/types'

const item = (symbol: string): WatchlistItem => ({
  symbol, position: 0, target: 0, alert_price: 0, alert_dir: 'above', alert_active: false,
})

describe('ShareCard', () => {
  const items = [item('NVDA'), item('AAPL')]
  const price = (s: string) => (s === 'NVDA' ? 124.3 : 201.1)
  const chg = (s: string) => (s === 'NVDA' ? 2.1 : -0.4)

  it('renders one row per ticker with formatted price and signed change', () => {
    render(<ShareCard items={items} price={price} chg={chg} date={new Date('2026-06-27T12:00:00Z')} />)
    expect(screen.getByText('NVDA')).toBeTruthy()
    expect(screen.getByText('AAPL')).toBeTruthy()
    expect(screen.getByText('$124.30')).toBeTruthy()
    expect(screen.getByText('+2.10%')).toBeTruthy()
    expect(screen.getByText('-0.40%')).toBeTruthy()
  })

  it('shows the ticker count in the footer', () => {
    render(<ShareCard items={items} price={price} chg={chg} />)
    expect(screen.getByText(/2 tickers/)).toBeTruthy()
  })
})
