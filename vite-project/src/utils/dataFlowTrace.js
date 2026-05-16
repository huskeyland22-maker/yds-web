/**
 * 긴급 데이터 흐름 추적 — fetch / cache / realtime / stale 모두 콘솔에 남김.
 * 활성: DEV · VITE_DATA_TRACE=1 · ?data-trace=1 · localStorage yds-data-trace=1
 */

const STALE_MS = 5 * 60 * 1000

export function isDataTraceEnabled() {
  if (typeof window === "undefined") {
    return import.meta.env.DEV || import.meta.env.VITE_DATA_TRACE === "1"
  }
  try {
    if (import.meta.env.DEV) return true
    if (import.meta.env.VITE_DATA_TRACE === "1" || import.meta.env.VITE_DATA_TRACE === "true") return true
    if (new URL(window.location.href).searchParams.get("data-trace") === "1") return true
    if (window.localStorage.getItem("yds-data-trace") === "1") return true
  } catch {
    // ignore
  }
  return false
}

/** 배지·패널 표시용 — 명시 플래그만 (DEV 자동 노출 방지) */
export function isDataTraceUiEnabled() {
  if (typeof window === "undefined") {
    return import.meta.env.VITE_DATA_TRACE === "1"
  }
  try {
    if (import.meta.env.VITE_DATA_TRACE === "1" || import.meta.env.VITE_DATA_TRACE === "true") return true
    if (new URL(window.location.href).searchParams.get("data-trace") === "1") return true
    if (window.localStorage.getItem("yds-data-trace") === "1") return true
  } catch {
    // ignore
  }
  return false
}

function fmtTime(ts) {
  if (ts == null || !Number.isFinite(Number(ts))) return "—"
  const d = new Date(Number(ts))
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleTimeString("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
}

function baseLog(level, event, payload) {
  const line = {
    t: new Date().toISOString(),
    event,
    ...payload,
  }
  const msg = `[YDS_DATA] ${event}`
  if (level === "warn") console.warn(msg, line)
  else if (level === "error") console.error(msg, line)
  else console.log(msg, line)
}

export function logFetchStart(layer, detail = {}) {
  if (!isDataTraceEnabled()) return
  baseLog("info", "fetch:start", { layer, ...detail })
}

export function logFetchSuccess(layer, detail = {}) {
  if (!isDataTraceEnabled()) return
  baseLog("info", "fetch:success", { layer, ...detail })
}

export function logFetchFail(layer, error, detail = {}) {
  if (!isDataTraceEnabled()) return
  const message = error instanceof Error ? error.message : String(error)
  baseLog("error", "fetch:fail", { layer, message, ...detail })
}

export function logCacheHit(layer, detail = {}) {
  if (!isDataTraceEnabled()) return
  baseLog("info", "cache:hit", { layer, ...detail })
}

export function logCacheMiss(layer, detail = {}) {
  if (!isDataTraceEnabled()) return
  baseLog("info", "cache:miss", { layer, ...detail })
}

export function logRealtime(event, detail = {}) {
  if (!isDataTraceEnabled()) return
  baseLog("info", `realtime:${event}`, detail)
}

export function logStoreWrite(layer, detail = {}) {
  if (!isDataTraceEnabled()) return
  baseLog("info", "store:write", { layer, ...detail })
}

export function warnStaleData(layer, detail = {}) {
  baseLog("warn", "STALE_WARNING", { layer, ...detail })
}

/**
 * @param {string | undefined} updatedAtIso - payload business time
 * @returns {{ stale: boolean, ageMs: number | null }}
 */
export function computePayloadStale(updatedAtIso) {
  if (!updatedAtIso || typeof updatedAtIso !== "string") return { stale: false, ageMs: null }
  const normalized = updatedAtIso.includes("T") ? updatedAtIso : updatedAtIso.replace(" ", "T")
  const t = Date.parse(normalized)
  if (!Number.isFinite(t)) return { stale: false, ageMs: null }
  const ageMs = Date.now() - t
  return { stale: ageMs > STALE_MS, ageMs }
}

let lastStaleWarnAt = 0
export function maybeWarnPayloadStale(layer, updatedAtIso, extra = {}) {
  const { stale, ageMs } = computePayloadStale(updatedAtIso)
  if (!stale) return
  const now = Date.now()
  if (now - lastStaleWarnAt < 30_000) return
  lastStaleWarnAt = now
  warnStaleData(layer, {
    updatedAt: updatedAtIso,
    ageMs,
    ageMin: ageMs != null ? Math.round(ageMs / 60000) : null,
    ...extra,
  })
}

export function formatTraceTime(ts) {
  return fmtTime(ts)
}

/** UI 컴포넌트 데이터 소스 추적 (콘솔) */
export function logComponentDataSource(component, detail = {}) {
  if (!isDataTraceEnabled()) return
  baseLog("info", "component:data", { component, ...detail })
}
