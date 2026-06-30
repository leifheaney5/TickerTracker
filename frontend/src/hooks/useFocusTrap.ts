// useFocusTrap — constrains Tab/Shift-Tab to a modal container and restores
// focus to the trigger element on close. Supports an optional onEscape callback
// for Escape-to-close. Dependency-free; no external libraries needed.

import { useEffect, useRef } from 'react'

const FOCUSABLE_SELECTORS = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

/**
 * Returns a ref to attach to the modal container element.
 *
 * @param active    Whether the trap is currently active (component is visible).
 * @param onEscape  Optional callback fired when the user presses Escape.
 *
 * Usage:
 *   const containerRef = useFocusTrap(isOpen, closeModal)
 *   <div ref={containerRef} role="dialog" ...>...</div>
 */
export function useFocusTrap(
  active: boolean,
  onEscape?: () => void,
): React.RefObject<HTMLDivElement | null> {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!active) return

    // Capture the element that had focus before the modal opened so we can
    // restore it when the modal closes.
    previousFocusRef.current = document.activeElement as HTMLElement

    // Move focus into the modal: first focusable element, or the container itself.
    const container = containerRef.current
    if (container) {
      const focusable = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)
      if (focusable.length > 0) {
        focusable[0].focus()
      } else {
        container.setAttribute('tabindex', '-1')
        container.focus()
      }
    }

    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape' && onEscape) {
        e.preventDefault()
        onEscape()
        return
      }

      if (e.key !== 'Tab' || !containerRef.current) return

      const focusable = Array.from(
        containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS),
      ).filter((el) => !el.closest('[hidden]') && el.offsetParent !== null)

      if (focusable.length === 0) {
        e.preventDefault()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      // Return focus to the element that triggered the modal.
      previousFocusRef.current?.focus()
    }
  }, [active, onEscape])

  return containerRef
}
