import { create } from "zustand"
import { fetchPanicDataJson, isPanicHubEnabled, submitManualPanicData } from "../config/api.js"
import { AUTO_DATA_ENGINE_ENABLED, PANIC_DATA_POLL_MS } from "../config/dataEngine.js"
import { getFinalScore } from "../utils/tradingScores.js"
import { validatePanicData, isPanicBusinessDataStale } from "../utils/validatePanicData.js"
import { emitDebugEvent } from "../utils/debugLogger.js"
import {
  computePayloadStale,
  logCacheHit,
  logFetchFail,
  logFetchSuccess,
  logFetchStart,
  logStoreWrite,
  maybeWarnPayloadStale,
} from "../utils/dataFlowTrace.js"
import { evictStaleBuildAndReload, fetchLatestBuildMeta } from "../utils/pwaFreshness.js"
import { useAppDataStore } from "./appDataStore.js"
import { latestCycleHistoryRow, panicDataFromCycleRow } from "../utils/cycleHistoryUtils.js"

const PANIC_MAIN_STORAGE_KEY = "yds-panic-main-v2"
const CURRENT_SNAPSHOT_VERSION = 2
const LEGACY_PANIC_KEYS = [
  "yds-panic-main-v1",
  "yds-panic-manual-snapshot-v1",
  "yds-panic-manual-lock-v1",
  "yds-panic-snapshot",
  "panicData",
  "panic-data",
]
const SNAPSHOT_MAX_AGE_MS = 1000 * 60 * 10
const APP_BUILD_ID = import.meta.env.VITE_APP_BUILD_ID ?? "dev"
const AUTO_REFRESH_MS = PANIC_DATA_POLL_MS
const METRIC_KEYS = ["vix", "vxn", "fearGreed", "bofa", "move", "skew", "putCall", "highYield", "gsBullBear"]
const CORE_REQUIRED_KEYS = ["vix", "fearGreed", "bofa", "putCall", "highYield"]

const HEAL_STALE_PANIC_SESSION_KEY = "yds-stale-panic-heal-once"

/** 패닉 자동 폴링 interval id — zustand 스토어 외부 단일 타이머 */
let refreshTimer = null
/** fetchPanicData 동시 호출 시 stale 응답 드롭용 */
let fetchSeq = 0

async function maybeHealAfterStalePanicPayload(err) {
  if (typeof window === "undefined") return
  const msg = err instanceof Error ? err.message : String(err || "")
  if (msg !== "hub_payload_stale_or_invalid" && msg !== "PANIC_LEGACY_STALE_PAYLOAD") return
  if (sessionStorage.getItem(HEAL_STALE_PANIC_SESSION_KEY)) return
  const meta = await fetchLatestBuildMeta().catch(() => null)
  const reloaded = await evictStaleBuildAndReload("stale-panic-payload", meta)
  if (reloaded) sessionStorage.setItem(HEAL_STALE_PANIC_SESSION_KEY, "1")
}

function stopRefreshTimer() {
  if (refreshTimer == null) return
  try {
    window.clearInterval(refreshTimer)
  } catch {
    // ignore
  }
  refreshTimer = null
}

function toSnapshotData(raw) {
  const src = raw && typeof raw === "object" ? raw : {}
  const out = {}
  for (const key of METRIC_KEYS) {
    out[key] = src[key] ?? null
  }
  out.updatedAt = src.updatedAt ?? null
  out.accessTier = src.accessTier ?? "pro"
  out.manualFinalScore = src.manualFinalScore ?? null
  out.manualSentiment = src.manualSentiment ?? null
  out.manualTrend = src.manualTrend ?? null
  return out
}

function isCompletePanicData(payload) {
  if (!payload || typeof payload !== "object") return false
  return CORE_REQUIRED_KEYS.every((key) => payload[key] !== undefined && payload[key] !== null)
}

function filterDefinedFields(input) {
  if (!input || typeof input !== "object") return {}
  const allowed = [...METRIC_KEYS, "updatedAt", "accessTier", "manualFinalScore", "manualSentiment", "manualTrend"]
  const out = {}
  for (const key of allowed) {
    const value = input[key]
    if (value !== undefined && value !== null && value !== "-") {
      out[key] = value
    }
  }
  return out
}

function isValidSnapshotShape(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return false
  if (Number(snapshot.version) !== CURRENT_SNAPSHOT_VERSION) return false
  const payload = snapshot.data
  if (!payload || typeof payload !== "object") return false
  // partial legacy schema restore 차단: 핵심 필드 존재 필수
  return CORE_REQUIRED_KEYS.every((key) => Object.prototype.hasOwnProperty.call(payload, key) && payload[key] !== null)
}

function hasAllRequiredMetrics(payload) {
  if (!payload || typeof payload !== "object") return false
  return METRIC_KEYS.every((key) => payload[key] !== undefined && payload[key] !== null && payload[key] !== "-")
}

function readMainEnvelope() {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(PANIC_MAIN_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === "object" ? parsed : null
  } catch {
    return null
  }
}

function writeMain(data, isManual) {
  if (typeof window === "undefined" || !data || typeof data !== "object") return
  try {
    const current = readMainEnvelope()
    const currentSavedAt = Number(current?.__savedAt ?? 0)
    const nextSavedAt = Date.now()
    const safeData = toSnapshotData(data)
    if (!isCompletePanicData(safeData)) {
      return
    }
    // 저장 안정화 우선:
    // 기존 manual 스냅샷이 있으면 자동 쓰기로 덮어쓰지 않음.
    if (current?.isManual && !isManual) {
      return
    }
    // 더 최신 스냅샷이 이미 있으면 오래된 쓰기 차단(race 방지)
    if (Number.isFinite(currentSavedAt) && currentSavedAt > nextSavedAt) {
      return
    }
    const snapshot = {
      version: CURRENT_SNAPSHOT_VERSION,
      updatedAt: Date.now(),
      data: safeData,
      isManual: Boolean(isManual),
      __savedAt: nextSavedAt,
      __buildId: APP_BUILD_ID,
    }
    localStorage.setItem(
      PANIC_MAIN_STORAGE_KEY,
      JSON.stringify(snapshot),
    )
  } catch {
    // noop
  }
}

function clearMain() {
  if (typeof window === "undefined") return
  try {
    localStorage.removeItem(PANIC_MAIN_STORAGE_KEY)
  } catch {
    // noop
  }
}

function clearLegacy() {
  if (typeof window === "undefined") return
  try {
    for (const key of LEGACY_PANIC_KEYS) {
      localStorage.removeItem(key)
    }
  } catch {
    // noop
  }
}

function isFresh(snapshot) {
  const savedAt = Number(snapshot?.__savedAt)
  return Number.isFinite(savedAt) && Date.now() - savedAt <= SNAPSHOT_MAX_AGE_MS
}

function isCurrentBuild(snapshot) {
  return String(snapshot?.__buildId ?? "") === String(APP_BUILD_ID)
}

function addFlow(set, source, detail = {}) {
  const row = { ts: Date.now(), source, ...detail }
  set((state) => ({
    flowLogs: [row, ...state.flowLogs].slice(0, 60),
    lastUpdateSource: source,
    lastOverwriteAt: row.ts,
  }))
}

export const usePanicStore = create((set, get) => ({
  panicData: null,
  manualMode: false,
  initialized: false,
  flowLogs: [],
  lastUpdateSource: "init",
  lastOverwriteAt: null,
  lastPanicFetchAt: null,
  lastPanicFetchUrl: null,
  lastPanicFetchSource: null,
  lastPanicPayloadUpdatedAt: null,
  lastPanicFetchError: null,
  /** 수집기 기준 오래된 데이터 — UI에 last updated / stale 표시용 */
  panicDataStale: false,

  /** UI 디버그 · 데이터 흐름 추적 */
  panicDataTrace: {
    lastFetchWallClock: null,
    lastPayloadBusinessAt: null,
    lastStoreWriteAt: null,
    fetchSource: null,
    fetchUrl: null,
    usedLocalCacheHydration: false,
    fromFetch: false,
  },

  _touchPanicTrace: (partial) =>
    set((state) => ({
      panicDataTrace: { ...state.panicDataTrace, ...partial },
    })),

  initializePanicData: async () => {
    if (get().initialized) return
    useAppDataStore.getState().purgeLegacyCycleStorage()
    const hydrationStart = typeof performance !== "undefined" ? performance.now() : Date.now()
    emitDebugEvent("HYDRATION_START", { source: "panicStore.initialize" })
    let envelope = readMainEnvelope()
    if (isPanicHubEnabled() && envelope && !envelope.isManual) {
      addFlow(set, "hub-skip-non-manual-local-cache")
      clearMain()
      clearLegacy()
      envelope = null
    }
    let fallbackManualEnvelope = null
    if (envelope && !isValidSnapshotShape(envelope)) {
      addFlow(set, "clear-invalid-schema-main", { reason: "version-or-shape-mismatch" })
      clearMain()
      clearLegacy()
    } else if (envelope?.isManual && isValidSnapshotShape(envelope)) {
      fallbackManualEnvelope = envelope
      addFlow(set, "defer-main-manual", { updatedAt: envelope?.data?.updatedAt ?? null })
      clearMain()
    } else if (envelope && (!isFresh(envelope) || !isCurrentBuild(envelope))) {
      addFlow(set, "clear-stale-main")
      clearMain()
      clearLegacy()
    }
    set({ initialized: true })
    if (!AUTO_DATA_ENGINE_ENABLED) {
      addFlow(set, "skip-initialize-fetch-auto-engine-off")
      if (fallbackManualEnvelope) {
        const restored = toSnapshotData(fallbackManualEnvelope.data)
        set({ panicData: restored, manualMode: true })
        get()._touchPanicTrace({
          lastStoreWriteAt: Date.now(),
          usedLocalCacheHydration: true,
          fromFetch: false,
          fetchSource: "localStorage-manual",
          lastPayloadBusinessAt: restored?.updatedAt ?? null,
        })
        logCacheHit("panic-main-localStorage", { manual: true, updatedAt: restored?.updatedAt ?? null })
        logStoreWrite("panicStore", { source: "restore-manual-engine-off" })
        addFlow(set, "restore-main-manual-engine-off", { updatedAt: restored?.updatedAt ?? null })
        emitDebugEvent("HYDRATION_RESTORE", { source: "localStorage", manualMode: true, restoredItemCount: 1 })
      }
      emitDebugEvent("HYDRATION_DONE", {
        source: "panicStore.initialize",
        restored: Boolean(fallbackManualEnvelope),
        durationMs: Math.round((typeof performance !== "undefined" ? performance.now() : Date.now()) - hydrationStart),
      })
      return
    }
    await get().fetchPanicData("initialize-fetch", { force: true })
    if (!get().panicData && fallbackManualEnvelope) {
      const restored = toSnapshotData(fallbackManualEnvelope.data)
      set({ panicData: restored, manualMode: true })
      writeMain(restored, true)
      get()._touchPanicTrace({
        lastStoreWriteAt: Date.now(),
        usedLocalCacheHydration: true,
        fromFetch: false,
        fetchSource: "localStorage-manual-fallback",
        lastPayloadBusinessAt: restored?.updatedAt ?? null,
      })
      logCacheHit("panic-main-localStorage", { manual: true, offlineFallback: true })
      logStoreWrite("panicStore", { source: "restore-offline-fallback" })
      addFlow(set, "restore-main-manual-offline-fallback", { updatedAt: restored?.updatedAt ?? null })
      emitDebugEvent("HYDRATION_RESTORE", { source: "localStorage-offline-fallback", manualMode: true, restoredItemCount: 1 })
    }
    emitDebugEvent("HYDRATION_DONE", {
      source: "panicStore.initialize",
      restored: Boolean(fallbackManualEnvelope && get().manualMode),
      durationMs: Math.round((typeof performance !== "undefined" ? performance.now() : Date.now()) - hydrationStart),
    })
  },

  fetchPanicData: async (source = "api-fetch", opts = {}) => {
    const force = Boolean(opts?.force)
    if (!AUTO_DATA_ENGINE_ENABLED) {
      addFlow(set, "block-fetch-auto-engine-off", { source })
      return false
    }
    if (get().manualMode && !force) {
      addFlow(set, "block-fetch-manual", { source })
      return false
    }
    const seq = ++fetchSeq
    logFetchStart("panic-metrics", { source, seq, force })
    let updated = false
    try {
      const data = await fetchPanicDataJson({ debugLog: false })
      logFetchSuccess("panic-metrics-network", {
        source,
        seq,
        fetchSource: data?.__fetchSource,
        url: data?.__fetchUrl,
        payloadUpdatedAt: data?.updatedAt ?? null,
      })
      if (!validatePanicData(data)) {
        logFetchFail("panic-metrics", new Error("validate_failed"), { source, seq })
        addFlow(set, "reject-invalid-panic-after-fetch", { updatedAt: data?.updatedAt ?? null })
        set({
          lastPanicFetchAt: Date.now(),
          lastPanicFetchUrl: data?.__fetchUrl ?? null,
          lastPanicFetchSource: data?.__fetchSource ?? null,
          lastPanicPayloadUpdatedAt: data?.updatedAt ?? null,
          lastPanicFetchError: "validate_failed",
        })
        if (data && typeof data === "object" && isPanicBusinessDataStale(data)) {
          void maybeHealAfterStalePanicPayload(new Error("PANIC_LEGACY_STALE_PAYLOAD"))
        }
        return false
      }
      if (seq !== fetchSeq || (get().manualMode && !force)) {
        addFlow(set, "drop-stale-fetch", { source })
        return false
      }
      const filteredData = filterDefinedFields(data)
      const removedKeys = METRIC_KEYS.filter((k) => {
        const v = data?.[k]
        return v === undefined || v === null || v === "-"
      })

      let mergedForLog = null
      set((state) => {
        const prev = state.panicData && typeof state.panicData === "object" ? state.panicData : {}
        const prevHasRequired = hasAllRequiredMetrics(prev)
        const incomingHasRequired = hasAllRequiredMetrics(filteredData)
        if (!incomingHasRequired && prevHasRequired) {
          addFlow(set, "skip-partial-fetch-merge", {
            source,
            removedCount: removedKeys.length,
          })
          return state
        }
        const merged = {
          ...prev,
          ...filteredData,
        }
        if (!hasAllRequiredMetrics(merged)) {
          addFlow(set, "skip-invalid-merged-state", {
            source,
            removedCount: removedKeys.length,
          })
          return state
        }
        mergedForLog = merged
        writeMain(merged, false)
        return { panicData: merged, manualMode: false }
      })
      if (mergedForLog) {
        const merged = mergedForLog
        updated = true
        get()._touchPanicTrace({
          lastFetchWallClock: Date.now(),
          lastPayloadBusinessAt: merged?.updatedAt ?? null,
          lastStoreWriteAt: Date.now(),
          fetchSource: data?.__fetchSource ?? "network",
          fetchUrl: data?.__fetchUrl ?? null,
          usedLocalCacheHydration: false,
          fromFetch: true,
        })
        logStoreWrite("panicStore", {
          source,
          mergedKeys: Object.keys(merged).length,
          payloadUpdatedAt: merged?.updatedAt ?? null,
        })
        maybeWarnPayloadStale("panic-metrics", merged?.updatedAt, { fetchSource: source })
        set({
          lastPanicFetchAt: Date.now(),
          lastPanicFetchUrl: data.__fetchUrl ?? null,
          lastPanicFetchSource: data.__fetchSource ?? null,
          lastPanicPayloadUpdatedAt: mergedForLog?.updatedAt ?? null,
          lastPanicFetchError: null,
          panicDataStale: Boolean(data.__isStale),
        })
        addFlow(set, "set-from-fetch-merge", {
          source,
          updatedAt: mergedForLog?.updatedAt ?? null,
          missingCount: removedKeys.length,
        })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logFetchFail("panic-metrics", err, { source, seq })
      addFlow(set, "fetch-error-keep-state", { source, message })
      set({ lastPanicFetchAt: Date.now(), lastPanicFetchError: message })
      void maybeHealAfterStalePanicPayload(err)
      return false
    }
    return updated
  },

  savePanicMetricsHub: async (inputData, opts = {}) => {
    if (!isPanicHubEnabled()) {
      return { ok: false, error: new Error("panic_hub_disabled") }
    }
    try {
      const tradeDate =
        typeof opts.tradeDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(opts.tradeDate)
          ? opts.tradeDate
          : typeof inputData?.tradeDate === "string"
            ? inputData.tradeDate.slice(0, 10)
            : undefined
      const updatedAt =
        tradeDate != null
          ? `${tradeDate}T12:00:00.000Z`
          : new Date().toISOString()
      const payload = { ...inputData, tradeDate, updatedAt }
      const result = await submitManualPanicData(payload)
      const data = result?.data ?? result
      const history = result?.history ?? null
      if (!history?.ok) {
        const reason = history?.reason || history?.error || "panic_index_history_upsert_failed"
        return { ok: false, error: new Error(String(reason)), history }
      }
      const appStore = useAppDataStore.getState()
      appStore.invalidateCycleHistoryCache()
      await appStore.loadCycleHistoryBundle({ limit: 500, force: true })

      const lastRow = latestCycleHistoryRow(appStore.cycleMetricHistory)
      const fromHistory = panicDataFromCycleRow(lastRow)
      const aligned = fromHistory ? { ...data, ...fromHistory } : data
      get().applyServerPanicSnapshot(aligned)

      return { ok: true, data: aligned, history, tradeDate: tradeDate ?? null }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err : new Error(String(err)) }
    }
  },

  applyServerPanicSnapshot: (incoming) => {
    if (!incoming || typeof incoming !== "object") return
    const next = toSnapshotData(incoming)
    if (!isCompletePanicData(next)) {
      addFlow(set, "skip-server-snapshot-incomplete")
      return
    }
    stopRefreshTimer()
    try {
      clearMain()
    } catch {
      // ignore
    }
    writeMain(next, false)
    set({
      panicData: next,
      manualMode: false,
      lastPanicFetchAt: Date.now(),
      lastPanicFetchUrl: null,
      lastPanicFetchSource: "SERVER_SUBMIT",
      lastPanicPayloadUpdatedAt: next.updatedAt ?? null,
      lastPanicFetchError: null,
      panicDataTrace: {
        ...get().panicDataTrace,
        lastFetchWallClock: Date.now(),
        lastPayloadBusinessAt: next.updatedAt ?? null,
        lastStoreWriteAt: Date.now(),
        fetchSource: "SERVER_SUBMIT",
        fetchUrl: null,
        usedLocalCacheHydration: false,
        fromFetch: true,
      },
    })
    addFlow(set, "set-from-server-submit", { updatedAt: next.updatedAt ?? null })
    get().startAutoRefresh()
  },

  applyManualPanicData: (incoming) => {
    const nowIso = new Date().toISOString()
    stopRefreshTimer()
    set((state) => {
      const prev = state.panicData && typeof state.panicData === "object" ? state.panicData : {}
      const next = { ...prev }
      for (const key of METRIC_KEYS) {
        // manual 저장은 merge가 아니라 입력값 기준으로 강제 치환
        // (미입력 필드는 null로 내려 stale baseline 잔존 차단)
        next[key] = incoming?.[key] ?? null
      }
      next.updatedAt = nowIso
      next.manualFinalScore = getFinalScore(next)
      next.manualSentiment = "manual"
      next.manualTrend = "manual"
      next.manualSavedAt = nowIso
      writeMain(next, true)
      emitDebugEvent("SAVE_SUCCESS", { source: "panicStore.manual", savedAt: nowIso, mode: "manual" })
      return {
        panicData: next,
        manualMode: true,
        panicDataTrace: {
          ...state.panicDataTrace,
          lastStoreWriteAt: Date.now(),
          lastPayloadBusinessAt: nowIso,
          fetchSource: "manual-input",
          fetchUrl: null,
          usedLocalCacheHydration: false,
          fromFetch: false,
        },
      }
    })
    addFlow(set, "set-manual-input")
    addFlow(set, "stop-auto-refresh")
  },

  releaseManualMode: async () => {
    addFlow(set, "release-manual")
    clearMain()
    clearLegacy()
    set({ panicData: null, manualMode: false })
    if (!AUTO_DATA_ENGINE_ENABLED) {
      addFlow(set, "skip-release-fetch-auto-engine-off")
      return
    }
    await get().fetchPanicData("after-release-fetch")
    get().startAutoRefresh()
  },

  startAutoRefresh: () => {
    if (!AUTO_DATA_ENGINE_ENABLED) {
      addFlow(set, "skip-auto-refresh-engine-off")
      return
    }
    if (get().manualMode) {
      addFlow(set, "skip-auto-refresh-manual")
      return
    }
    if (refreshTimer != null) return
    try {
      refreshTimer = window.setInterval(() => {
        void get().fetchPanicData("interval-fetch")
      }, AUTO_REFRESH_MS)
    } catch {
      refreshTimer = null
    }
    addFlow(set, "start-auto-refresh")
  },

  stopAutoRefresh: () => {
    if (refreshTimer == null) return
    stopRefreshTimer()
    addFlow(set, "stop-auto-refresh")
  },

  syncOnAppResume: async () => {
    if (!AUTO_DATA_ENGINE_ENABLED) {
      addFlow(set, "skip-resume-sync-auto-engine-off")
      return
    }
    if (get().manualMode) {
      addFlow(set, "block-resume-sync-manual")
      return
    }
    if (!get().initialized) {
      addFlow(set, "skip-resume-sync-not-initialized")
      return
    }
    const ok = await get().fetchPanicData("resume-visible-fetch")
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("yds:resume-sync", { detail: { ok: Boolean(ok), ts: Date.now() } }))
    }
  },
}))
