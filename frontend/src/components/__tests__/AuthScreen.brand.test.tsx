import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthScreen } from '../AuthScreen'
import { useStore } from '../../state/store'

describe('AuthScreen branding', () => {
  beforeEach(() => {
    useStore.setState({ authModal: true, authIntent: 'login', closeAuth: vi.fn(), login: vi.fn(), openAuth: vi.fn() } as never)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ google: true, apple: false }) }))
  })
  afterEach(() => vi.unstubAllGlobals())
  it('uses the Google G asset in the Google action', async () => {
    render(<AuthScreen />)
    await waitFor(() => {
      const button = screen.getByRole('button', { name: 'Continue with Google' })
      expect(button.querySelector('img')).toHaveAttribute('src', '/brand/google-g.svg')
    })
  })
})
