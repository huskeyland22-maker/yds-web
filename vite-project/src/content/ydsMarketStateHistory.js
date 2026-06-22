/**
 * 메인 대시보드 — 시장상태 변화 히스토리 (cycleMetricHistory 실측 · AI 예측 없음)
 */

import { rowsWithinDays, toNum } from "./ydsLayerHistory.js"
import { resolveMarketPositionId } from "./ydsMarketPositionEngine.js"
import { sortHistoryRowsAsc } from "../utils/panicHistoryDesk.js"

export const MARKET_STATE_HISTORY_DAYS = 14

/** @typedef {import("./ydsMarketPositionEngine.js").MarketPositionId} MarketPositionId */

/** @type {Record<MarketPositionId, string>} */
export const DASHBOARD_MARKET_STATE_LABELS = {
  panic: "공포",
  fear: "공포",
  adjustment: "기대",
  boundary: "방어",
  overheat: "탐욕",
}

/**
 * @typedef {{
 *   date: string
 *   dateShort: string
 *   positionId: MarketPositionId
 *   stateLabel: string
 * }} MarketStateHistoryEntry
 */

/**
 * @typedef {{
 *   visible: boolean
 *   windowDays: number
 *   entries: MarketStateHistoryEntry[]
 *   summaryLine: string
 *   summarySub: string
 *   currentLabel: string
 * }} MarketStateHistoryReport
 */

/** @param {string} dateKey */
function formatDateShort(dateKey) {
  return String(dateKey).slice(5).replace("-", "/")
}

/**
 * @param {object | null | undefined} row
 * @returns {MarketStateHistoryEntry | null}
 */
function entryFromHistoryRow(row) {
  if (!row?.date) return null
  const cnn = toNum(row.fearGreed)
  const vix = toNum(row.vix)
  const bofa = toNum(row.bofa)
  if (cnn == null && vix == null && bofa == null) return null

  const positionId = resolveMarketPositionId(cnn, vix, bofa)
  return {
    date: String(row.date).slice(0, 10),
    dateShort: formatDateShort(row.date),
    positionId,
    stateLabel: DASHBOARD_MARKET_STATE_LABELS[positionId] ?? "—",
  }
}

/**
 * @param {MarketStateHistoryEntry[]} entries
 */
function buildStateRuns(entries) {
  /** @type {{ stateLabel: string; positionId: MarketPositionId; startDate: string; endDate: string }[]} */
  const runs = []
  for (const entry of entries) {
    const last = runs[runs.length - 1]
    if (!last || last.stateLabel !== entry.stateLabel) {
      runs.push({
        stateLabel: entry.stateLabel,
        positionId: entry.positionId,
        startDate: entry.date,
        endDate: entry.date,
      })
    } else {
      last.endDate = entry.date
    }
  }
  return runs
}

/** @type {Record<MarketPositionId, number>} */
const POSITION_CYCLE_ORDER = {
  panic: 0,
  fear: 0,
  adjustment: 1,
  boundary: 2,
  overheat: 3,
}

/**
 * @param {MarketStateHistoryEntry[]} entries
 */
function deriveTransitionSummary(entries) {
  const runs = buildStateRuns(entries)
  if (!runs.length) {
    return { summaryLine: "—", summarySub: "데이터 수집중", currentLabel: "—" }
  }

  const recentLabels = runs.slice(-3).map((r) => r.stateLabel)
  const summaryLine = recentLabels.join(" → ")
  const current = runs[runs.length - 1]
  const prev = runs.length > 1 ? runs[runs.length - 2] : null

  let summarySub = "전환 진행중"
  if (!prev) {
    summarySub = "단일 구간 유지"
  } else {
    const curOrder = POSITION_CYCLE_ORDER[current.positionId] ?? 1
    const prevOrder = POSITION_CYCLE_ORDER[prev.positionId] ?? 1
    if (curOrder > prevOrder) summarySub = "진입중"
    else if (curOrder < prevOrder) summarySub = "전환 진행중"
    else summarySub = "구간 유지"

    if (current.stateLabel === "탐욕" && prev.stateLabel === "기대") {
      summarySub = "진입중"
    }
    if (current.stateLabel === "공포" && prev.stateLabel === "방어") {
      summarySub = "전환 진행중"
    }
  }

  return {
    summaryLine,
    summarySub,
    currentLabel: current.stateLabel,
  }
}

/**
 * @param {object[]} historyRows
 * @param {number} [windowDays]
 * @returns {MarketStateHistoryReport}
 */
export function buildMarketStateHistoryReport(historyRows, windowDays = MARKET_STATE_HISTORY_DAYS) {
  const sorted = sortHistoryRowsAsc(historyRows)
  const windowed = rowsWithinDays(sorted, windowDays)
  const entries = windowed
    .map((row) => entryFromHistoryRow(row))
    .filter((/** @type {MarketStateHistoryEntry | null} */ e) => e != null)

  const { summaryLine, summarySub, currentLabel } = deriveTransitionSummary(entries)

  return {
    visible: entries.length >= 2,
    windowDays,
    entries,
    summaryLine,
    summarySub,
    currentLabel,
  }
}
