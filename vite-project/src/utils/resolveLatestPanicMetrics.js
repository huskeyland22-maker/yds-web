/**
 * 데스크 상단 패닉 지표. 핵심 3지표는 같은 날짜 스냅샷만 사용한다.
 */

import { panicDataFromCycleRow } from "./cycleHistoryUtils.js"
import { panicDeskDataFromHistory } from "./panicHistoryDesk.js"

const METRIC_KEYS = [
  "vix",
  "vxn",
  "fearGreed",
  "putCall",
  "bofa",
  "move",
  "skew",
  "highYield",
]
const CORE_KEYS = ["vix", "fearGreed", "putCall"]
const DISPLAY_ONLY_KEYS = ["bbbOas", "bbb", "bbbSpread"]

function toNum(v) {
  if (v == null || v === "") return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** 데이터 기준일. updatedAt은 저장 시각이므로 기준일로 쓰지 않는다. */
export function panicDataDate(data) {
  const raw = data?.date ?? data?.tradeDate ?? data?.asOfDate
  const date = String(raw ?? "").slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null
}

/**
 * 입력 날짜가 알려진 최신 이력 날짜 이상일 때만 최신 스냅샷을 갱신한다.
 * 최신 이력 날짜를 모르면 더 늦은 행이 확인되지 않은 것으로 보고 갱신을 막지 않는다.
 */
export function shouldRefreshLatestPanicSnapshot(tradeDate, latestHistoryDate) {
  const input = String(tradeDate ?? "").slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) return false
  const latest = String(latestHistoryDate ?? "").slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(latest)) return true
  return input >= latest
}

function hasCoreTrio(data) {
  return CORE_KEYS.every((key) => toNum(data?.[key]) != null)
}

/** @param {Record<string, unknown> | null | undefined} data */
export function hasPanicMetricValues(data) {
  if (!data || typeof data !== "object") return false
  return METRIC_KEYS.some((k) => toNum(data[k]) != null)
}

/** @param {Record<string, unknown> | null | undefined} hub */
export function panicDataFromHubMetrics(hub) {
  if (!hub || typeof hub !== "object") return null
  const out = {
    vix: toNum(hub.vix),
    vxn: toNum(hub.vxn),
    fearGreed: toNum(hub.fearGreed),
    putCall: toNum(hub.putCall),
    bofa: toNum(hub.bofa),
    move: toNum(hub.move),
    skew: toNum(hub.skew),
    highYield: toNum(hub.highYield ?? hub.hyOas),
    bbbOas: toNum(hub.bbbOas),
    bbb: toNum(hub.bbb),
    bbbSpread: toNum(hub.bbbSpread),
    date: panicDataDate(hub),
    tradeDate: panicDataDate(hub),
    updatedAt: hub.updatedAt ?? hub.updated_at ?? null,
    accessTier: "pro",
    __fromHub: true,
  }
  return hasPanicMetricValues(out) ? out : null
}

/** API panic_index_history row (client shape) */
export function panicDataFromHistoryApiRow(row) {
  if (!row || typeof row !== "object") return null
  const date = String(row.date ?? "").slice(0, 10)
  const out = {
    date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
    vix: toNum(row.vix),
    vxn: toNum(row.vxn),
    fearGreed: toNum(row.fearGreed),
    putCall: toNum(row.putCall),
    move: toNum(row.move),
    bofa: toNum(row.bofa),
    skew: toNum(row.skew),
    highYield: toNum(row.hyOas ?? row.highYield),
    bbbOas: toNum(row.bbbOas),
    bbb: toNum(row.bbb),
    bbbSpread: toNum(row.bbbSpread),
    updatedAt: row.createdAt ?? row.updated_at ?? (date ? `${date}T12:00:00.000Z` : null),
    accessTier: "pro",
    __fromHistory: true,
    market_state: row.market_state ?? row.marketState ?? null,
  }
  return hasPanicMetricValues(out) ? out : null
}

/** daily_ai_reports — 지표 필드는 없을 수 있음 (market_state·panic_score만) */
export function reportMetricsFromDeskReport(report) {
  if (!report || typeof report !== "object") return null
  const date = String(report.date ?? report.tradeDate ?? "").slice(0, 10)
  const out = {
    updatedAt: report.updatedAt ?? (date ? `${date}T12:00:00.000Z` : null),
    accessTier: "pro",
    __fromReport: true,
    market_state: report.market_state ?? null,
    market_view: report.market_view ?? report.marketView ?? null,
    panic_score: toNum(report.panic_score),
  }
  if (hasPanicMetricValues(out)) return out
  if (out.market_state || out.market_view || out.panic_score != null) return out
  return null
}

/**
 * 핵심 3지표는 같은 날짜의 한 스냅샷에서만 가져온다.
 * 날짜가 다르거나 3지표가 한 스냅샷에 없으면 null이다.
 * @param {...(Record<string, unknown> | null)} sources
 */
export function coalesceLatestMetrics(...sources) {
  const complete = sources.filter((src) => src && typeof src === "object" && hasCoreTrio(src))
  if (!complete.length) return null
  const dated = complete.filter((src) => panicDataDate(src))
  const pool = dated.length ? dated : complete
  pool.sort((left, right) => String(panicDataDate(right) ?? "").localeCompare(String(panicDataDate(left) ?? "")))
  const chosen = pool[0]
  const date = panicDataDate(chosen)
  /** @type {Record<string, unknown>} */
  const out = { accessTier: "pro", date, tradeDate: date }
  for (const key of METRIC_KEYS) out[key] = toNum(chosen[key])
  for (const key of DISPLAY_ONLY_KEYS) out[key] = toNum(chosen[key])
  if (chosen.updatedAt) out.updatedAt = chosen.updatedAt
  if (chosen.__fromHub) out.__fromHub = true
  if (chosen.__fromHistory) out.__fromHistory = true
  if (chosen.__fromReport) out.__fromReport = true
  if (chosen.market_state) out.market_state = chosen.market_state
  if (chosen.market_view) out.market_view = chosen.market_view
  return out
}

/**
 * @param {{
 *   panicMetrics?: object | null
 *   latestHistory?: object | null
 *   reportMetrics?: object | null
 *   cycleRows?: object[]
 *   cycleRow?: object | null
 * }} input
 */
export function resolveLatestMetrics(input = {}) {
  const hub = panicDataFromHubMetrics(input.panicMetrics)
  const history = panicDataFromHistoryApiRow(input.latestHistory)
  const cycleFromRows =
    Array.isArray(input.cycleRows) && input.cycleRows.length
      ? panicDeskDataFromHistory(input.cycleRows)
      : null
  const cycleFromRow = input.cycleRow ? panicDataFromCycleRow(input.cycleRow) : null
  const report = reportMetricsFromDeskReport(input.reportMetrics)

  const latestMetrics = coalesceLatestMetrics(hub, history, cycleFromRows, cycleFromRow, report)
  const fallbackUsed = Boolean(!hasCoreTrio(hub) && (history || cycleFromRows || cycleFromRow))
  if (fallbackUsed || !latestMetrics) {
    console.log("[YDS] panic metrics fallback", {
      panicMetrics: hub,
      latestHistory: history,
      reportMetrics: report,
      latestMetrics,
    })
  }

  return latestMetrics
}

const STATE_KEY_LABELS = {
  risk_on: "Risk-on",
  neutral: "중립",
  fear_dominant: "공포 우세",
  volatility_expansion: "변동성 확대",
  defensive: "방어 모드",
}

/**
 * @param {ReturnType<typeof import("./marketStateEngine.js").resolveMarketState>} computed
 * @param {{ latestHistory?: object | null; marketCycleRow?: object | null; deskReport?: object | null }} sources
 */
export function resolveDeskMarketStateLabel(computed, sources = {}) {
  if (computed?.stateKey && computed.stateKey !== "insufficient") return computed

  const raw =
    sources.latestHistory?.market_state ??
    sources.latestHistory?.marketState ??
    sources.marketCycleRow?.market_state ??
    sources.marketCycleRow?.marketState ??
    sources.deskReport?.market_state ??
    sources.deskReport?.market_view ??
    sources.deskReport?.marketView ??
    "중립"

  const label = STATE_KEY_LABELS[raw] ?? String(raw)
  return {
    ...computed,
    stateKey: STATE_KEY_LABELS[raw] ? raw : "neutral",
    label,
    shortLabel: label,
    headline: label,
    mood: label,
  }
}
