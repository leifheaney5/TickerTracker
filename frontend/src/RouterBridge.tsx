// RouterBridge — keeps the URL and the Zustand store in sync.
//
// store → URL: setView/setSelected call the navigate fn we register here.
// URL → store: on every location change (incl. back/forward + initial load),
//   derive the view + selected ticker from the path and apply them to the store
//   WITHOUT re-triggering navigation (applyFromUrl guards that).
//
// Renders nothing.

import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useStore, registerNavigate, applyFromUrl } from './state/store'
import { viewForPath, tickerForPath, pathForView } from './routes'

export function RouterBridge() {
  const navigate = useNavigate()
  const location = useLocation()

  // Register the navigate fn so store actions can drive the URL.
  useEffect(() => {
    registerNavigate((path, opts) => navigate(path, { replace: opts?.replace }))
    return () => registerNavigate(null)
  }, [navigate])

  // URL → store on every path change.
  useEffect(() => {
    const path = location.pathname
    const setView = useStore.getState().setView
    const setSelected = useStore.getState().setSelected

    const ticker = tickerForPath(path)
    if (ticker) {
      applyFromUrl(() => { setSelected(ticker); setView('dashboard') })
      return
    }

    const view = viewForPath(path)
    if (view) {
      applyFromUrl(() => setView(view as never))
      return
    }

    // Unknown path (incl. '/'): redirect to the dashboard route. ('/s/:token' is
    // handled by a separate <Route> in main.tsx and never reaches this bridge.)
    navigate(pathForView('dashboard'), { replace: true })
  }, [location.pathname, navigate])

  return null
}
