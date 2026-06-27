import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NewsCard } from '../NewsCard'
import { useStore } from '../../state/store'

beforeEach(() => {
  useStore.setState({
    selected: 'AAPL',
    news: {},
    newsLoaded: {},
    loadNews: vi.fn(),
  } as any)
})

describe('NewsCard', () => {
  it('renders headlines when news items are present', () => {
    useStore.setState({
      selected: 'AAPL',
      news: {
        AAPL: [
          {
            headline: 'Apple soars',
            source: 'Reuters',
            datetime: 'Dec 1',
            url: 'https://example.com',
            sentiment: 'Bullish',
          },
        ],
      },
      newsLoaded: { AAPL: true },
      loadNews: vi.fn(),
    } as any)

    render(<NewsCard />)
    expect(screen.getByText('Apple soars')).toBeInTheDocument()
    expect(screen.getByText('Bullish')).toBeInTheDocument()
  })

  it('shows Loading news… when not yet loaded', () => {
    useStore.setState({
      selected: 'AAPL',
      news: {},
      newsLoaded: {},
      loadNews: vi.fn(),
    } as any)

    render(<NewsCard />)
    expect(screen.getByText('Loading news…')).toBeInTheDocument()
  })

  it('shows No recent news message when loaded but empty', () => {
    useStore.setState({
      selected: 'AAPL',
      news: { AAPL: [] },
      newsLoaded: { AAPL: true },
      loadNews: vi.fn(),
    } as any)

    render(<NewsCard />)
    expect(screen.getByText('No recent news for this ticker.')).toBeInTheDocument()
  })
})
