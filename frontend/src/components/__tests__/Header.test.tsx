import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Header } from '../Header'
import { useStore } from '../../state/store'

beforeEach(() => {
  useStore.setState({
    view: 'dashboard',
    searchOpen: false,
    search: '',
    settings: null,
    currentUser: null,
    watchlist: [],
    holdings: [],
    setView: vi.fn(),
    setSearchOpen: vi.fn(),
    setSearch: vi.fn(),
    setSelected: vi.fn(),
    openAuth: vi.fn(),
  } as any)

  global.fetch = vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }) as any
})

describe('Header', () => {
  it('uses the canonical large mark and has no theme toggle', () => {
    render(<Header />)
    expect(screen.getByRole('img', { name: 'Ticker Tracker' })).toHaveAttribute('src', '/favicon.svg')
    expect(screen.queryByRole('button', { name: /theme/i })).not.toBeInTheDocument()
  })

  it('renders navigation', () => {
    render(<Header />)
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
  })
})
