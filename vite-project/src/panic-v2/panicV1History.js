/**
 * 패닉 V1 (getFinalScore) 히스토리 시계열
 */
import { formatChartAxisMd } from "../utils/chartDateFormat.js"
import { getFinalScore } from "../utils/tradingScores.js"
import { sortHistoryRowsAsc } from "../utils/panicHistoryDesk.js"
import { rowToPanicV2Input } from "./panicV2History.js"

/** @param {object} row */
export function panicV1ScoreForRow(row) {
  const cached = row?.panicScore ?? row?.panic_score ?? row?.panicIndex
  if (cached != null && Number.isFinite(Number(cached))) return Math.round(Number(cached))
  const input = rowToPanicV2Input(row)
  if (!input) return null
  const data = {
    vix: input.vix,
    putCall: input.putCall,
    fearGreed: input.fearGreed,
    bofa: input.bofa,
    highYield: input.highYield,
  }
  if (data.vix == null && data.fearGreed == null) return null
  return getFinalScore(data)
}

/** @param {object[]} history */
export function buildPanicV1HistoryChartData(history) {
  return sortHistoryRowsAsc(history)
    .map((row) => {
      const score = panicV1ScoreForRow(row)
      if (score == null) return null
      const date = String(row.date ?? "").slice(0, 10)
      return {
        date,
        axisLabel: formatChartAxisMd(date),
        value: score,
        panicV1: score,
      }
    })
    .filter(Boolean)
}
