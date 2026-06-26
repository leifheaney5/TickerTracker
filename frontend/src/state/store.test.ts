import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useStore } from './store'

beforeEach(() => { useStore.setState({ currentUser: null }) })

describe('auth store', () => {
  it('login sets currentUser', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ user: { id: 1, email: 'a@b.com', name: '', email_verified: true } }) }) as never
    const res = await useStore.getState().login('a@b.com', 'password123')
    expect(res.ok).toBe(true)
    expect(useStore.getState().currentUser?.email).toBe('a@b.com')
  })
  it('login failure returns error', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'invalid email or password' }) }) as never
    const res = await useStore.getState().login('a@b.com', 'x')
    expect(res.ok).toBe(false)
    expect(useStore.getState().currentUser).toBeNull()
  })
})
