import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Header } from '../Header'
import { useStore } from '../../state/store'

beforeEach(() => {
  useStore.setState({
    view: 'dashboard',
    theme: 'dark',
    searchOpen: false,
    search: '',
    settings: null,
    currentUser: null,
    watchlist: [],
    holdings: [],
    setView: vi.fn(),
    setTheme: vi.fn(),
    setSearchOpen: vi.fn(),
    setSearch: vi.fn(),
    setSelected: vi.fn(),
    openAuth: vi.fn(),
  } as any)

  global.fetch = vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }) as any
})

describe('Header', () => {
  it('renders the theme toggle button', () => {
    render(<Header />)
    const btn = screen.getByRole('button', { name: /switch to (light|dark) theme/i })
    expect(btn).toBeInTheDocument()
  })

  it('renders navigation', () => {
    render(<Header />)
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
  })
})
