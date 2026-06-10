/**
 * YDS 오늘의 행동 — UI 전용
 * 시장 상태(cycle) 단계와 동일한 YDS 판정 · momentum은 타임라인 전용
 */

import {
  MARKET_CYCLE_ACTION_ITEMS,
  resolveMarketStageSnapshot,
} from "./ydsMarketStageLabels.js"
import {
  formatOverheatActionLines,
  resolveEffectiveMarketAllocation,
} from "./ydsOverheatAllocation.js"

/** @typedef {typeof MARKET_CYCLE_ACTION_ITEMS[keyof typeof MARKET_CYCLE_ACTION_ITEMS] extends string[] ? keyof typeof MARKET_CYCLE_ACTION_ITEMS : never} CycleActionBandId */

/** @typedef {{
 *   id: CycleActionBandId
 *   emoji: string
 *   label: string
 *   color: string
 *   actions: string[]
 * }} CycleActionGuide
 */

/**
 * @param {ReturnType<typeof resolveMarketStageSnapshot>} snapshot
 * @param {object | null | undefined} [panicData]
 */
export function resolveTodayActionsFromSnapshot(snapshot, panicData = null) {
  if (!snapshot?.cycle) return null

  const cycle = snapshot.cycle
  const baseActions = MARKET_CYCLE_ACTION_ITEMS[cycle.id]
  if (!baseActions?.length) return null

  const effective = panicData ? resolveEffectiveMarketAllocation(panicData) : null
  let actions = [...baseActions]
  if (effective?.mode === "overheat" && effective.tier) {
    const cashPct = effective.cashPct ?? null
    actions = formatOverheatActionLines(effective.tier, cashPct)
  }

  return {
    band: {
      id: cycle.id,
      emoji: cycle.emoji,
      label: cycle.label,
      color: cycle.color,
    },
    actions,
    panicId: snapshot.panic?.id ?? null,
    ydsScore: snapshot.ydsScore ?? null,
  }
}

/**
 * @param {number | null | undefined} ydsScore
 * @param {import("./ydsMomentumLayer.js").MomentumLayerView | null | undefined} [_momentum] — 하위 호환 (미사용)
 * @param {object | null | undefined} [panicData]
 */
export function resolveTodayActions(ydsScore, _momentum, panicData = null) {
  const snapshot = resolveMarketStageSnapshot(ydsScore)
  return resolveTodayActionsFromSnapshot(snapshot, panicData)
}

/** @deprecated PANIC_ACTION_GUIDE — 종목추천 macro 연동용 레거시 */
export const PANIC_ACTION_GUIDE = {
  noFear: { id: "overheat", macroId: "overheated", emoji: "🔵", label: "공포 없음" },
  lowFear: { id: "neutral", macroId: "neutral", emoji: "🟢", label: "공포 부족" },
  interest: { id: "interest", macroId: "interest", emoji: "🟡", label: "관심" },
  dca: { id: "dca", macroId: "dca", emoji: "🟠", label: "분할매수" },
  lifePoint: { id: "lifePoint", macroId: "panicBuy", emoji: "🔴", label: "인생 타점" },
}
