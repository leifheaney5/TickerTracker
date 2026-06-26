import { useStore } from '../state/store'

/** Returns a gated action runner. If the user is authed, runs the action
 *  immediately; otherwise opens the AuthScreen modal. */
export function useRequireAuth() {
  const isAuthed = useStore((s) => s.currentUser !== null)
  const openAuth = useStore((s) => s.openAuth)
  return (action: () => void) => {
    if (isAuthed) action()
    else openAuth()
  }
}
