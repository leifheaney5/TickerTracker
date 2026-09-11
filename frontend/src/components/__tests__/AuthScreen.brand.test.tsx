import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthScreen } from '../AuthScreen'
import { useStore } from '../../state/store'

describe('AuthScreen branding', () => {
  beforeEach(() => useStore.setState({ authModal: true, authIntent: 'login', closeAuth: vi.fn(), login: vi.fn(), openAuth: vi.fn() } as never))
  it('uses the Google G asset in the Google action', () => {
    render(<AuthScreen />)
    const button = screen.getByRole('button', { name: 'Continue with Google' })
    expect(button.querySelector('img')).toHaveAttribute('src', '/brand/google-g.svg')
  })
})
