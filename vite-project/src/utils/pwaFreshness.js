// -----------------------------------------------------------------------------
// PWA freshness — network-first / realtime-first (no offline-first data SW)
//
// Boot + lifecycle:
//   1) read build id from HTML (<meta name="app-build-id">)
//   2) fetch /build-version.json via `liveDataFetch` (no-store + bust query)
//   3) on mismatch: unregister all SW → clear Cache Storage → purge build-scoped LS → hard reload
//
// Architecture: hashed `/assets/*` only are long-lived (Vite); HTML/JSON/API are never SW-cached.
// iOS standalone: optional one-shot Cache Storage sweep after SW unregister (`sweepIosStandaloneCachesOnce`).
// Future Capacitor WebView: keep one origin; do not add a second precache SW for market data.
//
// Imported from index.html boot (before main bundle) and main.jsx — idempotent installs.
// -----------------------------------------------------------------------------

import { LIVE_JSON_GET_INIT, withNoStoreQuery } from "../config/liveDataFetch.js"

const BUILD_VERSION_ENDPOINT = "/build-version.json"
const BUILD_ID_KEY = "yds-build-id"
const BUILD_VERSION_KEY = "yds-build-version"
const HARD_RELOAD_AT_KEY = "yds-hard-reload-at"
const HARD_RELOAD_COOLDOWN_MS = 6000
const VERSION_POLL_COOLDOWN_MS = 8000

// Explicit list of localStorage keys that are tied to a specific build /
// PWA-runtime instance and should be cleared when we detect a stale build.
// User-content keys (memos, manual panic snapshots, drafts) are NOT in this
// list — we never wipe them on a build refresh.
const BUILD_SCOPED_LS_KEYS = [
  BUILD_ID_KEY,
  BUILD_VERSION_KEY,
  "yds-last-seen-build-id",
  "yds-build-channel",
]
const BUILD_SCOPED_LS_PREFIXES = ["yds-build-", "yds-pwa-build-"]

// Hard allow-list of localStorage keys that must NEVER be removed by the
// build-eviction routine — even by mistake via a prefix match.
const PROTECTED_LS_KEYS = new Set([
  "yds-panic-main-v2",
  "yds-panic-text-draft-v1",
  "yds-investment-memos-v1",
  "yds-cycle-metric-history-v1",
])

/** stale 빌드 eviction 시에만 제거 — 오래된 클라이언트 캐시·스코어 히스토리 정리 (사용자 메모·패닉 수동 스냅샷은 유지) */
const STALE_EVICT_EXTRA_LS_KEYS = [
  "yds-panic-score-history-v1",
  "yds-panic-integration-history-v1",
  "yds-panic-history-v1",
  "yds-panic-notify-on",
  "yds-panic-notify-prev-score",
  "yds-panic-notify-last-ms",
]

// State flags live on `window` rather than module scope because Vite emits the
// boot-loader chunk and the main app chunk as separate entry points, each
// carrying their own copy of this module. Sharing through window guarantees
// install* functions are idempotent across both copies.
const GLOBAL_FLAG_KEY = "__ydsPwaFreshnessState"
const ONLINE_RECHECK_FLAG_KEY = "__ydsOnlineBuildRecheckInstalled"
const VISIBILITY_RESUME_MIN_MS = 2200

function getGlobalState() {
  if (typeof window === "undefined")
    return {
      chunkRecoveryInstalled: false,
      lifecyclePollerInstalled: false,
      lastPollAt: 0,
      lastLifecycleResumeCheckAt: 0,
    }
  if (!window[GLOBAL_FLAG_KEY]) {
    window[GLOBAL_FLAG_KEY] = {
      chunkRecoveryInstalled: false,
      lifecyclePollerInstalled: false,
      lastPollAt: 0,
      lastLifecycleResumeCheckAt: 0,
    }
  }
  return window[GLOBAL_FLAG_KEY]
}

function publishBuildProbeSnapshot(partial) {
  if (typeof window === "undefined") return
  try {
    const prev =
      window.__YDS_BUILD_CHECK && typeof window.__YDS_BUILD_CHECK === "object" ? window.__YDS_BUILD_CHECK : {}
    window.__YDS_BUILD_CHECK = {
      ...prev,
      ...partial,
      probeAt: Date.now(),
    }
  } catch {
    // ignore
  }
}

function safeRead(area, key) {
  try {
    return typeof window !== "undefined" ? window[area]?.getItem(key) ?? null : null
  } catch {
    return null
  }
}

function safeWrite(area, key, value) {
  try {
    window[area]?.setItem(key, value)
  } catch {
    // ignore
  }
}

function safeRemove(area, key) {
  try {
    window[area]?.removeItem(key)
  } catch {
    // ignore
  }
}

export function readHtmlBuildId() {
  if (typeof document === "undefined") return ""
  try {
    const meta = document.querySelector('meta[name="app-build-id"]')
    return (meta?.content || "").trim()
  } catch {
    return ""
  }
}

export function isIosStandalone() {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false
  try {
    const ua = navigator.userAgent || ""
    const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
    const standalone =
      window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true
    return ios && standalone
  } catch {
    return false
  }
}

export async function unregisterAllServiceWorkers() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return
  try {
    const regs = await navigator.serviceWorker.getRegistrations()
    await Promise.all(regs.map((r) => r.unregister().catch(() => null)))
    if (regs.length) {
      await new Promise((r) => setTimeout(r, 120))
    }
  } catch {
    // ignore
  }
}

export async function clearAllCacheStorage() {
  if (typeof window === "undefined" || !("caches" in window)) return
  try {
    const keys = await caches.keys()
    await Promise.all(keys.map((k) => caches.delete(k).catch(() => null)))
  } catch {
    // ignore
  }
}

/**
 * iOS 홈 화면 PWA: 세션당 1회 Cache Storage를 비워 stale JS·asset 캐시를 끊습니다.
 * (서비스 워커 제거 직후에 호출하는 것이 안전합니다.)
 */
export async function sweepIosStandaloneCachesOnce() {
  if (typeof window === "undefined" || !isIosStandalone()) return
  try {
    if (safeRead("sessionStorage", "yds-ios-pwa-cache-swept-session")) return
    await clearAllCacheStorage()
    safeWrite("sessionStorage", "yds-ios-pwa-cache-swept-session", "1")
  } catch {
    // ignore
  }
}

/**
 * Remove every localStorage entry that is tied to a build/runtime instance.
 * User-content keys are protected. After this call, the build-tracking
 * pointers (yds-build-id / yds-build-version) are gone so the next boot will
 * always re-write them from the freshly fetched manifest.
 */
export function purgeOldBuildLocalStorage() {
  if (typeof window === "undefined" || !window.localStorage) return
  const ls = window.localStorage

  for (const key of BUILD_SCOPED_LS_KEYS) safeRemove("localStorage", key)

  try {
    const allKeys = []
    for (let i = 0; i < ls.length; i += 1) {
      const k = ls.key(i)
      if (k) allKeys.push(k)
    }
    for (const k of allKeys) {
      if (PROTECTED_LS_KEYS.has(k)) continue
      if (BUILD_SCOPED_LS_PREFIXES.some((p) => k.startsWith(p))) {
        safeRemove("localStorage", k)
      }
    }
  } catch {
    // ignore
  }
}

function buildCacheBustUrl(reason) {
  if (typeof window === "undefined") return "/"
  const next = new URL(window.location.href)
  next.searchParams.set("pwa_v", String(Date.now()))
  if (reason) next.searchParams.set("reason", reason)
  return `${next.pathname}${next.search}`
}

function showUpdateBanner() {
  if (typeof document === "undefined") return
  try {
    if (document.getElementById("yds-pwa-update-banner")) return
    const el = document.createElement("div")
    el.id = "yds-pwa-update-banner"
    el.textContent = "최신 버전으로 업데이트 중…"
    el.style.cssText = [
      "position:fixed",
      "left:50%",
      "top:16px",
      "transform:translateX(-50%)",
      "z-index:99999",
      "padding:8px 14px",
      "border-radius:999px",
      "font-family:ui-sans-serif,system-ui,-apple-system,'Pretendard',sans-serif",
      "font-size:12px",
      "font-weight:600",
      "letter-spacing:0.02em",
      "color:#d1fae5",
      "background:rgba(6,78,59,0.92)",
      "border:1px solid rgba(74,222,128,0.35)",
      "box-shadow:0 6px 18px rgba(0,0,0,0.4)",
      "pointer-events:none",
    ].join(";")
    if (document.body) document.body.appendChild(el)
    else document.documentElement.appendChild(el)
  } catch {
    // ignore
  }
}

/**
 * Full eviction pipeline. Returns true if the page is being reloaded.
 * Honors a 6s cooldown so a misbehaving server can't put us into an
 * infinite reload loop.
 */
export async function evictStaleBuildAndReload(reason, latestMeta) {
  if (typeof window === "undefined") return false

  const now = Date.now()
  const last = Number(safeRead("sessionStorage", HARD_RELOAD_AT_KEY) || "0")
  if (Number.isFinite(last) && last > 0 && now - last < HARD_RELOAD_COOLDOWN_MS) {
    console.warn("[PWA] stale-build detected but cooldown active — skipping reload", reason)
    return false
  }
  safeWrite("sessionStorage", HARD_RELOAD_AT_KEY, String(now))

  console.warn("[PWA] stale build detected — evicting and reloading", { reason, latestMeta })
  showUpdateBanner()

  await unregisterAllServiceWorkers()
  await clearAllCacheStorage()
  purgeOldBuildLocalStorage()
  for (const key of STALE_EVICT_EXTRA_LS_KEYS) {
    safeRemove("localStorage", key)
  }

  if (latestMeta?.buildId) {
    safeWrite("localStorage", BUILD_ID_KEY, String(latestMeta.buildId))
    if (typeof latestMeta.version === "string" && latestMeta.version) {
      safeWrite("localStorage", BUILD_VERSION_KEY, latestMeta.version)
    }
  }

  if (String(reason || "").includes("stale-panic")) {
    try {
      const raw = safeRead("localStorage", "yds-panic-main-v2")
      if (raw) {
        const p = JSON.parse(raw)
        if (!p || p.isManual !== true) safeRemove("localStorage", "yds-panic-main-v2")
      }
    } catch {
      safeRemove("localStorage", "yds-panic-main-v2")
    }
  }

  window.location.replace(buildCacheBustUrl(reason || "stale-build"))
  return true
}

export async function fetchLatestBuildMeta() {
  try {
    const res = await fetch(withNoStoreQuery(BUILD_VERSION_ENDPOINT), {
      ...LIVE_JSON_GET_INIT,
      credentials: "omit",
      mode: "cors",
    })
    if (!res.ok) return null
    const json = await res.json()
    return json && typeof json === "object" ? json : null
  } catch {
    return null
  }
}

/**
 * Inspect HTML build id + stored build id against the latest manifest.
 * Returns { remote, reloaded }. When reloaded === true the caller should
 * bail out — the page is being replaced.
 */
export async function checkAndEvictStaleBuild() {
  if (typeof window === "undefined") return { remote: null, reloaded: false }

  const htmlBuildId = readHtmlBuildId()
  const storedBuildId = safeRead("localStorage", BUILD_ID_KEY)
  const storedVersion = (safeRead("localStorage", BUILD_VERSION_KEY) || "").trim()

  const remote = await fetchLatestBuildMeta()
  if (!remote || !remote.buildId) {
    publishBuildProbeSnapshot({
      htmlBuildId,
      storedBuildId,
      storedVersion,
      remoteBuildId: null,
      remoteVersion: null,
      reloaded: false,
      probeNote: "no_remote_manifest",
    })
    return { remote: null, reloaded: false }
  }

  const remoteBuildId = String(remote.buildId)
  const remoteVersion = typeof remote.version === "string" ? remote.version.trim() : ""

  publishBuildProbeSnapshot({
    htmlBuildId,
    storedBuildId,
    storedVersion,
    remoteBuildId,
    remoteVersion,
    reloaded: false,
    probeNote: "checking",
  })

  if (htmlBuildId && storedBuildId && htmlBuildId !== String(storedBuildId)) {
    publishBuildProbeSnapshot({ mismatch: "html-local-build-desync" })
    const reloaded = await evictStaleBuildAndReload("html-local-build-desync", remote)
    return { remote, reloaded }
  }

  if (htmlBuildId && htmlBuildId !== remoteBuildId) {
    publishBuildProbeSnapshot({ mismatch: "html-build-mismatch" })
    const reloaded = await evictStaleBuildAndReload("html-build-mismatch", remote)
    return { remote, reloaded }
  }

  if (storedBuildId && String(storedBuildId) !== remoteBuildId) {
    publishBuildProbeSnapshot({ mismatch: "client-build-mismatch" })
    const reloaded = await evictStaleBuildAndReload("client-build-mismatch", remote)
    return { remote, reloaded }
  }

  if (remoteVersion && storedVersion && storedVersion !== remoteVersion) {
    publishBuildProbeSnapshot({ mismatch: "client-version-mismatch" })
    const reloaded = await evictStaleBuildAndReload("client-version-mismatch", remote)
    return { remote, reloaded }
  }

  safeWrite("localStorage", BUILD_ID_KEY, remoteBuildId)
  if (remoteVersion) {
    safeWrite("localStorage", BUILD_VERSION_KEY, remoteVersion)
  }
  publishBuildProbeSnapshot({
    mismatch: null,
    aligned: true,
    htmlBuildId,
    storedBuildId: remoteBuildId,
    storedVersion: remoteVersion || storedVersion,
    remoteBuildId,
    remoteVersion,
    reloaded: false,
    probeNote: "ok",
  })
  return { remote, reloaded: false }
}

export async function pollLatestBuildIfDue() {
  const state = getGlobalState()
  const now = Date.now()
  const cooldown = isIosStandalone() ? 4500 : VERSION_POLL_COOLDOWN_MS
  if (now - state.lastPollAt < cooldown) return
  state.lastPollAt = now
  await checkAndEvictStaleBuild()
}

/**
 * Tab focus / visibility — throttled to avoid rapid-fire fetches while still beating iOS cache lag.
 */
export async function checkBuildAfterLifecycleResume() {
  const state = getGlobalState()
  const now = Date.now()
  if (now - state.lastLifecycleResumeCheckAt < VISIBILITY_RESUME_MIN_MS) {
    return { remote: null, reloaded: false, throttled: true }
  }
  state.lastLifecycleResumeCheckAt = now
  return checkAndEvictStaleBuild()
}

export async function getServiceWorkerDebugInfo() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return { registrations: 0, controlling: null, waiting: null, scopes: [] }
  }
  try {
    const regs = await navigator.serviceWorker.getRegistrations()
    const controlling = navigator.serviceWorker.controller?.scriptURL ?? null
    let waiting = null
    for (const r of regs) {
      const w = r.waiting || r.installing
      if (w?.scriptURL) waiting = w.scriptURL
    }
    return {
      registrations: regs.length,
      controlling,
      waiting,
      scopes: regs.map((r) => r.scope),
    }
  } catch {
    return { registrations: 0, controlling: null, waiting: null, scopes: [] }
  }
}

/** 네트워크 복귀 시 즉시 원격 빌드 메타와 대조 (Safari 백그라운드 복귀와 조합). Idempotent. */
export function installOnlineBuildRecheck() {
  if (typeof window === "undefined") return
  if (window[ONLINE_RECHECK_FLAG_KEY]) return
  window[ONLINE_RECHECK_FLAG_KEY] = true
  window.addEventListener("online", () => {
    void checkAndEvictStaleBuild()
  })
}

/**
 * Attach visibility/focus/pageshow listeners and, on iOS standalone, an
 * additional short interval poll for the first ~2 minutes after launch
 * (iOS frozen WebViews don't always fire visibilitychange on resume).
 */
export function installLifecycleVersionPoller() {
  if (typeof window === "undefined" || typeof document === "undefined") return
  const state = getGlobalState()
  if (state.lifecyclePollerInstalled) return
  state.lifecyclePollerInstalled = true

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void checkBuildAfterLifecycleResume()
  })
  window.addEventListener("focus", () => void checkBuildAfterLifecycleResume())
  window.addEventListener("pageshow", (event) => {
    void checkBuildAfterLifecycleResume()
    if (event?.persisted) void checkAndEvictStaleBuild()
  })

  if (isIosStandalone()) {
    let ticks = 0
    const id = window.setInterval(() => {
      ticks += 1
      void pollLatestBuildIfDue()
      if (ticks >= 72) window.clearInterval(id)
    }, 5_000)
  }
}

/**
 * When a hashed asset file 404s (typical when the HTML is stale and refers to
 * a chunk that no longer exists on Vercel), or when a dynamic import fails,
 * treat it as a definitive "the app is stale" signal and run the full eviction
 * pipeline. The hash-mismatch path is the most common iOS PWA failure mode.
 */
export function installChunkLoadFailureRecovery() {
  if (typeof window === "undefined") return
  const state = getGlobalState()
  if (state.chunkRecoveryInstalled) return
  state.chunkRecoveryInstalled = true

  const isAssetUrl = (url) => typeof url === "string" && url.includes("/assets/")
  const trigger = () => {
    void evictStaleBuildAndReload("chunk-load-error")
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

export const __testing__ = {
  BUILD_ID_KEY,
  BUILD_VERSION_KEY,
  HARD_RELOAD_AT_KEY,
  HARD_RELOAD_COOLDOWN_MS,
  VERSION_POLL_COOLDOWN_MS,
  VISIBILITY_RESUME_MIN_MS,
  BUILD_SCOPED_LS_KEYS,
  BUILD_SCOPED_LS_PREFIXES,
  PROTECTED_LS_KEYS,
  STALE_EVICT_EXTRA_LS_KEYS,
}
