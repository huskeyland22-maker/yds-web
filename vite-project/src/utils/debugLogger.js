const DEBUG_EVENTS_CHANNEL = "yds:debug:event"
const RECENT_LOGS = []
const MAX_RECENT_LOGS = 200

function nowIso() {
  return new Date().toISOString()
}

function toConsoleStyle(level) {
  if (level === "error") return "color:#fecaca;background:#7f1d1d;padding:2px 6px;border-radius:4px"
  if (level === "warn") return "color:#fde68a;background:#78350f;padding:2px 6px;border-radius:4px"
  return "color:#bfdbfe;background:#1e3a8a;padding:2px 6px;border-radius:4px"
}

export function isDebugModeEnabled() {
  if (typeof window === "undefined") return false
  try {
    const byQuery = new URL(window.location.href).searchParams.get("debug") === "1"
    const byStorage = window.localStorage.getItem("yds-debug-panel") === "1"
    return Boolean(import.meta.env.DEV || byQuery || byStorage)
  } catch {
    return Boolean(import.meta.env.DEV)
  }
}

export function emitDebugEvent(tag, payload = {}, level = "info") {
  const row = {
    ts: nowIso(),
    tag,
    level,
    payload,
  }

  if (typeof window !== "undefined") {
    try {
      window.dispatchEvent(new CustomEvent(DEBUG_EVENTS_CHANNEL, { detail: row }))
    } catch {
      // ignore
    }
  }

  const style = toConsoleStyle(level)
  const method = level === "error" ? "error" : level === "warn" ? "warn" : "log"
  console[method](`%c[${tag}]`, style, row.ts, payload)
  RECENT_LOGS.unshift(row)
  if (RECENT_LOGS.length > MAX_RECENT_LOGS) RECENT_LOGS.length = MAX_RECENT_LOGS
  return row
}

export function getDebugEventChannel() {
  return DEBUG_EVENTS_CHANNEL
}

export function getRecentDebugLogs() {
  return [...RECENT_LOGS]
}

export function logInfo(tag, payload = {}) {
  return emitDebugEvent(tag, payload, "info")
}

export function logWarn(tag, payload = {}) {
  return emitDebugEvent(tag, payload, "warn")
}

export function logError(tag, payload = {}) {
  return emitDebugEvent(tag, payload, "error")
}

export function logPerf(tag, payload = {}) {
  return emitDebugEvent(tag, payload, "info")
}

