// Ticker Tracker — service worker (Web Push + offline shell)
// Handles push events from the server and notificationclick to deep-link into
// the app. Kept minimal: no offline cache — the PWA manifest already handles
// that in the app shell.

self.addEventListener('push', (event) => {
  let data = {}
  if (event.data) {
    try {
      data = event.data.json()
    } catch {
      data = { title: 'Ticker Tracker', body: event.data.text() }
    }
  }
  const title = data.title || 'Ticker Tracker'
  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/favicon-32.png',
    data: { url: data.url || '/' },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      // If the app is already open, focus it and navigate.
      for (const client of list) {
        if ('focus' in client) {
          client.focus()
          if ('navigate' in client) client.navigate(url)
          return
        }
      }
      // Otherwise open a new window.
      if (clients.openWindow) return clients.openWindow(url)
    })
  )
})
