import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import "./index.css"
import App from "./App.jsx"

const FRESHNESS_FIRST_MODE = false
const PANIC_MAIN_STORAGE_KEY = "yds-panic-main-v2"
const APP_VERSION = `App Version ${new Date().toISOString().slice(0, 10).replace(/-/g, ".")}.${String(import.meta.env.VITE_APP_BUILD_ID ?? "dev").slice(-1)}`

async function unregisterAllServiceWorkers() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return
  try {
    const regs = await navigator.serviceWorker.getRegistrations()
    await Promise.all(regs.map((r) => r.unregister()))
  } catch {
    // ignore
  }
}

async function clearAllCaches() {
  if (typeof window === "undefined" || !("caches" in window)) return
  try {
    const keys = await caches.keys()
    await Promise.all(keys.map((k) => caches.delete(k)))
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

async function forceLatestManifestFetch() {
  try {
    await fetch(`/manifest.json?t=${Date.now()}`, {
      cache: "no-store",
      headers: {
        Pragma: "no-cache",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    })
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
    // manual snapshot은 보존, 자동 baseline snapshot만 부팅 시 정리
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

function getCacheBustUrl() {
  if (typeof window === "undefined") return "/"
  const next = new URL(window.location.href)
  next.searchParams.set("pwa_v", String(Date.now()))
  return `${next.pathname}${next.search}`
}

function forceIosBootRefreshOnce() {
  if (!isIosStandalone()) return
  if (typeof window === "undefined") return
  const key = "ios-pwa-boot-refresh-once"
  if (window.sessionStorage.getItem(key) === "1") return
  window.sessionStorage.setItem(key, "1")
  window.location.replace(getCacheBustUrl())
}

async function disableLegacySwOnIosStandalone() {
  if (!isIosStandalone()) return
  if (!("serviceWorker" in navigator)) return
  try {
    const regs = await navigator.serviceWorker.getRegistrations()
    await Promise.all(regs.map((r) => r.unregister()))
  } catch {
    // ignore
  }
}

async function fetchRemoteBuildMeta() {
  const res = await fetch(`/build-version.json?t=${Date.now()}`, {
    cache: "no-store",
    headers: {
      Pragma: "no-cache",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  })
  if (!res.ok) return null
  return res.json()
}

async function syncBuildVersionOnIOS() {
  if (!isIosStandalone()) return
  if (typeof window === "undefined") return
  try {
    const remote = await fetchRemoteBuildMeta()
    if (!remote?.buildId) return
    const key = "yds-last-seen-build-id"
    const seen = window.localStorage.getItem(key)
    if (!seen) {
      window.localStorage.setItem(key, String(remote.buildId))
      return
    }
    if (seen === String(remote.buildId)) return
    showUpdateToast("새 버전 감지 · 앱 재시작")
    await disableLegacySwOnIosStandalone()
    await clearAllCaches()
    window.localStorage.setItem(key, String(remote.buildId))
    window.setTimeout(() => {
      window.location.replace(getCacheBustUrl())
    }, 400)
  } catch {
    // ignore
  }
}

function showUpdateToast(message) {
  if (typeof document === "undefined") return
  const el = document.createElement("div")
  el.textContent = message
  el.style.position = "fixed"
  el.style.left = "50%"
  el.style.bottom = "20px"
  el.style.transform = "translateX(-50%)"
  el.style.zIndex = "99999"
  el.style.padding = "10px 14px"
  el.style.borderRadius = "10px"
  el.style.fontSize = "12px"
  el.style.fontWeight = "600"
  el.style.color = "#bbf7d0"
  el.style.background = "rgba(6, 78, 59, 0.92)"
  el.style.border = "1px solid rgba(74, 222, 128, 0.35)"
  document.body.appendChild(el)
  window.setTimeout(() => {
    el.remove()
  }, 1700)
}

if (FRESHNESS_FIRST_MODE) {
  // cleanup is now awaited in bootstrap()
}

async function bootstrapApp() {
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

  if (FRESHNESS_FIRST_MODE) {
    await unregisterAllServiceWorkers()
    await clearAllCaches()
    cleanupStaleAutoSnapshot()
  }
  // Stage 1 policy: keep PWA install surface only, disable runtime SW caching.
  await unregisterAllServiceWorkers()

  forceIosBootRefreshOnce()
  await forceLatestManifestFetch()
  await syncBuildVersionOnIOS()
  const cacheKeys = typeof window !== "undefined" && "caches" in window ? await caches.keys() : []
  console.log("[PWA] boot", { appVersion: APP_VERSION, cacheKeys, sw: "disabled" })

  if (typeof document !== "undefined" && isIosStandalone()) {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        void syncBuildVersionOnIOS()
      }
    })
  }

  createRoot(document.getElementById("root")).render(
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>,
  )
}

void bootstrapApp()
