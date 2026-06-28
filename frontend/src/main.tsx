import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, useParams } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { RouterBridge } from './RouterBridge'
import { SharedWatchlist } from './views/SharedWatchlist'

// Public read-only shared watchlist, /s/:token — bypasses the app shell.
function SharedRoute() {
  const { token } = useParams()
  return <SharedWatchlist token={token ?? ''} />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      {/* Bridge keeps URL <-> store in sync for the main app routes. */}
      <RouterBridge />
      <Routes>
        <Route path="/s/:token" element={<SharedRoute />} />
        {/* Everything else renders the app shell; the bridge derives the view
            from the path, so a single element serves all app routes. */}
        <Route path="*" element={<App />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
