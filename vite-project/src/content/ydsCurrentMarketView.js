/**
 * 현재 시장 상태 — Hero 카드 (시장 위치 · CNN/VIX/BofA)
 */

import { resolveMarketPositionView } from "./ydsMarketPositionEngine.js"

/**
 * @typedef {{
 *   emoji: string
 *   label: string
 *   color: string
 *   hint: string
 *   positionId: import("./ydsMarketPositionEngine.js").MarketPositionId
 *   ydsScore: number | null
 * }} CurrentMarketView
 */

/**
 * @param {object | null | undefined} panicData
 * @returns {CurrentMarketView | null}
 */
export function resolveCurrentMarketView(panicData) {
  const view = resolveMarketPositionView(panicData)
  if (!view) return null

  const { position } = view
  return {
    emoji: position.emoji,
    label: position.label,
    color: position.color,
    hint: position.descriptions[0] ?? "",
    positionId: position.id,
    ydsScore: null,
  }
}

/** @deprecated snapshot 경로 — 시장 위치 엔진 사용 */
export function currentMarketViewFromSnapshot(snapshot) {
  if (!snapshot?.cycle) return null
  return {
    emoji: snapshot.cycle.emoji,
    label: snapshot.cycle.label,
    color: snapshot.cycle.color,
    hint: snapshot.cycle.hint ?? "",
    positionId: "adjustment",
    ydsScore: snapshot.ydsScore ?? null,
  }
}
