import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import "./index.css"
import App from "./App.jsx"
import RootErrorBoundary from "./components/RootErrorBoundary.jsx"
import { bootSupabaseEnvReport } from "./utils/supabaseEnvBoot.js"
import { resetFirstEntryTimeline, markTimeline } from "./content/ydsFirstEntryTimeline.js"
import {
  checkAndEvictStaleBuild,
  clearAllCacheStorage,
  clearChunkRecoveryFlag,
  installChunkLoadFailureRecovery,
  installLifecycleVersionPoller,
  installOnlineBuildRecheck,
  isChunkRecoveryPending,
  isIosStandalone,
  notifyUpdateAvailable,
  unregisterAllServiceWorkers,
} from "./utils/pwaFreshness.js"

const PANIC_MAIN_STORAGE_KEY = "yds-panic-main-v2"
const APP_BUILD_ID = String(import.meta.env.VITE_APP_BUILD_ID ?? "dev")
const APP_VERSION_LABEL = String(import.meta.env.VITE_APP_VERSION_LABEL ?? "").trim() || "dev"
const APP_VERSION = `App ${APP_VERSION_LABEL} (${APP_BUILD_ID.slice(-8)})`
const RUNTIME_CACHE_PREFIX = "yds-cache-"

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

async function cleanupLegacyRuntimeCaches(currentBuildId) {
  if (typeof window === "undefined" || typeof caches === "undefined") return
  const keepToken = `-${currentBuildId}-`
  try {
    const keys = await caches.keys()
    await Promise.all(
      keys
        .filter((name) => name.startsWith(RUNTIME_CACHE_PREFIX) && !name.includes(keepToken))
        .map((name) => caches.delete(name)),
    )
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
  resetFirstEntryTimeline()
  installChunkLoadFailureRecovery()

  if (typeof window !== "undefined") {
    window.onerror = (message, source, lineno, colno, error) => {
      console.error("[window.onerror]", { message, source, lineno, colno, error })
    }
    window.addEventListener("unhandledrejection", (event) => {
      console.error("[unhandledrejection]", event.reason)
    })
    const currentUrl = new URL(window.location.href)
    if (currentUrl.searchParams.get("reset-cache") === "true") {
      console.warn("[PWA] reset-cache requested; clearing SW/cache/storage/indexedDB")
      await forceResetAllClientState()
      currentUrl.searchParams.delete("reset-cache")
      window.location.replace(`${currentUrl.pathname}${currentUrl.search}`)
      return
    }
  }

  markTimeline("SW_START", { segment: "sw" })
  const gate = await checkAndEvictStaleBuild()
  if (gate.reloaded) return

  try {
    const { registerSW } = await import("virtual:pwa-register")
    let applySwUpdate = () => {
      window.location.reload()
    }
    let swRefreshing = false
    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        if (isChunkRecoveryPending()) return
        notifyUpdateAvailable("sw-need-refresh", gate.remote)
        void applySwUpdate()
      },
      onOfflineReady() {
        // no-op
      },
      onRegisteredSW(_swUrl, registration) {
        if (!registration) return
        const activateWaiting = () => {
          if (registration.waiting) {
            registration.waiting.postMessage({ type: "SKIP_WAITING" })
          }
        }
        activateWaiting()
        registration.addEventListener("updatefound", () => {
          const worker = registration.installing
          worker?.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              activateWaiting()
            }
          })
        })
        registration.addEventListener("controllerchange", () => {
          void cleanupLegacyRuntimeCaches(APP_BUILD_ID)
          if (swRefreshing) return
          swRefreshing = true
          window.location.reload()
        })
        window.setInterval(() => {
          void registration.update()
        }, 60 * 60 * 1000)
      },
    })
    applySwUpdate = updateSW
    if (typeof window !== "undefined") {
      window.__YDS_UPDATE_SW = updateSW
    }
  } catch (e) {
    console.warn("[PWA] Service Worker registration unavailable", e)
  }
  markTimeline("SW_END", { segment: "sw" })

  cleanupStaleAutoSnapshot()

  void bootSupabaseEnvReport()

  installLifecycleVersionPoller()
  installOnlineBuildRecheck()

  console.log("[PWA] boot", {
    appVersion: APP_VERSION,
    appBuildId: APP_BUILD_ID,
    iosStandalone: isIosStandalone(),
    remoteBuildId: gate.remote?.buildId ?? null,
  })

  clearChunkRecoveryFlag()
  try {
    const bootUrl = new URL(window.location.href)
    if (bootUrl.searchParams.get("recovered") === "1") {
      bootUrl.searchParams.delete("recovered")
      window.history.replaceState(null, "", `${bootUrl.pathname}${bootUrl.search}${bootUrl.hash}`)
    }
  } catch {
    // ignore
  }

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
    const { showChunkRecoveryFallback } = await import("./utils/pwaFreshness.js")
    showChunkRecoveryFallback()
  }
}

void bootstrapApp()
