/**
 * 거시 V1 — 날짜별 시장 국면 변화 로그
 */
import { formatChartAxisMd } from "../utils/chartDateFormat.js"
import { sortHistoryRowsAsc } from "../utils/panicHistoryDesk.js"
import { panicV1ScoreForRow } from "./panicV1History.js"
import { resolveMacroRegime } from "./panicMacroRegime.js"

/**
 * @typedef {{
 *   date: string
 *   axisLabel: string
 *   score: number
 *   regimeId: string
 *   regimeLabel: string
 * }} MacroRegimeLogEntry
 */

/**
 * @param {object[]} history
 * @param {{ maxEntries?: number; changeOnly?: boolean }} [opts]
 * @returns {MacroRegimeLogEntry[]}
 */
export function buildMacroRegimeLog(history, opts = {}) {
  const { maxEntries = 12, changeOnly = true } = opts
  const rows = sortHistoryRowsAsc(history)
  /** @type {MacroRegimeLogEntry[]} */
  const out = []
  let prevLabel = null

  for (const row of rows) {
    const score = panicV1ScoreForRow(row)
    if (score == null) continue
    const regime = resolveMacroRegime(score)
    if (!regime) continue

    if (!changeOnly || regime.label !== prevLabel) {
      const date = String(row.date ?? "").slice(0, 10)
      out.push({
        date,
        axisLabel: formatChartAxisMd(date),
        score,
        regimeId: regime.id,
        regimeLabel: regime.label,
      })
      prevLabel = regime.label
    }
  }

  return out.slice(-maxEntries)
}

/**
 * @param {object[]} chartData
 */
export function enrichChartDataWithMacroRegime(chartData) {
  return chartData.map((pt) => {
    const regime = resolveMacroRegime(pt.value)
    if (!regime) return pt
    return {
      ...pt,
      macroRegimeLabel: regime.label,
      macroRegimeId: regime.id,
    }
  })
}

/**
 * @param {object[]} chartData
 * @param {MacroRegimeLogEntry[]} log
 */
export function markMacroRegimeChangePoints(chartData, log) {
  const changeDates = new Set(log.map((e) => e.date))
  return chartData.map((pt) => {
    const regime = resolveMacroRegime(pt.value)
    if (!changeDates.has(pt.date) || !regime) return pt
    return {
      ...pt,
      inflectionLabel: regime.label,
      inflectionColor: regime.color,
    }
  })
}
