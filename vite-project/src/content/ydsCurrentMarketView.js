/**
 * V1.9 현재 시장 — Hero 단일 카드 (표시 전용)
 * State · Regime · Overheat · Momentum을 하나로 통합
 */

import { resolveMomentumLayer } from "./ydsMomentumLayer.js"
import { resolveOverheatCardView } from "./ydsOverheatLayer.js"
import { resolveMarketState } from "./ydsStateEngine.js"
import { toNum } from "./ydsLayerHistory.js"

/**
 * @typedef {{
 *   emoji: string
 *   label: string
 *   color: string
 *   cnn: number | null
 *   bofa: number | null
 *   cause: string
 * }} CurrentMarketView
 */

/**
 * @param {object | null | undefined} panicData
 * @param {object[]} [historyRows]
 * @returns {CurrentMarketView | null}
 */
export function resolveCurrentMarketView(panicData, historyRows = []) {
  if (!panicData) return null

  const momentum = resolveMomentumLayer(panicData, historyRows)
  const state = resolveMarketState(panicData, historyRows, momentum)
  const overheat = resolveOverheatCardView(panicData, historyRows, momentum)

  const cnn = toNum(panicData.fearGreed)
  const bofa = toNum(panicData.bofa)
  if (cnn == null || bofa == null) return null

  if (state) {
    const cause = state.subtitles[0] ?? (overheat?.id !== "normal" ? overheat.cause : "")
    return {
      emoji: state.emoji,
      label: state.label,
      color: state.color,
      cnn,
      bofa,
      cause,
    }
  }

  if (overheat) {
    return {
      emoji: overheat.emoji,
      label: overheat.title,
      color: overheat.color,
      cnn,
      bofa,
      cause: overheat.cause,
    }
  }

  return null
}
