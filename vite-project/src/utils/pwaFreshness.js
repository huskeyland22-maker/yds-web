// -----------------------------------------------------------------------------
// PWA freshness — 원격 /build-version.json 과 로컬·HTML buildId 대조.
//
// 정상 갱신: Workbox(NetworkFirst HTML, SWR JS/CSS, NetworkOnly API/panic) + 토스트
// (`yds:pwa-update-available`) → 사용자가 "지금 업데이트" 시 reload / updateSW(true).
//
// Chunk 404·dynamic import·preload 실패 → recoverFromChunkLoadFailure (cooldown 없음, 즉시 reload).
// evictStaleBuildAndReload: stale-panic·html-stale-shell·사용자 "지금 업데이트" 등.
// html-build-mismatch 는 더 이상 자동 hard reload 하지 않음.
// -----------------------------------------------------------------------------

import { LIVE_JSON_GET_INIT, withNoStoreQuery } from "../config/liveDataFetch.js"

const BUILD_VERSION_ENDPOINT = "/build-version.json"
const BUILD_ID_KEY = "yds-build-id"
const BUILD_VERSION_KEY = "yds-build-version"
const HARD_RELOAD_AT_KEY = "yds-hard-reload-at"
const PWA_LAST_SYNC_KEY = "yds-pwa-last-check-at"
export const PWA_UPDATE_EVENT = "yds:pwa-update-available"
const PWA_TOAST_DISMISS_KEY = "yds-pwa-toast-dismiss"
const PWA_HTML_HEAL_PREFIX = "yds-pwa-html-heal-"
const HARD_RELOAD_COOLDOWN_MS = 6000
const VERSION_POLL_COOLDOWN_MS = 8000
const UPDATE_NOTIFY_COOLDOWN_MS = 12_000

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
  "yds-panic-index-history-v1",
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
      lastUpdateNotifyAt: 0,
    }
  if (!window[GLOBAL_FLAG_KEY]) {
    window[GLOBAL_FLAG_KEY] = {
      chunkRecoveryInstalled: false,
      lifecyclePollerInstalled: false,
      lastPollAt: 0,
      lastLifecycleResumeCheckAt: 0,
      lastUpdateNotifyAt: 0,
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

export function getLocalBuildId() {
  return safeRead("localStorage", BUILD_ID_KEY) || ""
}

export function getLastBuildSyncAt() {
  const raw = safeRead("sessionStorage", PWA_LAST_SYNC_KEY)
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : null
}

export function formatCacheBytes(bytes) {
  const n = Number(bytes) || 0
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(2)} MB`
}

export async function estimateCacheStorageBytes() {
  if (typeof window === "undefined" || !("caches" in window)) return 0
  let total = 0
  try {
    const keys = await caches.keys()
    for (const name of keys) {
      const cache = await caches.open(name)
      const reqs = await cache.keys()
      for (const req of reqs) {
        const res = await cache.match(req)
        if (!res) continue
        try {
          const blob = await res.clone().blob()
          total += blob.size || 0
        } catch {
          // ignore per-entry failures
        }
      }
    }
  } catch {
    return 0
  }
  return total
}

function htmlHealSessionKey(remoteBuildId) {
  return `${PWA_HTML_HEAL_PREFIX}${remoteBuildId}`
}

export function isPwaUpdateToastDismissed(remoteBuildId) {
  if (!remoteBuildId) return false
  try {
    const raw = safeRead("sessionStorage", PWA_TOAST_DISMISS_KEY)
    if (!raw) return false
    const parsed = JSON.parse(raw)
    if (String(parsed?.buildId) !== String(remoteBuildId)) return false
    const until = Number(parsed?.until)
    return Number.isFinite(until) && Date.now() < until
  } catch {
    return false
  }
}

/** 토스트 "닫기" — 같은 배포에 대해 30분간 알림 억제 */
export function dismissPwaUpdateToast(remoteBuildId, ttlMs = 30 * 60 * 1000) {
  if (!remoteBuildId) return
  try {
    safeWrite(
      "sessionStorage",
      PWA_TOAST_DISMISS_KEY,
      JSON.stringify({ buildId: String(remoteBuildId), until: Date.now() + ttlMs }),
    )
  } catch {
    // ignore
  }
}

export async function triggerServiceWorkerUpdate() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return
  try {
    const regs = await navigator.serviceWorker.getRegistrations()
    await Promise.all(regs.map((r) => r.update().catch(() => null)))
  } catch {
    // ignore
  }
}

/**
 * 신규 배포 감지 — 토스트·SW 업데이트 트리거 (자동 hard reload 없음).
 */
export function notifyUpdateAvailable(reason, remoteMeta) {
  if (typeof window === "undefined") return
  const remoteBuildId = remoteMeta?.buildId != null ? String(remoteMeta.buildId) : null
  if (remoteBuildId && isPwaUpdateToastDismissed(remoteBuildId)) return

  const state = getGlobalState()
  const now = Date.now()
  if (now - (state.lastUpdateNotifyAt || 0) < UPDATE_NOTIFY_COOLDOWN_MS) return
  state.lastUpdateNotifyAt = now

  publishBuildProbeSnapshot({
    mismatch: reason,
    updatePending: true,
    remoteBuildId: remoteMeta?.buildId != null ? String(remoteMeta.buildId) : undefined,
  })

  void triggerServiceWorkerUpdate()

  try {
    window.dispatchEvent(
      new CustomEvent(PWA_UPDATE_EVENT, {
        detail: {
          reason: String(reason || "update"),
          remoteBuildId: remoteMeta?.buildId != null ? String(remoteMeta.buildId) : null,
          remoteVersion: typeof remoteMeta?.version === "string" ? remoteMeta.version : null,
          at: now,
        },
      }),
    )
  } catch {
    // ignore
  }
}

function buildPwaReloadUrl() {
  const next = new URL(window.location.href)
  next.searchParams.set("pwa_v", String(Date.now()))
  return `${next.pathname}${next.search}${next.hash}`
}

/**
 * 사용자 "지금 업데이트" — iOS PWA는 단순 reload만으로 HTML shell이 안 바뀌므로
 * SW 해제 + Cache Storage 비운 뒤 hard reload (evictStaleBuildAndReload).
 */
export async function applyPwaUpdate() {
  if (typeof window === "undefined") return false

  let remote = null
  try {
    const probe = window.__YDS_BUILD_CHECK
    if (probe?.remoteBuildId) {
      remote = {
        buildId: String(probe.remoteBuildId),
        version: typeof probe.remoteVersion === "string" ? probe.remoteVersion : undefined,
      }
    }
  } catch {
    // ignore
  }
  if (!remote?.buildId) {
    remote = await fetchLatestBuildMeta().catch(() => null)
  }

  if (remote?.buildId) {
    safeWrite("sessionStorage", htmlHealSessionKey(String(remote.buildId)), "1")
  }

  const reloaded = await evictStaleBuildAndReload("user-pwa-update", remote, { force: true })
  if (!reloaded) {
    window.location.replace(buildPwaReloadUrl())
    return true
  }
  return reloaded
}

export async function forcePwaCacheClear() {
  await unregisterAllServiceWorkers()
  await clearAllCacheStorage()
  purgeOldBuildLocalStorage()
}

export async function forcePwaUpdate() {
  await triggerServiceWorkerUpdate()
  const remote = await fetchLatestBuildMeta().catch(() => null)
  if (remote?.buildId) {
    notifyUpdateAvailable("force-update", remote)
  }
  await applyPwaUpdate()
}

const CHUNK_RECOVERY_OVERLAY_ID = "yds-chunk-recovery-overlay"

/** Chunk / stale asset 실패 시 검은 화면 대신 표시. */
export function showChunkRecoveryFallback() {
  if (typeof document === "undefined") return

  try {
    let el = document.getElementById(CHUNK_RECOVERY_OVERLAY_ID)
    if (!el) {
      el = document.createElement("div")
      el.id = CHUNK_RECOVERY_OVERLAY_ID
      el.setAttribute("role", "alertdialog")
      el.setAttribute("aria-labelledby", "yds-chunk-recovery-title")
      el.setAttribute("aria-describedby", "yds-chunk-recovery-desc")
      el.innerHTML = `
        <div class="yds-chunk-recovery__panel">
          <p id="yds-chunk-recovery-title" class="yds-chunk-recovery__title">업데이트 감지됨</p>
          <p id="yds-chunk-recovery-desc" class="yds-chunk-recovery__desc">새 버전 적용중…</p>
          <button type="button" class="yds-chunk-recovery__btn">새로고침</button>
        </div>
      `
      el.style.cssText = [
        "position:fixed",
        "inset:0",
        "z-index:2147483646",
        "display:flex",
        "align-items:center",
        "justify-content:center",
        "padding:24px",
        "box-sizing:border-box",
        "background:#0B0E14",
        "font-family:ui-sans-serif,system-ui,-apple-system,'Pretendard','Noto Sans KR',sans-serif",
      ].join(";")
      const panel = el.querySelector(".yds-chunk-recovery__panel")
      if (panel) {
        panel.style.cssText = [
          "width:min(100%,20rem)",
          "text-align:center",
          "padding:20px 18px",
          "border-radius:12px",
          "border:1px solid rgba(56,189,248,0.28)",
          "background:rgba(15,23,42,0.96)",
          "box-shadow:0 12px 40px rgba(0,0,0,0.55)",
        ].join(";")
      }
      const title = el.querySelector(".yds-chunk-recovery__title")
      if (title) {
        title.style.cssText =
          "margin:0;font-size:15px;font-weight:700;color:#e2e8f0;letter-spacing:0.02em"
      }
      const desc = el.querySelector(".yds-chunk-recovery__desc")
      if (desc) {
        desc.style.cssText = "margin:8px 0 0;font-size:13px;font-weight:500;color:#94a3b8"
      }
      const btn = el.querySelector(".yds-chunk-recovery__btn")
      if (btn) {
        btn.style.cssText = [
          "margin-top:16px",
          "width:100%",
          "padding:10px 14px",
          "border-radius:8px",
          "border:1px solid rgba(56,189,248,0.45)",
          "background:rgba(14,116,144,0.35)",
          "color:#f0f9ff",
          "font-size:14px",
          "font-weight:700",
          "cursor:pointer",
        ].join(";")
        btn.addEventListener("click", () => {
          void recoverFromChunkLoadFailure("user-reload")
        })
      }
      ;(document.body || document.documentElement).appendChild(el)
    } else {
      el.hidden = false
      el.style.display = "flex"
    }

    const root = document.getElementById("root")
    if (root && !root.textContent?.trim()) {
      root.setAttribute("aria-hidden", "true")
    }
  } catch {
    // ignore
  }
}

/**
 * Chunk 404 / dynamic import / preload 실패 — cooldown 없이 SW·캐시 정리 후 즉시 reload.
 * @param {string} [reason]
 * @param {{ showFallback?: boolean }} [options]
 */
export async function recoverFromChunkLoadFailure(reason = "chunk-load-error", options = {}) {
  if (typeof window === "undefined") return

  if (options.showFallback !== false) {
    showChunkRecoveryFallback({ autoReload: false })
  }

  try {
    await unregisterAllServiceWorkers()
    await clearAllCacheStorage()
  } catch {
    // ignore — reload anyway
  }

  console.warn("[PWA] chunk recovery — reloading", { reason })
  window.location.reload()
}

function showUpdateBanner() {
  showChunkRecoveryFallback()
}

/**
 * Full eviction pipeline. Returns true if the page is being reloaded.
 * Honors a 6s cooldown so a misbehaving server can't put us into an
 * infinite reload loop.
 */
export async function evictStaleBuildAndReload(reason, latestMeta, options = {}) {
  if (typeof window === "undefined") return false
  const force = options?.force === true

  const now = Date.now()
  const last = Number(safeRead("sessionStorage", HARD_RELOAD_AT_KEY) || "0")
  if (
    !force &&
    Number.isFinite(last) &&
    last > 0 &&
    now - last < HARD_RELOAD_COOLDOWN_MS
  ) {
    console.warn("[PWA] stale-build detected but cooldown active — skipping reload", reason)
    return false
  }
  safeWrite("sessionStorage", HARD_RELOAD_AT_KEY, String(now))

  console.warn("[PWA] stale build detected — evicting and reloading", { reason, latestMeta })
  showUpdateBanner()

  await unregisterAllServiceWorkers()
  await clearAllCacheStorage()
  await sweepIosStandaloneCachesOnce()
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
  const remoteCacheId = typeof remote.cacheId === "string" ? remote.cacheId.trim() : ""
  const remoteSwWorkboxCacheId =
    typeof remote.swWorkboxCacheId === "string" ? remote.swWorkboxCacheId.trim() : ""

  publishBuildProbeSnapshot({
    htmlBuildId,
    storedBuildId,
    storedVersion,
    remoteBuildId,
    remoteVersion,
    remoteCacheId: remoteCacheId || null,
    remoteSwWorkboxCacheId: remoteSwWorkboxCacheId || null,
    reloaded: false,
    probeNote: "checking",
  })

  const htmlShellStale =
    htmlBuildId && (htmlBuildId !== remoteBuildId || (storedBuildId && htmlBuildId !== String(storedBuildId)))

  if (htmlShellStale && storedBuildId === remoteBuildId) {
    const healKey = htmlHealSessionKey(remoteBuildId)
    if (!safeRead("sessionStorage", healKey)) {
      safeWrite("sessionStorage", healKey, "1")
      const reloaded = await evictStaleBuildAndReload("html-stale-shell", remote, { force: true })
      return { remote, reloaded, updateAvailable: !reloaded }
    }
  }

  if (htmlBuildId && storedBuildId && htmlBuildId !== String(storedBuildId)) {
    if (!isPwaUpdateToastDismissed(remoteBuildId)) {
      notifyUpdateAvailable("html-local-build-desync", remote)
    }
    return { remote, reloaded: false, updateAvailable: true }
  }

  if (htmlBuildId && htmlBuildId !== remoteBuildId) {
    if (!isPwaUpdateToastDismissed(remoteBuildId)) {
      notifyUpdateAvailable("html-build-mismatch", remote)
    }
    return { remote, reloaded: false, updateAvailable: true }
  }

  if (storedBuildId && String(storedBuildId) !== remoteBuildId) {
    if (!isPwaUpdateToastDismissed(remoteBuildId)) {
      notifyUpdateAvailable("client-build-mismatch", remote)
    }
    return { remote, reloaded: false, updateAvailable: true }
  }

  if (remoteVersion && storedVersion && storedVersion !== remoteVersion) {
    if (!isPwaUpdateToastDismissed(remoteBuildId)) {
      notifyUpdateAvailable("client-version-mismatch", remote)
    }
    return { remote, reloaded: false, updateAvailable: true }
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
    remoteCacheId: remoteCacheId || null,
    remoteSwWorkboxCacheId: remoteSwWorkboxCacheId || null,
    reloaded: false,
    probeNote: "ok",
  })
  try {
    const t = Date.now()
    safeWrite("sessionStorage", PWA_LAST_SYNC_KEY, String(t))
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("yds:build-version-synced", {
          detail: {
            at: t,
            version: remoteVersion,
            buildId: remoteBuildId,
            cacheId: remoteCacheId || null,
            swWorkboxCacheId: remoteSwWorkboxCacheId || null,
          },
        }),
      )
    }
  } catch {
    // ignore
  }
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
    return {
      registrations: 0,
      controlling: null,
      waiting: null,
      installing: null,
      active: null,
      scopes: [],
      cacheBytes: 0,
    }
  }
  try {
    const regs = await navigator.serviceWorker.getRegistrations()
    const controlling = navigator.serviceWorker.controller?.scriptURL ?? null
    let waiting = null
    let installing = null
    let active = null
    for (const r of regs) {
      if (r.waiting?.scriptURL) waiting = r.waiting.scriptURL
      if (r.installing?.scriptURL) installing = r.installing.scriptURL
      if (r.active?.scriptURL) active = r.active.scriptURL
    }
    const cacheBytes = await estimateCacheStorageBytes()
    return {
      registrations: regs.length,
      controlling,
      waiting,
      installing,
      active,
      scopes: regs.map((r) => r.scope),
      cacheBytes,
    }
  } catch {
    return {
      registrations: 0,
      controlling: null,
      waiting: null,
      installing: null,
      active: null,
      scopes: [],
      cacheBytes: 0,
    }
  }
}

/**
 * html-build-mismatch 등으로 리로드된 직후 SW·Cache Storage를 한 번 더 비웁니다.
 * (evictStaleBuildAndReload 직전에도 수행되나, bfcache 복귀 대비)
 */
export async function invalidateServiceWorkerCachesAfterBuildMismatch() {
  if (typeof window === "undefined") return false
  try {
    const reason = new URL(window.location.href).searchParams.get("reason") || ""
    if (!reason.includes("build") && !reason.includes("stale")) return false
    if (safeRead("sessionStorage", "yds-sw-invalidated-for-reason") === reason) return false
    await unregisterAllServiceWorkers()
    await clearAllCacheStorage()
    safeWrite("sessionStorage", "yds-sw-invalidated-for-reason", reason)
    return true
  } catch {
    return false
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
let chunkRecoveryInFlight = false

function triggerChunkRecovery(reason) {
  if (chunkRecoveryInFlight) return
  chunkRecoveryInFlight = true
  void recoverFromChunkLoadFailure(reason)
}

export function installChunkLoadFailureRecovery() {
  if (typeof window === "undefined") return
  const state = getGlobalState()
  if (state.chunkRecoveryInstalled) return
  state.chunkRecoveryInstalled = true

  const isAssetUrl = (url) => typeof url === "string" && url.includes("/assets/")

  window.addEventListener("vite:preloadError", () => {
    triggerChunkRecovery("vite-preload-error")
  })

  window.addEventListener(
    "error",
    (event) => {
      const target = event?.target
      if (!target || target === window) return
      const tag = target.tagName
      if (tag !== "SCRIPT" && tag !== "LINK") return
      const src = target.src || target.href
      if (isAssetUrl(src)) triggerChunkRecovery("chunk-asset-404")
    },
    true,
  )

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event?.reason
    const msg = String(reason?.message || reason || "")
    if (/Failed to fetch dynamically imported module|Importing a module script failed|ChunkLoadError|404/i.test(msg)) {
      triggerChunkRecovery("chunk-load-error")
    }
  })
}

export const __testing__ = {
  BUILD_ID_KEY,
  BUILD_VERSION_KEY,
  HARD_RELOAD_AT_KEY,
  PWA_UPDATE_EVENT,
  HARD_RELOAD_COOLDOWN_MS,
  VERSION_POLL_COOLDOWN_MS,
  UPDATE_NOTIFY_COOLDOWN_MS,
  VISIBILITY_RESUME_MIN_MS,
  BUILD_SCOPED_LS_KEYS,
  BUILD_SCOPED_LS_PREFIXES,
  PROTECTED_LS_KEYS,
  STALE_EVICT_EXTRA_LS_KEYS,
}
