const SW_VERSION = "panic-app-v5"
const API_PATHS = ["/panic-data", "/panic", "/api/market-data", "/market-data", "/signals", "/api/"]

self.addEventListener("install", (event) => {
  self.skipWaiting()
  event.waitUntil(Promise.resolve())
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.map((key) => caches.delete(key)))
      await self.clients.claim()
    })(),
  )
})

function shouldHandle(url) {
  return API_PATHS.some((path) => url.pathname.startsWith(path))
}

self.addEventListener("fetch", (event) => {
  const req = event.request
  if (req.method !== "GET") return
  const url = new URL(req.url)
  if (!shouldHandle(url)) return

  // API requests are network-only to prevent stale runtime cache lock.
  event.respondWith(fetch(req, { cache: "no-store" }))
})

self.addEventListener("message", (event) => {
  if (event?.data?.type === "SW_VERSION") {
    event.source?.postMessage?.({ type: "SW_VERSION", version: SW_VERSION })
  }
})
