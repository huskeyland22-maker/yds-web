/**
 * 현재 시장 상태 — Hero 카드 (YDS 단일 판정 · resolveMarketStageSnapshot)
 */

import { getFinalScore } from "../utils/tradingScores.js"
import { resolveMarketStageSnapshot } from "./ydsMarketStageLabels.js"

/**
 * @typedef {{
 *   emoji: string
 *   label: string
 *   color: string
 *   hint: string
 *   cycleId: import("./ydsStatusLabels.js").CycleBandId
 *   panicId: import("./ydsStatusLabels.js").PanicBandId | null
 *   cycleScore: number | null
 *   ydsScore: number | null
 * }} CurrentMarketView
 */

/**
 * @param {ReturnType<typeof resolveMarketStageSnapshot>} snapshot
 * @returns {CurrentMarketView | null}
 */
export function currentMarketViewFromSnapshot(snapshot) {
  if (!snapshot?.cycle) return null
  return {
    emoji: snapshot.cycle.emoji,
    label: snapshot.cycle.label,
    color: snapshot.cycle.color,
    hint: snapshot.cycle.hint ?? "",
    cycleId: snapshot.cycle.id,
    panicId: snapshot.panic?.id ?? null,
    cycleScore: snapshot.cycle.score ?? null,
    ydsScore: snapshot.ydsScore ?? null,
  }
}

/**
 * @param {object | null | undefined} panicData
 * @param {object[]} [_historyRows] — 하위 호환 (미사용 · momentum/state 엔진 분리)
 * @returns {CurrentMarketView | null}
 */
export function resolveCurrentMarketView(panicData, _historyRows = []) {
  if (!panicData) return null
  const score = getFinalScore(panicData)
  if (!Number.isFinite(score)) return null
  return currentMarketViewFromSnapshot(resolveMarketStageSnapshot(Math.round(score)))
}
