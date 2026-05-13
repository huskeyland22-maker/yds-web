import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import "./index.css"
import App from "./App.jsx"

const PANIC_MAIN_STORAGE_KEY = "yds-panic-main-v2"
const BUILD_ID_KEY = "yds-build-id"
const BUILD_VERSION_KEY = "yds-build-version"
const LAST_VERSION_POLL_KEY = "yds-last-version-poll-at"
const HARD_RELOAD_AT_KEY = "yds-hard-reload-at"
const HARD_RELOAD_COOLDOWN_MS = 6000
const VERSION_POLL_COOLDOWN_MS = 8000
const APP_BUILD_ID = String(import.meta.env.VITE_APP_BUILD_ID ?? "dev")
const APP_VERSION = `App Version ${new Date().toISOString().slice(0, 10).replace(/-/g, ".")}.${APP_BUILD_ID.slice(-1)}`

async function unregisterAllServiceWorkers() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return
  try {
    const regs = await navigator.serviceWorker.getRegistrations()
    await Promise.all(regs.map((r) => r.unregister().catch(() => null)))
  } catch {
    // ignore
  }
}

async function clearAllCaches() {
  if (typeof window === "undefined" || !("caches" in window)) return
  try {
    const keys = await caches.keys()
    await Promise.all(keys.map((k) => caches.delete(k).catch(() => null)))
  } catch {
    // ignore
  }
}

async function clearAllIndexedDB() {
  if (typeof window === "undefined" || typeof indexedDB === "undefined") return
  try {
    if (typeof indexedDB.databases === "function") {
      const dbs = await indexedDB.databases()
      await Promise.all(
        (dbs || [])
          .map((db) => db?.name)
          .filter(Boolean)
          .map(
            (name) =>
              new Promise((resolve) => {
                const req = indexedDB.deleteDatabase(name)
                req.onsuccess = () => resolve()
                req.onerror = () => resolve()
                req.onblocked = () => resolve()
              }),
          ),
      )
    }
  } catch {
    // ignore
  }
}

async function forceResetAllClientState() {
  await unregisterAllServiceWorkers()
  await clearAllCaches()
  await clearAllIndexedDB()
  try {
    if (typeof window !== "undefined") {
      window.localStorage.clear()
      window.sessionStorage.clear()
    }
  } catch {
    // ignore
  }
}

function cleanupStaleAutoSnapshot() {
  if (typeof window === "undefined") return
  try {
    const raw = window.localStorage.getItem(PANIC_MAIN_STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object") {
      window.localStorage.removeItem(PANIC_MAIN_STORAGE_KEY)
      return
    }
    // 사용자 manual snapshot은 절대 폐기하지 않음 — auto baseline 만 부팅 시 정리
    if (!parsed.isManual) {
      window.localStorage.removeItem(PANIC_MAIN_STORAGE_KEY)
    }
  } catch {
    window.localStorage.removeItem(PANIC_MAIN_STORAGE_KEY)
  }
}

function isIosStandalone() {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false
  const ua = navigator.userAgent || ""
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  const standalone = window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true
  return ios && standalone
}

function buildCacheBustUrl(extra) {
  if (typeof window === "undefined") return "/"
  const next = new URL(window.location.href)
  next.searchParams.set("pwa_v", String(Date.now()))
  if (extra?.key) next.searchParams.set(extra.key, extra.value)
  return `${next.pathname}${next.search}`
}

async function hardReloadWithCooldown(reason) {
  if (typeof window === "undefined") return false
  try {
    const last = Number(window.sessionStorage.getItem(HARD_RELOAD_AT_KEY) || "0")
    const now = Date.now()
    if (Number.isFinite(last) && now - last < HARD_RELOAD_COOLDOWN_MS) return false
    window.sessionStorage.setItem(HARD_RELOAD_AT_KEY, String(now))
  } catch {
    // ignore
  }
  console.warn("[PWA] runtime hard reload", reason)
  await unregisterAllServiceWorkers()
  await clearAllCaches()
  window.location.replace(buildCacheBustUrl({ key: "reason", value: reason || "runtime" }))
  return true
}

async function fetchRemoteBuildMeta() {
  try {
    const res = await fetch(`/build-version.json?t=${Date.now()}`, {
      cache: "no-store",
      credentials: "omit",
      headers: {
        Pragma: "no-cache",
        "Cache-Control": "no-cache, no-store, must-revalidate, max-age=0",
      },
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

async function pollLatestBuildAndReloadIfStale() {
  if (typeof window === "undefined") return
  try {
    const lastAt = Number(window.sessionStorage.getItem(LAST_VERSION_POLL_KEY) || "0")
    const now = Date.now()
    if (Number.isFinite(lastAt) && now - lastAt < VERSION_POLL_COOLDOWN_MS) return
    window.sessionStorage.setItem(LAST_VERSION_POLL_KEY, String(now))
  } catch {
    // ignore
  }

  const remote = await fetchRemoteBuildMeta()
  if (!remote?.buildId) return

  if (String(remote.buildId) !== APP_BUILD_ID) {
    await hardReloadWithCooldown("runtime-build-mismatch")
    return
  }

  try {
    window.localStorage.setItem(BUILD_ID_KEY, String(remote.buildId))
    if (typeof remote.version === "string" && remote.version) {
      window.localStorage.setItem(BUILD_VERSION_KEY, remote.version)
    }
  } catch {
    // ignore
  }
}

function installChunkLoadFailureRecovery() {
  if (typeof window === "undefined") return
  const isAssetUrl = (url) => typeof url === "string" && url.includes("/assets/")
  const trigger = () => {
    void hardReloadWithCooldown("chunk-load-error")
  }

  window.addEventListener(
    "error",
    (event) => {
      const target = event?.target
      if (!target || target === window) return
      const tag = target.tagName
      if (tag !== "SCRIPT" && tag !== "LINK") return
      const src = target.src || target.href
      if (isAssetUrl(src)) trigger()
    },
    true,
  )

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event?.reason
    const msg = String(reason?.message || reason || "")
    if (/Failed to fetch dynamically imported module|Importing a module script failed|ChunkLoadError/i.test(msg)) {
      trigger()
    }
  })
}

function installLifecycleVersionPoller() {
  if (typeof window === "undefined" || typeof document === "undefined") return
  const onVisible = () => {
    if (document.visibilityState === "visible") void pollLatestBuildAndReloadIfStale()
  }
  const onFocus = () => void pollLatestBuildAndReloadIfStale()
  const onPageShow = () => void pollLatestBuildAndReloadIfStale()

  document.addEventListener("visibilitychange", onVisible)
  window.addEventListener("focus", onFocus)
  window.addEventListener("pageshow", onPageShow)
}

async function bootstrapApp() {
  installChunkLoadFailureRecovery()

  if (typeof window !== "undefined") {
    const currentUrl = new URL(window.location.href)
    if (currentUrl.searchParams.get("reset-cache") === "true") {
      console.warn("[PWA] reset-cache requested; clearing SW/cache/storage/indexedDB")
      await forceResetAllClientState()
      currentUrl.searchParams.delete("reset-cache")
      window.location.replace(`${currentUrl.pathname}${currentUrl.search}`)
      return
    }
  }

  // Always strip any stale Service Worker that older deployments may have installed.
  await unregisterAllServiceWorkers()
  cleanupStaleAutoSnapshot()

  // Persist the build id we are actually running so the next launch can detect drift.
  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(BUILD_ID_KEY, APP_BUILD_ID)
    }
  } catch {
    // ignore
  }

  installLifecycleVersionPoller()

  // iOS standalone: poll a few extra times during the first minute since iOS will
  // resume the WebView from a frozen state and may not fire visibilitychange.
  if (isIosStandalone()) {
    let ticks = 0
    const id = window.setInterval(() => {
      ticks += 1
      void pollLatestBuildAndReloadIfStale()
      if (ticks >= 6) window.clearInterval(id)
    }, 10_000)
  }

  console.log("[PWA] boot", { appVersion: APP_VERSION, appBuildId: APP_BUILD_ID, iosStandalone: isIosStandalone() })

  createRoot(document.getElementById("root")).render(
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>,
  )
}

void bootstrapApp()
