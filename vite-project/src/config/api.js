import { filterFreshCycleHistoryRows } from "../utils/cycleHistoryHygiene.js"
import { validatePanicData } from "../utils/validatePanicData.js"
import {
  isDataTraceEnabled,
  logFetchFail,
  logFetchStart,
  logFetchSuccess,
} from "../utils/dataFlowTrace.js"
import { LIVE_JSON_GET_INIT, LIVE_POST_JSON_INIT, withNoStoreQuery } from "./liveDataFetch.js"
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

/** Supabase hub + Vercel `/api/panic/*` — cross-device sync (see .env.example). */
export function isPanicHubEnabled() {
  const on = import.meta.env.VITE_PANIC_HUB === "1" || import.meta.env.VITE_PANIC_HUB === "true"
  const url = String(import.meta.env.VITE_SUPABASE_URL ?? "").trim()
  const key = String(import.meta.env.VITE_SUPABASE_ANON_KEY ?? "").trim()
  return on && Boolean(url && key)
}

/** @returns {{ hubFlag: boolean, url: boolean, anonKey: boolean, enabled: boolean }} */
export function getPanicHubEnvStatus() {
  const hubFlag = import.meta.env.VITE_PANIC_HUB === "1" || import.meta.env.VITE_PANIC_HUB === "true"
  const url = String(import.meta.env.VITE_SUPABASE_URL ?? "").trim()
  const anonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY ?? "").trim()
  return {
    hubFlag,
    url: Boolean(url),
    anonKey: Boolean(anonKey),
    enabled: hubFlag && Boolean(url && anonKey),
  }
}

export async function fetchPanicHubLatest(options = {}) {
  const debugLog = options.debugLog !== false
  const url = withNoStoreQuery("/api/panic/latest")
  if (isDataTraceEnabled()) logFetchStart("panic-hub-latest", { url })
  const res = await fetch(url, LIVE_JSON_GET_INIT)
  if (debugLog) console.log("📡 panic hub latest", res.status, url)
  if (!res.ok) {
    if (isDataTraceEnabled()) logFetchFail("panic-hub-latest", new Error(`HTTP ${res.status}`), { url })
    throw new Error(`hub HTTP ${res.status}`)
  }
  const json = await res.json()
  if (!json?.ok) {
    if (isDataTraceEnabled()) logFetchFail("panic-hub-latest", new Error(String(json?.error)), { url })
    throw new Error(json?.error || "hub_invalid_payload")
  }
  if (json.empty || json.rowCount === 0) {
    const err = new Error("hub_empty_database")
    if (isDataTraceEnabled()) logFetchFail("panic-hub-latest", err, { url, hint: json.hint })
    throw err
  }
  if (!json.data) {
    throw new Error(json?.error || "hub_invalid_payload")
  }
  const data = normalizeManualPayload(json.data)
  const meta = json.meta && typeof json.meta === "object" ? json.meta : {}
  const isStale = Boolean(meta.isStale)
  if (isDataTraceEnabled()) {
    logFetchSuccess("panic-hub-latest", { url, cache: false, isStale, ageMs: meta.ageMs ?? null })
  }
  return {
    ...data,
    __fetchSource: "HUB",
    __fetchUrl: url,
    __fetchedAt: Date.now(),
    __isStale: isStale,
    __meta: meta,
  }
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

function panicIndexHistoryToCycleRow(row) {
  if (!row?.date) return null
  return {
    date: row.date,
    vix: row.vix,
    vxn: row.vxn,
    fearGreed: row.fearGreed,
    move: row.move,
    bofa: row.bofa,
    skew: row.skew,
    highYield: row.hyOas,
    gsBullBear: row.gsSentiment,
  }
}

export async function fetchCycleMetricsHistory(options = {}) {
  const debugLog = Boolean(options.debugLog)
  if (isPanicHubEnabled()) {
    if (isDataTraceEnabled()) logFetchStart("cycle-metrics-json", { path: "supabase-panic_index_history" })
    const hubRows = await fetchPanicIndexHistory({ limit: options.limit ?? 500 })
    const mapped = hubRows.map(panicIndexHistoryToCycleRow).filter(Boolean)
    const fresh = filterFreshCycleHistoryRows(mapped)
    if (isDataTraceEnabled()) {
      logFetchSuccess("cycle-metrics-json", { rows: fresh.length, source: "supabase", cache: false })
    }
    if (debugLog) console.log("[YDS] cycle history from Supabase", fresh.length)
    return fresh
  }
  const url = withNoStoreQuery(getCycleMetricsHistoryUrlForDisplay())
  if (isDataTraceEnabled()) logFetchStart("cycle-metrics-json", { url })
  const res = await fetch(url, LIVE_JSON_GET_INIT)
  if (debugLog) console.log("cycle-metrics-history 응답:", res.status)
  if (!res.ok) {
    if (isDataTraceEnabled()) logFetchFail("cycle-metrics-json", new Error(`HTTP ${res.status}`), { url })
    throw new Error(`HTTP ${res.status}`)
  }
  const data = await res.json()
  if (!Array.isArray(data)) {
    if (isDataTraceEnabled()) logFetchFail("cycle-metrics-json", new Error("not_array"), { url })
    throw new Error("cycle-metrics-history must be a JSON array")
  }
  const fresh = filterFreshCycleHistoryRows(data)
  if (isDataTraceEnabled()) {
    logFetchSuccess("cycle-metrics-json", {
      rows: fresh.length,
      dropped: data.length - fresh.length,
      cache: false,
    })
  }
  return fresh
}

/** GET /api/supabase/health — table row counts */
export async function fetchSupabaseHealth() {
  const url = withNoStoreQuery("/api/supabase/health")
  const res = await fetch(url, LIVE_JSON_GET_INIT)
  if (!res.ok) throw new Error(`health HTTP ${res.status}`)
  return res.json()
}

/** GET /api/market/status */
export async function fetchMarketStatus(options = {}) {
  if (!isPanicHubEnabled()) return []
  const params = new URLSearchParams()
  if (options.market) params.set("market", String(options.market))
  const q = params.toString()
  const url = withNoStoreQuery(`/api/market/status${q ? `?${q}` : ""}`)
  const res = await fetch(url, LIVE_JSON_GET_INIT)
  if (!res.ok) throw new Error(`market status HTTP ${res.status}`)
  const json = await res.json()
  return json?.ok && Array.isArray(json.rows) ? json.rows : []
}

/** GET /api/ai/reports */
export async function fetchAiReports(options = {}) {
  if (!isPanicHubEnabled()) return []
  const params = new URLSearchParams()
  if (options.reportKey) params.set("report_key", String(options.reportKey))
  if (options.limit) params.set("limit", String(options.limit))
  const q = params.toString()
  const url = withNoStoreQuery(`/api/ai/reports${q ? `?${q}` : ""}`)
  const res = await fetch(url, LIVE_JSON_GET_INIT)
  if (!res.ok) throw new Error(`ai reports HTTP ${res.status}`)
  const json = await res.json()
  return json?.ok && Array.isArray(json.rows) ? json.rows : []
}

/** Supabase panic_index_history — 일별 스냅샷 (동일 date upsert, 과거 조회) */
export async function fetchPanicIndexHistory(options = {}) {
  if (!isPanicHubEnabled()) return []
  const limit = options.limit ?? 120
  const params = new URLSearchParams({ limit: String(limit) })
  if (options.from) params.set("from", String(options.from).slice(0, 10))
  if (options.to) params.set("to", String(options.to).slice(0, 10))
  const url = withNoStoreQuery(`/api/panic/history?${params}`)
  if (isDataTraceEnabled()) logFetchStart("panic-index-history", { url })
  const res = await fetch(url, LIVE_JSON_GET_INIT)
  if (!res.ok) {
    if (isDataTraceEnabled()) logFetchFail("panic-index-history", new Error(`HTTP ${res.status}`), { url })
    throw new Error(`panic history HTTP ${res.status}`)
  }
  const json = await res.json()
  if (!json?.ok || !Array.isArray(json.rows)) {
    if (isDataTraceEnabled()) logFetchSuccess("panic-index-history", { rows: 0, note: "empty_or_invalid" })
    return []
  }
  if (isDataTraceEnabled()) logFetchSuccess("panic-index-history", { rows: json.rows.length })
  return json.rows
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
  /** 허브가 켜진 배포는 Render 레거시로 폴백하지 않음 — 구형 샘플·기기 불일치 방지 */
  const hubStatus = getPanicHubEnvStatus()
  if (!hubStatus.enabled) {
    if (isDataTraceEnabled()) {
      logFetchFail("panic-data-json", new Error("hub_env_missing"), { hubStatus })
    }
    console.error("[YDS] panic hub disabled — check VITE_PANIC_HUB, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (Vercel Production + redeploy)")
  }
  if (isPanicHubEnabled()) {
    if (isDataTraceEnabled()) logFetchStart("panic-data-json", { path: "hub-only" })
    const hubData = await fetchPanicHubLatest({ debugLog })
    const hasCore =
      hubData?.vix != null &&
      hubData?.fearGreed != null &&
      hubData?.bofa != null &&
      hubData?.putCall != null &&
      hubData?.highYield != null
    if (!hasCore) {
      const errMsg = hubData?.vix == null && hubData?.fearGreed == null ? "hub_empty_database" : "hub_incomplete_metrics"
      if (isDataTraceEnabled()) logFetchFail("panic-data-json", new Error(errMsg), {})
      throw new Error(errMsg)
    }
    const businessStale = !validatePanicData(hubData)
    const enriched = {
      ...hubData,
      __fetchSource: "HUB",
      __fetchUrl: hubData.__fetchUrl,
      __fetchedAt: Date.now(),
      __isStale: Boolean(hubData.__isStale) || businessStale,
    }
    if (businessStale && debugLog) {
      console.warn("[YDS] panic hub payload older than freshness window — showing with stale flag", {
        updatedAt: enriched.updatedAt,
      })
    }
    if (debugLog) console.log("[BOOT] panic hub", { updatedAt: enriched?.updatedAt ?? null })
    if (isDataTraceEnabled()) logFetchSuccess("panic-data-json", { route: "hub", source: "HUB" })
    return enriched
  }
  if (isDataTraceEnabled()) logFetchStart("panic-data-json", { path: "render-fallback", urls: buildPanicDataUrls() })
  const urls = buildPanicDataUrls().map((u) => withNoStoreQuery(u))
  let lastError = null

  for (const url of urls) {
    for (let attempt = 1; attempt <= PANIC_FETCH_RETRIES; attempt += 1) {
      try {
        if (debugLog) console.log("📡 API 요청 시작", { url, attempt, mode: "network-first" })
        const res = await fetch(url, LIVE_JSON_GET_INIT)
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
        if (isDataTraceEnabled()) logFetchSuccess("panic-data-json", { route: "render", url, cache: false })
        if (!validatePanicData(enriched)) {
          throw new Error("PANIC_LEGACY_STALE_PAYLOAD")
        }
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
  if (isDataTraceEnabled()) logFetchFail("panic-data-json", lastError ?? new Error("unknown"), { exhausted: true })
  throw lastError ?? new Error("panic data fetch failed")
}

/** @deprecated 레거시 /history.json(2024 샘플) — Supabase·panicStore만 사용 */
export async function fetchHistorySample(options = {}) {
  const debugLog = options.debugLog !== false
  if (debugLog) console.warn("[YDS] fetchHistorySample disabled — use panic_index_history / panicStore")
  if (isDataTraceEnabled()) logFetchStart("history-sample", { note: "disabled_legacy" })
  if (isDataTraceEnabled()) logFetchSuccess("history-sample", { rows: 0 })
  return []
}

export async function fetchOptimizeResult(options = {}) {
  const debugLog = options.debugLog !== false
  const url = withNoStoreQuery("/optimize.json")
  const res = await fetch(url, LIVE_JSON_GET_INIT)
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
  if (isPanicHubEnabled()) {
    const url = withNoStoreQuery("/api/panic/update")
    const res = await fetch(url, {
      ...LIVE_POST_JSON_INIT,
      body: JSON.stringify(inputData),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const out = await res.json()
    if (!out?.ok) throw new Error(String(out?.error || "hub_update_failed"))
    return {
      data: normalizeManualPayload(out.data),
      history: out.history ?? null,
      meta: out.meta ?? null,
    }
  }
  const base = getManualApiBase()
  const res = await fetch(withNoStoreQuery(`${base}/update`), {
    ...LIVE_POST_JSON_INIT,
    body: JSON.stringify(inputData),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const out = await res.json()
  return {
    data: normalizeManualPayload(out?.data),
    history: out?.history ?? null,
    meta: out?.meta ?? null,
  }
}

export async function submitManualTextData(rawText) {
  const base = getManualApiBase()
  const res = await fetch(withNoStoreQuery(`${base}/update-text`), {
    ...LIVE_POST_JSON_INIT,
    body: JSON.stringify({ text: rawText }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const out = await res.json()
  return normalizeManualPayload(out?.data)
}

export async function fetchMarketData() {
  const res = await fetch(withNoStoreQuery("/api/market-data"), LIVE_JSON_GET_INIT)
  if (!res.ok) {
    throw new Error(`market-data HTTP ${res.status}`)
  }
  const text = await res.text()
  let payload = {}
  try {
    payload = text ? JSON.parse(text) : {}
  } catch {
    throw new Error("market-data: invalid JSON")
  }
  if (import.meta.env.DEV) {
    console.log("[GlobalBar] market-data response", payload)
  }
  const root = typeof payload === "object" && payload != null && !Array.isArray(payload) ? payload : {}
  const pd = root?.parsedData
  const cd = root?.changeData
  return {
    parsedData: pd != null && typeof pd === "object" && !Array.isArray(pd) ? pd : {},
    changeData: cd != null && typeof cd === "object" && !Array.isArray(cd) ? cd : {},
    updatedAt: root?.updatedAt ?? null,
    source: root?.source ?? null,
  }
}
