/**
 * 시장분석 30일 추이 — panic_history 단일 소스, 일별 자동 계산
 */

import { formatChartAxisMd } from "../utils/chartDateFormat.js"
import { getFinalScore } from "../utils/tradingScores.js"
import { sortHistoryRowsAsc } from "../utils/panicHistoryDesk.js"
import {
  buildTimelineSeries,
  formatTimelineDateLabel,
  scanTimelineEventsFromSeries,
} from "./ydsMarketTimeline.js"
import { rowsWithinDays, toNum } from "./ydsLayerHistory.js"
import {
  computeMarketPositionScore,
  resolveMarketPositionId,
} from "./ydsMarketPositionEngine.js"

export const MARKET_TREND_WINDOW_DAYS = 30

/** @type {{ min: number; max: number; color: string; label: string }[]} */
export const YDS_SCORE_ZONE_STEPS = [
  { min: 0, max: 20, color: "#3b82f6", label: "저점" },
  { min: 20, max: 40, color: "#22c55e", label: "완화" },
  { min: 40, max: 60, color: "#eab308", label: "중립" },
  { min: 60, max: 80, color: "#f97316", label: "경계" },
  { min: 80, max: 100, color: "#ef4444", label: "극단" },
]

const MARKET_ZONE_LABELS = ["충격", "위축", "조정", "경계", "과열"]
const PANIC_ZONE_LABELS = ["공포없음", "공포부족", "관심", "분할매수", "적극매수"]

const MARKET_TREND_EVENT_RE =
  /^(position-|overheat-|cnn-entry|cnn-exit|bofa-entry|bofa-exit|momentum-cnn-crash|momentum-cnn-sharp|momentum-bofa-weak|vix-expansion)/
const PANIC_TREND_EVENT_RE = /^panic-/

/**
 * @param {number} score
 * @param {"market" | "panic"} kind
 */
export function resolveScoreZoneMeta(score, kind = "panic") {
  const rounded = Math.max(0, Math.min(100, Math.round(Number(score))))
  const zoneIdx =
    rounded >= 80 ? 4 : rounded >= 60 ? 3 : rounded >= 40 ? 2 : rounded >= 20 ? 1 : 0
  const zone = YDS_SCORE_ZONE_STEPS[zoneIdx]
  const labels = kind === "market" ? MARKET_ZONE_LABELS : PANIC_ZONE_LABELS
  return {
    score: rounded,
    color: zone.color,
    label: labels[zoneIdx] ?? zone.label,
    zoneIndex: zoneIdx,
  }
}

/** @param {object | null | undefined} row */
export function marketStateScoreForRow(row) {
  if (!row) return null
  const cnn = toNum(row.fearGreed)
  const vix = toNum(row.vix)
  const bofa = toNum(row.bofa)
  if (cnn == null && vix == null) return null
  const stageId = resolveMarketPositionId(cnn, vix, bofa)
  return computeMarketPositionScore(cnn, vix, bofa, stageId)
}

/** @param {object | null | undefined} row */
export function panicIntensityScoreForRow(row) {
  if (!row) return null
  const score = getFinalScore(row)
  return Number.isFinite(score) ? Math.round(score) : null
}

/**
 * @param {object[]} historyRows
 * @param {number} [windowDays]
 */
export function buildMarketStateTrendChartData(historyRows, windowDays = MARKET_TREND_WINDOW_DAYS) {
  const sorted = sortHistoryRowsAsc(historyRows)
  const windowed = rowsWithinDays(sorted, windowDays)
  return windowed
    .map((row) => {
      const date = String(row.date ?? "").slice(0, 10)
      const value = marketStateScoreForRow(row)
      if (!date || value == null) return null
      return {
        date,
        axisLabel: formatChartAxisMd(date),
        value,
        marketStateScore: value,
      }
    })
    .filter(Boolean)
}

/**
 * @param {object[]} historyRows
 * @param {number} [windowDays]
 */
export function buildPanicIntensityTrendChartData(historyRows, windowDays = MARKET_TREND_WINDOW_DAYS) {
  const sorted = sortHistoryRowsAsc(historyRows)
  const windowed = rowsWithinDays(sorted, windowDays)
  return windowed
    .map((row) => {
      const date = String(row.date ?? "").slice(0, 10)
      const value = panicIntensityScoreForRow(row)
      if (!date || value == null) return null
      return {
        date,
        axisLabel: formatChartAxisMd(date),
        value,
        panicIntensity: value,
      }
    })
    .filter(Boolean)
}

/**
 * @param {object[]} historyRows
 * @param {"market" | "panic"} kind
 * @param {number} [windowDays]
 * @param {number} [limit]
 */
export function buildTrendChangeFeed(historyRows, kind, windowDays = MARKET_TREND_WINDOW_DAYS, limit = 4) {
  const sorted = sortHistoryRowsAsc(historyRows)
  const windowed = rowsWithinDays(sorted, windowDays)
  if (!windowed.length) return []

  const cutoff = windowed[0].date
  const series = buildTimelineSeries(historyRows)
  const events = scanTimelineEventsFromSeries(series)
  const re = kind === "market" ? MARKET_TREND_EVENT_RE : PANIC_TREND_EVENT_RE

  return events
    .filter((ev) => ev?.date && ev.date >= cutoff && re.test(ev.type))
    .slice(0, limit)
    .map((ev) => ({
      date: ev.date,
      dateLabel: formatTimelineDateLabel(ev.date),
      title: ev.title,
    }))
}

/**
 * @param {object[]} historyRows
 * @param {number} [windowDays]
 */
export function buildMarketTrendView(historyRows, windowDays = MARKET_TREND_WINDOW_DAYS) {
  const marketSeries = buildMarketStateTrendChartData(historyRows, windowDays)
  const panicSeries = buildPanicIntensityTrendChartData(historyRows, windowDays)

  const marketCurrent = marketSeries.length ? marketSeries[marketSeries.length - 1].value : null
  const panicCurrent = panicSeries.length ? panicSeries[panicSeries.length - 1].value : null

  return {
    windowDays,
    market: {
      chartData: marketSeries,
      current: marketCurrent,
      currentMeta: marketCurrent != null ? resolveScoreZoneMeta(marketCurrent, "market") : null,
      changes: buildTrendChangeFeed(historyRows, "market", windowDays),
    },
    panic: {
      chartData: panicSeries,
      current: panicCurrent,
      currentMeta: panicCurrent != null ? resolveScoreZoneMeta(panicCurrent, "panic") : null,
      changes: buildTrendChangeFeed(historyRows, "panic", windowDays),
    },
  }
}
