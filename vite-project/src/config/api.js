import { validatePanicData } from "../utils/validatePanicData.js"

const LOCAL_DATA_URL = "/data.json"
const fetchPanicJsonInit = {
  method: "GET",
  headers: { Accept: "application/json" },
  cache: "no-store",
}

export function getApiBase() {
  return ""
}

export function getPanicDataUrlForDisplay() {
  return LOCAL_DATA_URL
}

export function getHistoryUrlForDisplay() {
  return "/history.json"
}

export function listPanicDataUrlAttemptsForDisplay() {
  return [LOCAL_DATA_URL]
}

function pickMetricValue(obj, fallback = null) {
  if (obj == null) return fallback
  if (typeof obj === "number") return obj
  if (typeof obj === "object" && obj.value != null) return Number(obj.value)
  return fallback
}

function normalizePanicPayload(data) {
  if (!data || typeof data !== "object") return data
  return {
    ...data,
    vix: pickMetricValue(data.vix, 20),
    vxn: pickMetricValue(data.vxn, null),
    skew: pickMetricValue(data.skew, null),
    putCall: pickMetricValue(data.putCall, 1),
    move: pickMetricValue(data.move, null),
    fearGreed: pickMetricValue(data.fearGreed, 50),
    highYield: pickMetricValue(data.highYield, 4),
    updatedAt: typeof data.updated_at === "string" ? data.updated_at : data.updatedAt,
    accessTier: "pro",
  }
}

export async function fetchPanicDataJson(options = {}) {
  const debugLog = options.debugLog !== false
  const url = LOCAL_DATA_URL
  try {
    if (debugLog) console.log("📡 API 요청 시작", url)
    const res = await fetch(url, fetchPanicJsonInit)
    if (debugLog) console.log("✅ 응답 상태:", res.status)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const raw = await res.json()
    const data = normalizePanicPayload(raw)
    if (debugLog) console.log("📦 받은 데이터:", data)
    if (!validatePanicData(data)) throw new Error("데이터 이상 감지")
    return data
  } catch (err) {
    if (debugLog) console.error("❌ 에러 발생:", err)
    throw err
  }
}

export async function fetchHistorySample(options = {}) {
  const debugLog = options.debugLog !== false
  const url = "/history.json"
  const res = await fetch(url, fetchPanicJsonInit)
  if (debugLog) console.log("✅ history 응답 상태:", res.status)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  if (!Array.isArray(data)) throw new Error("history 응답이 배열이 아님")
  return data
}

export async function fetchOptimizeResult(options = {}) {
  const debugLog = options.debugLog !== false
  const url = "/optimize.json"
  const res = await fetch(url, fetchPanicJsonInit)
  if (debugLog) console.log("🤖 optimize 상태:", res.status)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}
