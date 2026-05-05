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

export function getManualApiBase() {
  const raw = import.meta.env.VITE_API_BASE
  if (typeof raw === "string" && raw.trim()) return raw.trim().replace(/\/+$/, "")
  return "https://yds-web.onrender.com"
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

function toNumberOrNull(v) {
  if (v == null || v === "") return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function normalizeManualPayload(data) {
  if (!data || typeof data !== "object") return data
  return {
    ...data,
    vix: toNumberOrNull(data.vix),
    fearGreed: toNumberOrNull(data.fearGreed),
    putCall: toNumberOrNull(data.putCall),
    bofa: toNumberOrNull(data.bofa),
    highYield: toNumberOrNull(data.highYield),
    accessTier: "pro",
    updatedAt: data.updatedAt ?? new Date().toISOString().slice(0, 16).replace("T", " "),
  }
}

export async function submitManualPanicData(inputData) {
  const base = getManualApiBase()
  const res = await fetch(`${base}/update`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(inputData),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const out = await res.json()
  return normalizeManualPayload(out?.data)
}
