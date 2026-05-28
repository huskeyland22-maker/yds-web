/**
 * 데스크 상단 패닉 지표 — 다중 소스 순차 fallback.
 * priority: latest_panic_metrics → panic_index_history 최신 → cycle history → daily report
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
  "gsBullBear",
]

function toNum(v) {
  if (v == null || v === "") return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
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
    gsBullBear: toNum(hub.gsBullBear ?? hub.gsSentiment),
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
    vix: toNum(row.vix),
    vxn: toNum(row.vxn),
    fearGreed: toNum(row.fearGreed),
    putCall: toNum(row.putCall),
    move: toNum(row.move),
    bofa: toNum(row.bofa),
    skew: toNum(row.skew),
    highYield: toNum(row.hyOas ?? row.highYield),
    gsBullBear: toNum(row.gsSentiment ?? row.gsBullBear),
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
 * 필드별 coalesce — 앞 소스 우선
 * @param {...(Record<string, unknown> | null)} sources
 */
export function coalesceLatestMetrics(...sources) {
  const valid = sources.filter((s) => s && typeof s === "object")
  if (!valid.length) return null

  /** @type {Record<string, unknown>} */
  const out = { accessTier: "pro" }
  for (const key of METRIC_KEYS) {
    for (const src of valid) {
      const n = toNum(src[key])
      if (n != null) {
        out[key] = n
        break
      }
    }
  }
  for (const src of valid) {
    if (src.updatedAt) {
      out.updatedAt = src.updatedAt
      break
    }
  }
  if (valid[0].__fromHub) out.__fromHub = true
  if (valid.some((s) => s.__fromHistory)) out.__fromHistory = true
  if (valid.some((s) => s.__fromReport)) out.__fromReport = true
  const hist = valid.find((s) => s.market_state)
  if (hist?.market_state) out.market_state = hist.market_state
  const rep = valid.find((s) => s.market_view)
  if (rep?.market_view) out.market_view = rep.market_view

  return hasPanicMetricValues(out) ? out : null
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
  const cycle = cycleFromRow ?? cycleFromRows
  const report = reportMetricsFromDeskReport(input.reportMetrics)

  const latestMetrics = coalesceLatestMetrics(hub, history, cycle, report)
  const fallbackUsed = Boolean(!hub && (history || cycle || report))
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
