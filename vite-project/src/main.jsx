import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import "./index.css"
import App from "./App.jsx"
import RootErrorBoundary from "./components/RootErrorBoundary.jsx"
import {
  checkAndEvictStaleBuild,
  clearAllCacheStorage,
  installChunkLoadFailureRecovery,
  installLifecycleVersionPoller,
  installOnlineBuildRecheck,
  invalidateServiceWorkerCachesAfterBuildMismatch,
  isIosStandalone,
  unregisterAllServiceWorkers,
} from "./utils/pwaFreshness.js"

const PANIC_MAIN_STORAGE_KEY = "yds-panic-main-v2"
const APP_BUILD_ID = String(import.meta.env.VITE_APP_BUILD_ID ?? "dev")
const APP_VERSION_LABEL = String(import.meta.env.VITE_APP_VERSION_LABEL ?? "").trim() || "dev"
const APP_VERSION = `App ${APP_VERSION_LABEL} (${APP_BUILD_ID.slice(-8)})`

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
  await clearAllCacheStorage()
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

  // index.html's boot loader has already run the freshness gate, but if a user
  // arrives via bfcache (iOS sometimes restores a frozen WebView without re-
  // running module scripts) the gate is re-armed here as a second line of
  // defense. checkAndEvictStaleBuild() short-circuits if everything matches.
  await invalidateServiceWorkerCachesAfterBuildMismatch()

  const gate = await checkAndEvictStaleBuild()
  if (gate.reloaded) {
    window.setTimeout(() => {
      const rootEl = document.getElementById("root")
      if (rootEl && rootEl.childElementCount === 0) {
        console.warn("[PWA] stale-build reload did not replace page — mounting app anyway")
        try {
          createRoot(rootEl).render(
            <StrictMode>
              <RootErrorBoundary>
                <BrowserRouter>
                  <App />
                </BrowserRouter>
              </RootErrorBoundary>
            </StrictMode>,
          )
        } catch (e) {
          console.error("[BOOT] recovery mount failed", e)
        }
      }
    }, 5000)
    return
  }

  try {
    const { registerSW } = await import("virtual:pwa-register")
    registerSW({ immediate: true })
  } catch (e) {
    console.warn("[PWA] Service Worker registration unavailable", e)
  }

  cleanupStaleAutoSnapshot()

  installLifecycleVersionPoller()
  installOnlineBuildRecheck()

  console.log("[PWA] boot", {
    appVersion: APP_VERSION,
    appBuildId: APP_BUILD_ID,
    iosStandalone: isIosStandalone(),
    remoteBuildId: gate.remote?.buildId ?? null,
  })

  try {
    const rootEl = document.getElementById("root")
    if (!rootEl) throw new Error("missing #root")
    createRoot(rootEl).render(
      <StrictMode>
        <RootErrorBoundary>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </RootErrorBoundary>
      </StrictMode>,
    )
  } catch (e) {
    console.error("[BOOT] createRoot failed", e)
    const el = document.getElementById("root")
    if (el) {
      el.textContent = "앱을 불러오지 못했습니다. 새로고침 해 주세요."
    }
  }
}

void bootstrapApp()
