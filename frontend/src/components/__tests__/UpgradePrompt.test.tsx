import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { UpgradePrompt } from '../UpgradePrompt'
import { useStore } from '../../state/store'
import { api } from '../../api/client'

describe('UpgradePrompt', () => {
  beforeEach(() => {
    useStore.setState({ upgradePrompt: null })
    vi.restoreAllMocks()
  })

  it('renders nothing when no prompt is set', () => {
    const { container } = render(<UpgradePrompt />)
    expect(container.firstChild).toBeNull()
  })

  it('shows the message and triggers annual checkout', async () => {
    const spy = vi.spyOn(api, 'checkout').mockResolvedValue({
      data: { url: 'https://checkout.test/go' }, source: 'stripe', stale: false, fetchedAt: '',
    })
    // jsdom: stub navigation so the redirect does not throw.
    const loc = { href: '' } as Location
    vi.stubGlobal('location', loc)
    useStore.setState({ upgradePrompt: { feature: 'watchlist', message: 'Limit reached' } })
    render(<UpgradePrompt />)
    expect(screen.getByText('Limit reached')).toBeInTheDocument()
    fireEvent.click(screen.getByText(/Upgrade yearly/i))
    await waitFor(() => expect(spy).toHaveBeenCalledWith('annual'))
  })
})
