import { useState, useEffect } from 'react'

// Returns true when the viewport is ≤768px wide. Uses matchMedia so it reacts
// to resizes without polling.
export function useIsMobile(breakpoint = 768): boolean {
  const query = `(max-width: ${breakpoint}px)`
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia(query).matches
  })
  useEffect(() => {
    const mq = window.matchMedia(query)
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)
    if (mq.addEventListener) {
      mq.addEventListener('change', handler)
      return () => mq.removeEventListener('change', handler)
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(mq as any).addListener(handler)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return () => (mq as any).removeListener(handler)
    }
  }, [query])
  return matches
}
