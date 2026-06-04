import { PANIC_METRIC_KEYS } from "./adminDataIntegrity.js"
import { LIVE_JSON_GET_INIT, withNoStoreQuery } from "../config/liveDataFetch.js"
import { getPanicHubEnvStatus, panicApiUrl } from "../config/api.js"
import { resolveAppReleaseChannel } from "../utils/appReleaseChannel.js"
import { BUILD_ID, VERSION_LABEL } from "../constants/build.js"
import { readHtmlBuildId } from "../utils/pwaFreshness.js"

/**
 * @returns {Promise<{
 *   buildVersion: string
 *   buildId: string
 *   gitCommit: string
 *   lastDeployTime: string | null
 *   lastDeployIso: string | null
 *   environment: string
 *   htmlBuildId: string | null
 * }>}
 */
export async function fetchBuildMeta() {
  let remote = null
  try {
    const res = await fetch(withNoStoreQuery("/build-version.json"), LIVE_JSON_GET_INIT)
    if (res.ok) remote = await res.json()
  } catch {
    remote = null
  }

  const builtAt = remote?.builtAt ?? null
  return {
    buildVersion: remote?.version ?? VERSION_LABEL,
    buildId: remote?.buildId ?? BUILD_ID,
    gitCommit: remote?.gitCommit ?? BUILD_ID.split("-")[0] ?? "—",
    lastDeployTime: builtAt
      ? new Date(builtAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })
      : null,
    lastDeployIso: builtAt ?? null,
    environment: resolveAppReleaseChannel(),
    htmlBuildId: readHtmlBuildId(),
    cacheId: remote?.cacheId ?? null,
  }
}

/**
 * @returns {Promise<{
 *   panicLatest: { ok: boolean; status: number; ms: number; error?: string }
 *   buildJson: { ok: boolean; status: number; ms: number; error?: string }
 *   aiDaily: { ok: boolean; status: number; ms: number; error?: string }
 *   hubEnabled: boolean
 * }>}
 */
export async function probeApiHealth() {
  const hub = getPanicHubEnvStatus()
  const dateStr = new Date().toISOString().slice(0, 10)

  async function timedFetch(url, label) {
    const started = performance.now()
    try {
      const res = await fetch(url, LIVE_JSON_GET_INIT)
      return {
        ok: res.ok,
        status: res.status,
        ms: Math.round(performance.now() - started),
        label,
      }
    } catch (e) {
      return {
        ok: false,
        status: 0,
        ms: Math.round(performance.now() - started),
        error: e instanceof Error ? e.message : String(e),
        label,
      }
    }
  }

  const [panicLatest, buildJson, aiDaily] = await Promise.all([
    timedFetch(panicApiUrl("latest"), "panic-latest"),
    timedFetch(withNoStoreQuery("/build-version.json"), "build-version"),
    timedFetch(
      withNoStoreQuery(`/api/ai/reports?daily=1&date=${encodeURIComponent(dateStr)}`),
      "ai-daily",
    ),
  ])

  return {
    panicLatest,
    buildJson,
    aiDaily,
    hubEnabled: hub.enabled,
    hubEnv: hub,
  }
}

/** @returns {{ domContentLoadedMs: number | null; loadEventMs: number | null; ttfbMs: number | null }} */
export function readNavigationTiming() {
  if (typeof performance === "undefined") {
    return { domContentLoadedMs: null, loadEventMs: null, ttfbMs: null }
  }
  const nav = performance.getEntriesByType("navigation")[0]
  if (!nav || nav.entryType !== "navigation") {
    return { domContentLoadedMs: null, loadEventMs: null, ttfbMs: null }
  }
  return {
    domContentLoadedMs:
      nav.domContentLoadedEventEnd > 0
        ? Math.round(nav.domContentLoadedEventEnd)
        : null,
    loadEventMs: nav.loadEventEnd > 0 ? Math.round(nav.loadEventEnd) : null,
    ttfbMs:
      nav.responseStart > 0 ? Math.round(nav.responseStart - nav.requestStart) : null,
  }
}

/** @returns {{ swActive: boolean; controllerState: string | null; lastPwaCheck: string | null; buildProbe: object | null }} */
export function readCacheStatus() {
  const sw =
    typeof navigator !== "undefined" && "serviceWorker" in navigator
      ? navigator.serviceWorker.controller
      : null
  let lastPwaCheck = null
  try {
    lastPwaCheck = localStorage.getItem("yds-pwa-last-check-at")
  } catch {
    lastPwaCheck = null
  }
  const buildProbe =
    typeof window !== "undefined" && window.__YDS_BUILD_CHECK
      ? window.__YDS_BUILD_CHECK
      : null
  return {
    swActive: Boolean(sw),
    controllerState: sw?.state ?? null,
    lastPwaCheck,
    buildProbe,
  }
}

export function buildPanicMetricStatus(latestRow, panicData, hubMetrics) {
  const live = latestRow ?? hubMetrics ?? panicData ?? null
  const updatedAt =
    live?.updatedAt ?? live?.ts ?? live?.date ?? hubMetrics?.trade_date ?? null

  return PANIC_METRIC_KEYS.map(({ key, label }) => {
    const raw = live?.[key]
    const n = Number(raw)
    const value = Number.isFinite(n) ? n : null
    return {
      key,
      label,
      value,
      display: value != null ? String(value) : "—",
      updatedAt: updatedAt ? String(updatedAt).slice(0, 19) : "—",
      ok: value != null,
    }
  })
}
