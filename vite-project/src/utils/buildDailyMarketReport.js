/**
 * YDS Daily Market Report — Cycle·패닉 최종 판단 (채권은 참고만, 판단 미반영)
 */
import { resolveCyclePosition } from "../market-os/positionLabels.js"
import { computeMarketAction } from "./panicMarketActionEngine.js"
import { computeMarketTiming } from "./panicMarketTimingEngine.js"
import { buildSectorRotation } from "./buildSectorRotation.js"

/**
 * @typedef {{
 *   statusPills: string[]
 *   practicalAction: string
 *   cashAllocation: string
 *   cautionSectors: string
 *   watchSectors: string
 *   ready: boolean
 * }} DailyMarketReport
 */

/** @param {number} c */
function resolveCashFromCycleOnly(c) {
  if (!Number.isFinite(c)) return "20~30%"
  if (c <= 28) return "25~35%"
  if (c <= 38) return "18~28%"
  if (c <= 48) return "12~22%"
  if (c <= 58) return "10~18%"
  return "8~15%"
}

/**
 * @param {{
 *   panicData?: object | null
 *   cycleScore?: number | null
 *   snapshot?: import("../macro-risk/engine.js").MacroRiskSnapshot | null
 * }} input
 * @returns {DailyMarketReport}
 */
export function buildDailyMarketReport({ panicData = null, cycleScore = null, snapshot = null }) {
  const cycle = resolveCyclePosition(cycleScore)
  const action = computeMarketAction(panicData)
  const timing = computeMarketTiming(panicData)
  const rotation = buildSectorRotation({ panicData, cycleScore, snapshot: null })

  const hasCycle = Number.isFinite(Number(cycleScore))
  const hasPanic = Boolean(action)
  const ready = hasCycle || hasPanic

  const statusPills =
    cycle.position && cycle.position !== "데이터 대기" ? [cycle.position] : []

  const practicalAction =
    timing?.short?.actionShort ||
    timing?.short?.action ||
    action?.shortTerm ||
    action?.actionHeadline?.split("—")[0]?.trim() ||
    "관망"

  const c = Number(cycleScore)
  const cashAllocation = `${resolveCashFromCycleOnly(c)}%`

  return {
    statusPills,
    practicalAction,
    cashAllocation,
    cautionSectors: rotation.cautionSummary,
    watchSectors: rotation.watchSummary,
    ready,
  }
}
