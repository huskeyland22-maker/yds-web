/**
 * YDS PWA — 아이콘·매니페스트만 선캐시.
 * index.html·JS 번들은 네트워크 우선이라 배포 후 옛 "불러오기 실패" 문구가 남지 않게 함.
 */
const CACHE = "yds-pwa-v3"
const PRECACHE_URLS = ["/manifest.json", "/icon-192.png", "/icon-512.png", "/favicon.svg"]

self.addEventListener("install", (event) => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.allSettled(
        PRECACHE_URLS.map((url) =>
          cache.add(new Request(url, { cache: "reload" })).catch(() => null),
        ),
      ),
    ),
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener("fetch", (event) => {
  const { request } = event
  if (request.method !== "GET") return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (url.pathname === "/panic-data" || url.pathname.includes("/api/")) {
    event.respondWith(fetch(request).catch(() => caches.match("/index.html")))
    return
  }

  const accept = request.headers.get("accept") || ""
  const isDocument = request.mode === "navigate" || accept.includes("text/html")

  if (isDocument) {
    event.respondWith(
      fetch(request).catch(() => caches.match("/index.html")),
    )
    return
  }

  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res && res.ok && res.type === "basic") {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {})
          }
          return res
        })
        .catch(() => caches.match(request)),
    )
    return
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request)
        .then((res) => {
          if (!res || res.status !== 200 || res.type !== "basic") {
            return res
          }
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {})
          return res
        })
        .catch(() => caches.match("/index.html"))
    }),
  )
})
