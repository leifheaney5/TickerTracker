import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Settings } from '../Settings'
import { useStore } from '../../state/store'
import { api } from '../../api/client'

const baseSettings = {
  broker_connected: false, broker_name: '', live_updates: true,
  alert_notifs: true, news_digest: false, hide_balances: false, currency: 'USD',
}

function setAuthed(is_pro: boolean) {
  useStore.setState({
    currentUser: { id: 1, email: 'u@e.com', name: 'U', email_verified: true },
    settings: { ...baseSettings },
    holdings: [],
    billing: {
      plan: is_pro ? 'pro' : 'free', status: is_pro ? 'active' : '', is_pro,
      limits: { watchlist: is_pro ? 250 : 15, alerts: is_pro ? 100 : 3, screens: is_pro ? 25 : 1, digest: is_pro, compare: is_pro ? 10 : 2 },
      usage: { watchlist: 4, alerts: 1, screens: 0 },
      current_period_end: null, cancel_at_period_end: false,
    },
  })
}

describe('Settings billing card', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('Free state shows upgrade CTAs and usage', () => {
    setAuthed(false)
    render(<Settings />)
    expect(screen.getByText(/Upgrade yearly/i)).toBeInTheDocument()
    expect(screen.getByText(/Monthly — \$7\/mo/i)).toBeInTheDocument()
    expect(screen.getByText(/4\s*\/\s*15/)).toBeInTheDocument() // watchlist usage
  })

  it('annual CTA calls checkout', async () => {
    setAuthed(false)
    const spy = vi.spyOn(api, 'checkout').mockResolvedValue({
      data: { url: 'https://c.test/x' }, source: 'stripe', stale: false, fetchedAt: '',
    })
    vi.stubGlobal('location', { href: '' } as Location)
    render(<Settings />)
    fireEvent.click(screen.getByText(/Upgrade yearly/i))
    await waitFor(() => expect(spy).toHaveBeenCalledWith('annual'))
  })

  it('Pro state shows Manage billing', () => {
    setAuthed(true)
    render(<Settings />)
    expect(screen.getByText(/Manage billing/i)).toBeInTheDocument()
  })
})
