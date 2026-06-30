import { describe, it, expect, beforeEach, vi } from 'vitest'

// Reset module between tests so store state is fresh.
beforeEach(() => {
  vi.resetModules()
})

describe('toastStore', () => {
  it('pushToast adds a toast to the list', async () => {
    const { useToastStore } = await import('./toastStore')
    const { pushToast } = useToastStore.getState()
    pushToast('hello world', { kind: 'info' })
    const { toasts } = useToastStore.getState()
    expect(toasts).toHaveLength(1)
    expect(toasts[0].message).toBe('hello world')
    expect(toasts[0].kind).toBe('info')
  })

  it('dismissToast removes the toast by id', async () => {
    const { useToastStore } = await import('./toastStore')
    const { pushToast, dismissToast } = useToastStore.getState()
    pushToast('bye', { kind: 'success' })
    const id = useToastStore.getState().toasts[0].id
    dismissToast(id)
    expect(useToastStore.getState().toasts).toHaveLength(0)
  })

  it('each toast has a unique id', async () => {
    const { useToastStore } = await import('./toastStore')
    const { pushToast } = useToastStore.getState()
    pushToast('a', { kind: 'info' })
    pushToast('b', { kind: 'alert' })
    const { toasts } = useToastStore.getState()
    expect(toasts[0].id).not.toBe(toasts[1].id)
  })
})
