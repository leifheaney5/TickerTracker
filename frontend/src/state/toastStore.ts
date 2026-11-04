// Toast store — lightweight Zustand slice for in-app notifications.
// Rendered by <Toaster /> near the app root. Auto-dismiss after a configurable
// timeout; only fires are transition-detected alerts, success confirmations, etc.

import { create } from 'zustand'

export type ToastKind = 'info' | 'success' | 'alert'

export interface Toast {
  id: string
  message: string
  kind: ToastKind
}

interface ToastState {
  toasts: Toast[]
  pushToast: (message: string, opts?: { kind?: ToastKind; durationMs?: number }) => void
  dismissToast: (id: string) => void
}

let _counter = 0
function nextId(): string {
  return `toast_${++_counter}_${Date.now()}`
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  pushToast: (message, opts = {}) => {
    const id = nextId()
    const kind = opts.kind ?? 'info'
    const durationMs = opts.durationMs ?? 4500
    set((st) => ({ toasts: [...st.toasts, { id, message, kind }] }))
    // Auto-dismiss
    setTimeout(() => {
      set((st) => ({ toasts: st.toasts.filter((t) => t.id !== id) }))
    }, durationMs)
  },

  dismissToast: (id) => {
    set((st) => ({ toasts: st.toasts.filter((t) => t.id !== id) }))
  },
}))
