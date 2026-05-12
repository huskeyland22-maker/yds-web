import { validatePanicData } from "../utils/validatePanicData.js"

const fetchPanicJsonInit = {
  method: "GET",
  headers: {
    Accept: "application/json",
    Pragma: "no-cache",
    "Cache-Control": "no-cache, no-store, must-revalidate",
  },
  cache: "no-store",
}
const PANIC_FETCH_RETRIES = 3
const PANIC_FETCH_BACKOFF_MS = [400, 1200, 2500]

export function getApiBase() {
  return ""
}

export function getManualApiBase() {
  const raw = import.meta.env.VITE_API_BASE
  if (typeof raw === "string" && raw.trim()) return raw.trim().replace(/\/+$/, "")
  return "https://yds-web.onrender.com"
}

function buildPanicDataUrls() {
  const base = getManualApiBase()
  return [`${base}/panic-data`, `${base}/panic`]
}

export function getPanicDataUrlForDisplay() {
  const [first] = buildPanicDataUrls()
  return first ?? null
}

export function getHistoryUrlForDisplay() {
  return "/history.json"
}

/** 시장 사이클 차트용 일별 누적 히스토리 (GitHub Actions / update_data.py 가 갱신) */
export function getCycleMetricsHistoryUrlForDisplay() {
  return "/cycle-metrics-history.json"
}

export async function fetchCycleMetricsHistory(options = {}) {
  const debugLog = Boolean(options.debugLog)
  const url = `${getCycleMetricsHistoryUrlForDisplay()}?t=${Date.now()}`
  const res = await fetch(url, fetchPanicJsonInit)
  if (debugLog) console.log("cycle-metrics-history 응답:", res.status)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  if (!Array.isArray(data)) throw new Error("cycle-metrics-history must be a JSON array")
  return data
}

export function listPanicDataUrlAttemptsForDisplay() {
  return buildPanicDataUrls()
}

function pickMetricValue(obj) {
  if (obj == null) return null
  if (typeof obj === "number") return obj
  if (typeof obj === "object" && obj.value != null) {
    const n = parseFloat(String(obj.value).replace(/%/g, "").replace(/,/g, "").trim())
    return Number.isFinite(n) ? n : null
  }
  return null
}

function normalizePanicPayload(data) {
  if (!data || typeof data !== "object") return data
  return {
    ...data,
    vix: pickMetricValue(data.vix),
    vxn: pickMetricValue(data.vxn),
    skew: pickMetricValue(data.skew),
    putCall: pickMetricValue(data.putCall),
    move: pickMetricValue(data.move),
    fearGreed: pickMetricValue(data.fearGreed),
    highYield: pickMetricValue(data.highYield),
    updatedAt: typeof data.updated_at === "string" ? data.updated_at : data.updatedAt,
    accessTier: "pro",
  }
}

export async function fetchPanicDataJson(options = {}) {
  const debugLog = options.debugLog !== false
  const urls = buildPanicDataUrls().map((u) => `${u}?t=${Date.now()}`)
  let lastError = null

  for (const url of urls) {
    for (let attempt = 1; attempt <= PANIC_FETCH_RETRIES; attempt += 1) {
      try {
        if (debugLog) console.log("📡 API 요청 시작", { url, attempt, mode: "network-first" })
        const res = await fetch(url, fetchPanicJsonInit)
        if (debugLog) console.log("✅ 응답 상태:", res.status)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const raw = await res.json()
        const data = normalizePanicPayload(raw)
        const enriched = {
          ...data,
          __fetchSource: "API",
          __fetchUrl: url,
          __fetchedAt: Date.now(),
          __isStale: Boolean(data?.isStale),
        }
        if (debugLog) {
          console.log("📦 받은 데이터:", data)
          console.log("[BOOT] source log", {
            cacheSource: "network-first",
            apiSource: url,
            isStale: Boolean(data?.isStale),
            updatedAt: data?.updatedAt ?? data?.updated_at ?? null,
          })
        }
        if (!validatePanicData(enriched)) throw new Error("데이터 이상 감지: fallback 주입 없이 현재 상태 유지")
        return enriched
      } catch (err) {
        lastError = err
        if (debugLog) console.error("❌ 에러 발생:", { url, attempt, err })
        if (attempt < PANIC_FETCH_RETRIES) {
          const waitMs = PANIC_FETCH_BACKOFF_MS[attempt - 1] ?? 1000
          await new Promise((resolve) => setTimeout(resolve, waitMs))
        }
      }
    }
  }
  throw lastError ?? new Error("panic data fetch failed")
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
  const n = parseFloat(String(v).replace(/%/g, "").replace(/,/g, "").trim())
  return Number.isFinite(n) ? n : null
}

function normalizeManualPayload(data) {
  if (!data || typeof data !== "object") return data
  return {
    ...data,
    vix: toNumberOrNull(data.vix),
    vxn: toNumberOrNull(data.vxn),
    fearGreed: toNumberOrNull(data.fearGreed),
    putCall: toNumberOrNull(data.putCall),
    bofa: toNumberOrNull(data.bofa),
    move: toNumberOrNull(data.move),
    skew: toNumberOrNull(data.skew),
    highYield: toNumberOrNull(data.highYield),
    gsBullBear: toNumberOrNull(data.gsBullBear ?? data.gs),
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

export async function submitManualTextData(rawText) {
  const base = getManualApiBase()
  const res = await fetch(`${base}/update-text`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ text: rawText }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const out = await res.json()
  return normalizeManualPayload(out?.data)
}

export async function fetchMarketData() {
  const res = await fetch("/api/market-data", {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  })
  if (!res.ok) {
    throw new Error(`market-data HTTP ${res.status}`)
  }
  const payload = await res.json()
  console.log("[GlobalBar] market-data response", payload)
  return {
    parsedData: payload?.parsedData ?? {},
    changeData: payload?.changeData ?? {},
    updatedAt: payload?.updatedAt ?? null,
    source: payload?.source ?? null,
  }
}
