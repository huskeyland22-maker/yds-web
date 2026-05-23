/**
 * 히스토리 row → 패닉지수 V2 시계열
 */
import { formatChartAxisMd } from "../utils/chartDateFormat.js"
import { sortHistoryRowsAsc } from "../utils/panicHistoryDesk.js"
import { computePanicV2, pickPanicV2Raw } from "./computePanicV2.js"
import { buildPanicV2DynamicSeries } from "./panicV2Dynamic.js"
import { resolvePanicV2Status } from "./panicV2Status.js"

/** @param {object} row */
export function rowToPanicV2Input(row) {
  if (!row) return null
  return {
    vix: pickPanicV2Raw(row, "vix"),
    highYield: pickPanicV2Raw(row, "highYield"),
    move: pickPanicV2Raw(row, "move"),
    vxn: pickPanicV2Raw(row, "vxn"),
    putCall: pickPanicV2Raw(row, "putCall"),
    fearGreed: pickPanicV2Raw(row, "fearGreed"),
    skew: pickPanicV2Raw(row, "skew"),
    bofa: pickPanicV2Raw(row, "bofa"),
    gsBullBear: pickPanicV2Raw(row, "gsBullBear"),
  }
}

/** @param {object} row */
export function panicV2ScoreForRow(row) {
  const cached = row?.panicV2Score ?? row?.panic_v2_score
  if (cached != null && Number.isFinite(Number(cached))) return Math.round(Number(cached))
  const result = computePanicV2(rowToPanicV2Input(row) ?? row, { includeLegacy: false })
  return result.score
}

/** @param {object[]} rows */
export function enrichHistoryWithPanicV2(rows) {
  return sortHistoryRowsAsc(rows).map((row) => {
    const score = panicV2ScoreForRow(row)
    const status = resolvePanicV2Status(score)
    return {
      ...row,
      panicV2Score: score,
      panicV2Status: status?.label ?? null,
      panicV2StatusId: status?.id ?? null,
    }
  })
}

/** @param {object[]} history */
export function buildPanicV2HistoryChartData(history) {
  return enrichHistoryWithPanicV2(history)
    .map((row) => {
      if (row.panicV2Score == null) return null
      const date = String(row.date ?? "").slice(0, 10)
      return {
        date,
        axisLabel: formatChartAxisMd(date),
        value: row.panicV2Score,
        panicV2: row.panicV2Score,
        panicV2Status: row.panicV2Status,
        inflectionLabel: row.panicV2Status ? `${formatChartAxisMd(date)} ${row.panicV2Status}` : undefined,
      }
    })
    .filter(Boolean)
}

/**
 * 최근 N일 점수 타임라인
 * @param {object[]} history
 * @param {number} [limit]
 */
/**
 * @param {object[]} history
 * @param {number} [limit]
 * @param {"level" | "dynamic"} [mode]
 */
export function buildPanicScoreTimeline(history, limit = 8, mode = "dynamic") {
  if (mode === "dynamic") {
    return buildPanicV2DynamicSeries(history)
      .filter((r) => r.score != null)
      .slice(-limit)
      .map((r) => ({
        date: r.date,
        axisLabel: r.axisLabel,
        score: r.score,
        status: r.status,
        statusId: r.statusId,
      }))
  }
  const enriched = enrichHistoryWithPanicV2(history)
  return enriched
    .filter((r) => r.panicV2Score != null)
    .slice(-limit)
    .map((r) => ({
      date: r.date,
      axisLabel: formatChartAxisMd(r.date),
      score: r.panicV2Score,
      status: r.panicV2Status,
      statusId: r.panicV2StatusId,
    }))
}
