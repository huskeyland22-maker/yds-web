/**
 * YDS V1.9 과열권 현금 비중 — 표시·배분 전용 (점수·엔진 무관)
 * 패닉에서 공격 · 과열에서 방어
 */

import { getFinalScore } from "../utils/tradingScores.js"
import { resolveMacroV1Status } from "../panic-v2/panicMacroV1Status.js"
import { resolveMacroStageAllocation } from "../trading-zone/macroStageAllocation.js"
import { toNum } from "./ydsLayerHistory.js"

/** @typedef {"entry"|"boundary"|"extreme"} OverheatAllocationTierId */

/**
 * @typedef {{
 *   id: OverheatAllocationTierId
 *   emoji: string
 *   label: string
 *   stockPct: number
 *   cashPct: number
 *   displayRatio: string
 *   condition: string
 *   note: string
 *   actions: string[]
 * }} OverheatAllocationTier
 */

/** @type {OverheatAllocationTier[]} */
export const OVERHEAT_ALLOCATION_MAP = [
  {
    id: "entry",
    emoji: "🟡",
    label: "과열권 진입",
    stockPct: 50,
    cashPct: 50,
    displayRatio: "50 / 50",
    condition: "CNN 60+ · BofA 6+",
    note: "현금 준비 시작 · 신규 진입 축소",
    actions: ["일부 익절", "신규 진입 축소", "현금 확보 시작"],
  },
  {
    id: "boundary",
    emoji: "🟠",
    label: "고점 경계",
    stockPct: 40,
    cashPct: 60,
    displayRatio: "40 / 60",
    condition: "CNN 70+ · BofA 7+",
    note: "수익 정리 · 공격 매수 중단",
    actions: ["수익 종목 적극 정리", "공격 매수 중단", "현금 중심 운영"],
  },
  {
    id: "extreme",
    emoji: "🔴",
    label: "최고 과열",
    stockPct: 25,
    cashPct: 75,
    displayRatio: "20~30 / 70~80",
    condition: "CNN 80+ · BofA 8+",
    note: "대부분 현금화 · 패닉 대기",
    actions: ["대부분 현금화", "관망", "패닉 구간 대기"],
  },
]

/** @type {Record<OverheatAllocationTierId, OverheatAllocationTier>} */
export const OVERHEAT_ALLOCATION_BY_ID = Object.fromEntries(
  OVERHEAT_ALLOCATION_MAP.map((tier) => [tier.id, tier]),
)

export const YDS_OVERHEAT_ALLOCATION_PHILOSOPHY = [
  "과열권은 매도 구간이 아니라 현금 준비 구간이다.",
  "상승을 놓쳐도 괜찮다. 현금을 확보해야 패닉에서 공격할 수 있다.",
]

const PANIC_BUY_STAGES = new Set(["interest", "dca", "panicBuy"])

/**
 * @param {number | null} cnn
 * @param {number | null} bofa
 * @returns {OverheatAllocationTier | null}
 */
export function resolveOverheatAllocationTier(cnn, bofa) {
  if (cnn == null || bofa == null) return null
  if (cnn > 80 && bofa > 8) return OVERHEAT_ALLOCATION_BY_ID.extreme
  if (cnn > 70 && bofa > 7) return OVERHEAT_ALLOCATION_BY_ID.boundary
  if (cnn >= 60 || bofa >= 6) return OVERHEAT_ALLOCATION_BY_ID.entry
  return null
}

/**
 * @typedef {{
 *   mode: "panic" | "overheat"
 *   stageId: string
 *   tier: OverheatAllocationTier | null
 *   stockPct: number
 *   cashPct: number
 *   stockLabel: string
 *   cashLabel: string
 *   note?: string
 *   actions?: string[]
 * }} EffectiveMarketAllocation
 */

/**
 * @param {object | null | undefined} panicData
 * @returns {EffectiveMarketAllocation | null}
 */
export function resolveEffectiveMarketAllocation(panicData) {
  if (!panicData) return null
  const score = getFinalScore(panicData)
  if (!Number.isFinite(score)) return null

  const stage = resolveMacroV1Status(score)
  const stageId = stage?.id ?? "neutral"
  const base = resolveMacroStageAllocation(stageId)
  if (!base) return null

  if (PANIC_BUY_STAGES.has(stageId)) {
    return {
      mode: "panic",
      stageId,
      tier: null,
      stockPct: base.stockPct,
      cashPct: base.cashPct,
      stockLabel: base.stockLabel,
      cashLabel: base.cashLabel,
      note: base.note,
    }
  }

  const cnn = toNum(panicData.fearGreed)
  const bofa = toNum(panicData.bofa)
  const tier = resolveOverheatAllocationTier(cnn, bofa)

  if (tier) {
    return {
      mode: "overheat",
      stageId,
      tier,
      stockPct: tier.stockPct,
      cashPct: tier.cashPct,
      stockLabel: `주식 ${tier.stockPct}%`,
      cashLabel: `현금 ${tier.cashPct}%`,
      note: tier.note,
      actions: tier.actions,
    }
  }

  return {
    mode: "panic",
    stageId,
    tier: null,
    stockPct: base.stockPct,
    cashPct: base.cashPct,
    stockLabel: base.stockLabel,
    cashLabel: base.cashLabel,
    note: base.note,
  }
}

/**
 * @param {OverheatAllocationTier | null | undefined} tier
 * @param {number | null | undefined} cashPct
 */
export function formatOverheatActionLines(tier, cashPct) {
  if (!tier) return []
  return tier.actions.map((line, index) => {
    if (index === 2 && cashPct != null) {
      return `현금 ${cashPct}% 확보`
    }
    return line
  })
}
