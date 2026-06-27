// useKeyboardShortcuts — attaches a single window keydown listener that drives
// view navigation, search focus, and the help overlay. Safe: ignores events
// that originate from inputs/textareas/selects/contentEditable elements so
// typing in forms is never hijacked.

import { useEffect, useRef, useState } from 'react'
import { useStore, type View } from '../state/store'

// Pure mapping: second key of the "g then letter" sequence → View.
// Exported so it can be unit-tested without DOM / React.
export function viewForKey(letter: string): View | null {
  const map: Record<string, View> = {
    d: 'dashboard',
    w: 'managewatch',
    s: 'screener',
    c: 'crypto',
    m: 'market',
  }
  return map[letter] ?? null
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!target) return false
  const el = target as HTMLElement
  const tag = el.tagName?.toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true
  if (el.isContentEditable) return true
  return false
}

export function useKeyboardShortcuts() {
  const [helpOpen, setHelpOpen] = useState(false)
  // Track pending "g" prefix with a ref — no re-render needed.
  const gPending = useRef(false)
  const gTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (isEditableTarget(e.target)) return

      const key = e.key

      // Escape: close help overlay
      if (key === 'Escape') {
        if (helpOpen) {
          setHelpOpen(false)
          return
        }
      }

      // ? (shift+/): toggle help overlay
      if (key === '?') {
        e.preventDefault()
        setHelpOpen((o) => !o)
        return
      }

      // /: open search and focus the input
      if (key === '/') {
        e.preventDefault()
        const { setSearchOpen } = useStore.getState()
        setSearchOpen(true)
        // Defer focus so the input is rendered before we try to focus it
        setTimeout(() => {
          const input = document.querySelector<HTMLInputElement>(
            'input[aria-label="Search ticker or company"]'
          )
          input?.focus()
        }, 50)
        return
      }

      // "g then letter" navigation sequence
      if (gPending.current) {
        // Clear the pending flag and timer regardless
        gPending.current = false
        if (gTimer.current !== null) {
          clearTimeout(gTimer.current)
          gTimer.current = null
        }
        const view = viewForKey(key)
        if (view) {
          e.preventDefault()
          useStore.getState().setView(view)
        }
        return
      }

      // Start "g" prefix
      if (key === 'g') {
        gPending.current = true
        // Auto-clear after 1 second if no follow-up key
        gTimer.current = setTimeout(() => {
          gPending.current = false
          gTimer.current = null
        }, 1000)
        return
      }
    }

    window.addEventListener('keydown', handler)
    return () => {
      window.removeEventListener('keydown', handler)
      if (gTimer.current !== null) clearTimeout(gTimer.current)
    }
  // helpOpen in deps so the Escape branch reads the current value
  }, [helpOpen])

  return { helpOpen, setHelpOpen }
}
