// Legacy Firebase Messaging Service Worker — DISABLED.
// If an older deployment registered this SW on a user's device (especially an
// iOS standalone PWA), we never want it to serve cached responses again.
// This file is now a *kill-switch* worker: on install/activate it unregisters
// itself, deletes every Cache Storage entry it can see, and asks all controlled
// clients to reload so they fetch a fresh, uncached HTML.

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys()
        await Promise.all(keys.map((k) => caches.delete(k).catch(() => null)))
      } catch {
        // ignore
      }
      try {
        await self.registration.unregister()
      } catch {
        // ignore
      }
      try {
        const clientList = await self.clients.matchAll({ type: "window", includeUncontrolled: true })
        for (const client of clientList) {
          try {
            client.navigate(client.url)
          } catch {
            // ignore
          }
        }
      } catch {
        // ignore
      }
    })(),
  )
})

self.addEventListener("fetch", () => {
  // Intentionally pass-through: never serve from cache.
})
