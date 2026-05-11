import { create } from "zustand"
import { fetchPanicDataJson } from "../config/api.js"
import { getFinalScore } from "../utils/tradingScores.js"
import { validatePanicData } from "../utils/validatePanicData.js"
import { emitDebugEvent } from "../utils/debugLogger.js"

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
const AUTO_REFRESH_MS = 300_000
const AUTO_DATA_ENGINE_ENABLED = false
const METRIC_KEYS = ["vix", "vxn", "fearGreed", "bofa", "move", "skew", "putCall", "highYield", "gsBullBear"]
const CORE_REQUIRED_KEYS = ["vix", "fearGreed", "bofa", "putCall", "highYield"]

let refreshTimer = null
let fetchSeq = 0

function stopRefreshTimer() {
  if (!refreshTimer) return
  window.clearInterval(refreshTimer)
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

  initializePanicData: async () => {
    if (get().initialized) return
    const hydrationStart = typeof performance !== "undefined" ? performance.now() : Date.now()
    emitDebugEvent("HYDRATION_START", { source: "panicStore.initialize" })
    const envelope = readMainEnvelope()
    if (envelope && !isValidSnapshotShape(envelope)) {
      addFlow(set, "clear-invalid-schema-main", { reason: "version-or-shape-mismatch" })
      clearMain()
      clearLegacy()
    } else if (envelope && envelope?.isManual) {
      addFlow(set, "restore-main-manual", { updatedAt: envelope?.data?.updatedAt ?? null })
      const restored = toSnapshotData(envelope.data)
      set({ panicData: restored, manualMode: true, initialized: true })
      emitDebugEvent("HYDRATION_RESTORE", { source: "localStorage", manualMode: true, restoredItemCount: 1 })
      emitDebugEvent("HYDRATION_DONE", {
        source: "panicStore.initialize",
        restored: true,
        durationMs: Math.round((typeof performance !== "undefined" ? performance.now() : Date.now()) - hydrationStart),
      })
      return
    } else if (envelope && (!isFresh(envelope) || !isCurrentBuild(envelope))) {
      addFlow(set, "clear-stale-main")
      clearMain()
      clearLegacy()
    }
    set({ initialized: true })
    emitDebugEvent("HYDRATION_DONE", {
      source: "panicStore.initialize",
      restored: false,
      durationMs: Math.round((typeof performance !== "undefined" ? performance.now() : Date.now()) - hydrationStart),
    })
    if (!AUTO_DATA_ENGINE_ENABLED) {
      addFlow(set, "skip-initialize-fetch-auto-engine-off")
      return
    }
    await get().fetchPanicData("initialize-fetch")
  },

  fetchPanicData: async (source = "api-fetch") => {
    if (!AUTO_DATA_ENGINE_ENABLED) {
      addFlow(set, "block-fetch-auto-engine-off", { source })
      return false
    }
    if (get().manualMode) {
      addFlow(set, "block-fetch-manual", { source })
      return false
    }
    const seq = ++fetchSeq
    let updated = false
    try {
      const data = await fetchPanicDataJson({ debugLog: false })
      if (!validatePanicData(data)) return false
      if (seq !== fetchSeq || get().manualMode) {
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
        return { panicData: merged }
      })
      if (mergedForLog) {
        updated = true
        addFlow(set, "set-from-fetch-merge", {
          source,
          updatedAt: mergedForLog?.updatedAt ?? null,
          missingCount: removedKeys.length,
        })
      }
    } catch (err) {
      addFlow(set, "fetch-error-keep-state", { source, message: err instanceof Error ? err.message : String(err) })
      return false
    }
    return updated
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
      return { panicData: next, manualMode: true }
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
    if (refreshTimer) return
    refreshTimer = window.setInterval(() => {
      void get().fetchPanicData("interval-fetch")
    }, AUTO_REFRESH_MS)
    addFlow(set, "start-auto-refresh")
  },

  stopAutoRefresh: () => {
    if (!refreshTimer) return
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
