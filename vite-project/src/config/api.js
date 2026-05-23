import { filterFreshCycleHistoryRows } from "../utils/cycleHistoryHygiene.js"
import { validatePanicData } from "../utils/validatePanicData.js"
import {
  isDataTraceEnabled,
  logFetchFail,
  logFetchStart,
  logFetchSuccess,
} from "../utils/dataFlowTrace.js"
import { LIVE_JSON_GET_INIT, LIVE_POST_JSON_INIT, withNoStoreQuery } from "./liveDataFetch.js"
import {
  assertPanicSubmitPayloadNumeric,
  normalizePanicSubmitPayload,
} from "../utils/panicDbNumeric.js"
import { panicDataFromHistoryApiRow } from "../utils/resolveLatestPanicMetrics.js"
import {
  logHistoryFetchDebug,
  probePanicIndexHistoryDirect,
} from "../utils/panicHistoryFetchDebug.js"
import { logSaveError, toErrorMessage } from "../utils/errorMessage.js"
import {
  coercePanicSavePayload,
  stripNilEntries,
  validatePanicSavePayload,
} from "../utils/panicSaveValidate.js"
import { panicEmergencyHubPayload } from "../utils/panicEmergencyFallback.js"
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

/** Supabase hub + Vercel `/api/panic?mode=…` — 단일 serverless 함수 (see .env.example). */
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

/**
 * @param {string} mode latest | history | historylatest | v2 | v2history | backfill | update
 * @param {Record<string, string | number | undefined>} [extra]
 */
export function panicApiUrl(mode, extra = {}) {
  const params = new URLSearchParams({ mode })
  for (const [k, v] of Object.entries(extra)) {
    if (v != null && v !== "") params.set(k, String(v))
  }
  return withNoStoreQuery(`/api/panic?${params}`)
}

export async function fetchPanicHubLatest(options = {}) {
  const debugLog = options.debugLog !== false
  const url = panicApiUrl("latest")
  if (isDataTraceEnabled()) logFetchStart("panic-hub-latest", { url })
  try {
    const res = await fetch(url, LIVE_JSON_GET_INIT)
    const responseText = await res.text()
    if (debugLog) console.log("📡 panic hub latest", res.status, url)
    console.log("response status", res.status)
    console.log("response text", responseText)
    let json = {}
    try {
      json = responseText ? JSON.parse(responseText) : {}
    } catch {
      json = { raw: responseText }
    }

    const rawData = json?.data
    const hasData =
      rawData != null &&
      !(Array.isArray(rawData) && rawData.length === 0) &&
      (typeof rawData === "object" || Array.isArray(rawData))

    if (!hasData) {
      console.warn("[panic-hub-latest] empty — emergency fallback")
      return panicEmergencyHubPayload()
    }

    const data = normalizeManualPayload(Array.isArray(rawData) ? rawData[0] : rawData)
    const meta = json.meta && typeof json.meta === "object" ? json.meta : {}
    const isStale = Boolean(meta.isStale) || Boolean(json.emergency)
    if (isDataTraceEnabled()) {
      logFetchSuccess("panic-hub-latest", {
        url,
        cache: false,
        isStale,
        ageMs: meta.ageMs ?? null,
        emergency: Boolean(json.emergency),
      })
    }
    return {
      ...data,
      __fetchSource: json.emergency ? "EMERGENCY" : "HUB",
      __fetchUrl: url,
      __fetchedAt: Date.now(),
      __isStale: isStale,
      __meta: meta,
      __emergency: Boolean(json.emergency),
    }
  } catch (err) {
    console.error("[panic-hub-latest] fetch failed — emergency fallback", err)
    if (isDataTraceEnabled()) logFetchFail("panic-hub-latest", err, { url, emergency: true })
    return panicEmergencyHubPayload()
  }
}

/** 데스크 fallback용 — 절대 throw 없음 */
export async function fetchPanicHubLatestOptional(options = {}) {
  try {
    const data = await fetchPanicHubLatest({ ...options, debugLog: options.debugLog ?? false })
    return data ?? panicEmergencyHubPayload()
  } catch {
    return panicEmergencyHubPayload()
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
    const raw = await fetchPanicIndexHistory({ limit: options.limit ?? 500 })
    const hubRows = Array.isArray(raw) ? raw : raw?.rows ?? []
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

/** @alias fetchPanicIndexHistory — 디버그 로그 포함 */
export async function fetchHistory(options = {}) {
  return fetchPanicIndexHistory(options)
}

/** Supabase panic_index_history — 일별 누적 (동일 date NULL-fill upsert) */
export async function fetchPanicIndexHistory(options = {}) {
  if (!isPanicHubEnabled()) {
    console.warn("[YDS] fetchHistory: panic hub disabled (VITE_PANIC_HUB + Supabase env)")
    return options.withCycle ? { rows: [], cycleRows: [] } : []
  }

  void probePanicIndexHistoryDirect()

  const limit = options.limit ?? 120
  const extra = { limit: String(limit) }
  if (options.from) extra.from = String(options.from).slice(0, 10)
  if (options.to) extra.to = String(options.to).slice(0, 10)
  if (options.withCycle) extra.cycle = "1"
  const url = panicApiUrl("history", extra)
  if (isDataTraceEnabled()) logFetchStart("panic-index-history", { url })
  const res = await fetch(url, LIVE_JSON_GET_INIT)
  if (!res.ok) {
    if (isDataTraceEnabled()) logFetchFail("panic-index-history", new Error(`HTTP ${res.status}`), { url })
    console.error("[YDS] fetchHistory HTTP error", res.status, url)
    throw new Error(`panic history HTTP ${res.status}`)
  }
  const json = await res.json()
  if (!json?.ok || !Array.isArray(json.rows)) {
    if (isDataTraceEnabled()) logFetchSuccess("panic-index-history", { rows: 0, note: "empty_or_invalid" })
    console.warn("[YDS] fetchHistory: API empty or invalid", json)
    logHistoryFetchDebug([], options.debugMetric, options.debugRange)
    return options.withCycle ? { rows: [], cycleRows: [] } : []
  }
  logHistoryFetchDebug(json.rows, options.debugMetric, options.debugRange)
  if (isDataTraceEnabled()) {
    logFetchSuccess("panic-index-history", {
      rows: json.rows.length,
      cycleRows: Array.isArray(json.cycleRows) ? json.cycleRows.length : 0,
    })
  }
  if (options.withCycle) {
    return {
      rows: json.rows,
      cycleRows: Array.isArray(json.cycleRows) ? json.cycleRows : [],
    }
  }
  return json.rows
}

/** panic_history_v2 — 일별 패닉 V2 점수 */
export async function fetchPanicHistoryV2(options = {}) {
  if (!isPanicHubEnabled()) return []
  const limit = options.limit ?? 600
  const extra = { limit: String(limit) }
  if (options.from) extra.from = String(options.from).slice(0, 10)
  if (options.to) extra.to = String(options.to).slice(0, 10)
  const url = panicApiUrl("v2history", extra)
  if (isDataTraceEnabled()) logFetchStart("panic-history-v2", { url })
  const res = await fetch(url, LIVE_JSON_GET_INIT)
  if (!res.ok) {
    if (isDataTraceEnabled()) logFetchFail("panic-history-v2", new Error(`HTTP ${res.status}`), { url })
    console.warn("[YDS] fetchPanicHistoryV2 HTTP", res.status)
    return []
  }
  const json = await res.json()
  const rows = json?.ok && Array.isArray(json.rows) ? json.rows : []
  if (json?.warning) console.warn("[YDS] fetchPanicHistoryV2 warning", json.warning)
  if (isDataTraceEnabled()) logFetchSuccess("panic-history-v2", { rows: rows.length })
  return rows
}

/** panic_index_history → panic_history_v2 백필 */
export async function backfillPanicHistoryV2(options = {}) {
  if (!isPanicHubEnabled()) return { ok: false, skipped: true, reason: "hub_disabled" }
  const limit = options.limit ?? 600
  const url = panicApiUrl("backfill", { limit: String(limit) })
  if (isDataTraceEnabled()) logFetchStart("panic-history-v2-backfill", { url })
  const res = await fetch(url, {
    ...LIVE_POST_JSON_INIT,
    method: "POST",
    body: JSON.stringify({ limit, source: options.source ?? "client" }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    if (isDataTraceEnabled()) logFetchFail("panic-history-v2-backfill", new Error(`HTTP ${res.status}`))
    return { ok: false, error: `HTTP ${res.status}` }
  }
  if (isDataTraceEnabled()) logFetchSuccess("panic-history-v2-backfill", json)
  return json
}

/** panic_index_history 최신 1건 — cycle 대시보드 mount·저장 직후용 */
export async function fetchPanicIndexLatest() {
  if (!isPanicHubEnabled()) return null
  const url = panicApiUrl("historylatest")
  if (isDataTraceEnabled()) logFetchStart("panic-index-latest", { url })
  const res = await fetch(url, LIVE_JSON_GET_INIT)
  if (!res.ok) {
    if (isDataTraceEnabled()) logFetchFail("panic-index-latest", new Error(`HTTP ${res.status}`), { url })
    throw new Error(`panic latest HTTP ${res.status}`)
  }
  const json = await res.json()
  const row = json?.row ?? (Array.isArray(json?.rows) ? json.rows[0] : null)
  if (isDataTraceEnabled()) logFetchSuccess("panic-index-latest", { hasRow: Boolean(row), date: row?.date ?? null })
  return row && typeof row === "object" ? row : null
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
    let hubData = await fetchPanicHubLatestOptional({ debugLog })
    const hasCore = (d) =>
      d?.vix != null &&
      d?.fearGreed != null &&
      d?.bofa != null &&
      d?.putCall != null &&
      d?.highYield != null
    if (!hasCore(hubData)) {
      const latestRow = await fetchPanicIndexLatest().catch(() => null)
      if (latestRow) {
        const fromHistory = panicDataFromHistoryApiRow(latestRow)
        if (fromHistory) {
          hubData = { ...fromHistory, __fetchSource: "HISTORY", __fetchedAt: Date.now() }
          if (debugLog) console.log("[BOOT] panic hub fallback → history latest", { date: latestRow.date })
        }
      }
    }
    if (!hasCore(hubData)) {
      if (debugLog) console.warn("[BOOT] panic hub incomplete — emergency fallback")
      hubData = panicEmergencyHubPayload()
    }
    const businessStale = !validatePanicData(hubData)
    const enriched = {
      ...hubData,
      __fetchSource: hubData.__fetchSource ?? "HUB",
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
    if (isDataTraceEnabled()) logFetchSuccess("panic-data-json", { route: "hub", source: enriched.__fetchSource })
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

function normalizeManualPayload(data) {
  console.log("[panic pipeline] client-input")
  if (data && typeof data === "object") {
    for (const key of ["vix", "vxn", "fearGreed", "putCall", "bofa", "move", "skew", "highYield", "gsBullBear"]) {
      if (key in data) console.log("[panic pipeline] client-input", key, data[key], typeof data[key])
    }
  }
  const out = normalizePanicSubmitPayload(data)
  assertPanicSubmitPayloadNumeric(out)
  console.log("[panic pipeline] client-payload-ready")
  return out
}

async function postPanicSave(url, payload) {
  const body = coercePanicSavePayload(stripNilEntries(payload))
  const validation = validatePanicSavePayload(body)
  if (!validation.ok) {
    const err = new Error(validation.error || "missing_required")
    err.stage = "validation"
    err.missing = validation.missing
    logSaveError("save error", err)
    throw err
  }
  console.log("save payload", JSON.stringify(body, null, 2))
  const res = await fetch(url, {
    ...LIVE_POST_JSON_INIT,
    body: JSON.stringify(body),
  })
  const responseText = await res.text()
  console.log("response status", res.status)
  console.log("response text", responseText)
  let out = {}
  try {
    out = responseText ? JSON.parse(responseText) : {}
  } catch {
    out = { raw: responseText }
  }
  console.log("save response", { status: res.status, ok: res.ok, body: out })
  return { res, out, responseText }
}

export async function submitManualPanicData(inputData) {
  const payload = normalizeManualPayload(inputData)
  console.table(
    ["vix", "vxn", "fearGreed", "putCall", "bofa", "move", "skew", "highYield", "gsBullBear"].map((key) => ({
      metric: key,
      value: payload?.[key],
      type: typeof payload?.[key],
    })),
  )
  if (isPanicHubEnabled()) {
    const url = panicApiUrl("update")
    const { res, out } = await postPanicSave(url, payload)
    if (!res.ok) {
      const detail =
        toErrorMessage(out?.message ?? out?.error, "") ||
        res.statusText ||
        `HTTP ${res.status}`
      const err = new Error(detail)
      err.status = res.status
      err.stage = out?.stage ?? "http"
      err.history = out?.history
      if (typeof out?.stack === "string") err.stack = out.stack
      if (out?.payload) console.log("save error payload", out.payload)
      logSaveError("save error", err)
      throw err
    }
    if (!out?.ok) {
      const err = new Error(toErrorMessage(out?.error, "hub_update_failed"))
      err.status = res.status
      err.history = out.history
      err.stage = out?.stage ?? "hub"
      logSaveError("save error", err)
      throw err
    }
    if (!out.history?.ok) {
      const err = new Error(
        toErrorMessage(
          out.history?.reason ?? out.history?.error,
          "panic_index_history_upsert_failed",
        ),
      )
      err.status = res.status
      err.history = out.history
      err.stage = out?.stage ?? "history"
      logSaveError("save error", err)
      throw err
    }
    const response = {
      data: normalizeManualPayload(out.data),
      history: out.history ?? null,
      meta: out.meta ?? null,
      report: out.report ?? null,
      reportKey: out.reportKey ?? null,
    }
    console.log("save response", response)
    return response
  }
  const base = getManualApiBase()
  const { res, out } = await postPanicSave(withNoStoreQuery(`${base}/update`), payload)
  if (!res.ok) {
    const err = new Error(
      toErrorMessage(out?.message ?? out?.error, "") || res.statusText || `HTTP ${res.status}`,
    )
    err.status = res.status
    if (typeof out?.stack === "string") err.stack = out.stack
    if (out?.payload) console.log("save error payload", out.payload)
    logSaveError("save error", err)
    throw err
  }
  const response = {
    data: normalizeManualPayload(out?.data),
    history: out?.history ?? null,
    meta: out?.meta ?? null,
    report: out?.report ?? null,
    reportKey: out?.reportKey ?? null,
  }
  console.log("save response", response)
  return response
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

/**
 * @param {{ cacheBust?: boolean }} [opts] — Bond Sync: PWA/중간 캐시 우회용 추가 bust
 */
export async function fetchMarketData(opts = {}) {
  const path = opts.cacheBust ? "/api/market-data?bondSync=1" : "/api/market-data"
  const res = await fetch(withNoStoreQuery(path), LIVE_JSON_GET_INIT)
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
    bondFred: root?.bondFred ?? null,
  }
}
