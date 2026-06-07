/**
 * Overheat Layer V1.4 — 과열 대응 신호 (표시·행동 전용 · 점수 무관)
 * 패닉 = 언제 사는가 · Overheat = 언제 덜어내는가
 * Hero 카드: [상태] · [원인] · [행동]
 */

import { resolveMarketState } from "./ydsStateEngine.js"

/** @typedef {"normal"|"cashPrep"|"partialCash"|"boundary"|"unwind"} OverheatTierId */

/**
 * @typedef {{
 *   id: OverheatTierId
 *   emoji: string
 *   title: string
 *   cause: string
 *   action: string
 *   label: string
 *   summary: string
 *   color: string
 *   cnn: number | null
 *   bofa: number | null
 *   level: "none"|"watch"|"elevated"|"critical"
 * }} OverheatLayerView
 */

/** @type {{ id: OverheatTierId; cnnAbove: number; bofaAbove: number; level: OverheatLayerView["level"] }[]} */
export const OVERHEAT_RULES = [
  { id: "boundary", cnnAbove: 80, bofaAbove: 8, level: "critical" },
  { id: "partialCash", cnnAbove: 70, bofaAbove: 7, level: "elevated" },
  { id: "cashPrep", cnnAbove: 60, bofaAbove: 6, level: "watch" },
]

/** @type {Record<"normal"|"cashPrep"|"partialCash"|"boundary", { emoji: string; color: string; title: string; cause: string; action: string }>} */
export const OVERHEAT_CARD_COPY = {
  normal: {
    emoji: "🟢",
    color: "#22c55e",
    title: "보유 구간",
    cause: "과열 신호 없음",
    action: "기존 포지션 유지",
  },
  cashPrep: {
    emoji: "🟡",
    color: "#eab308",
    title: "현금 준비",
    cause: "과열권 접근",
    action: "신규 진입 축소",
  },
  partialCash: {
    emoji: "🟠",
    color: "#f97316",
    title: "차익실현 구간",
    cause: "과열 신호 발생",
    action: "현금 확보 우선",
  },
  boundary: {
    emoji: "🔴",
    color: "#ef4444",
    title: "차익실현 구간",
    cause: "과열 신호 발생",
    action: "현금 확보 우선",
  },
}

/** @deprecated timeline — tier id 라벨 */
export const OVERHEAT_TIER_COPY = Object.fromEntries(
  Object.entries(OVERHEAT_CARD_COPY).map(([id, copy]) => [
    id,
    {
      id,
      emoji: copy.emoji,
      label: copy.title,
      color: copy.color,
      summary: copy.cause,
      action: copy.action,
    },
  ]),
)

function toNum(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * @param {number | null} cnn
 * @param {number | null} bofa
 */
function resolveOverheatTierId(cnn, bofa) {
  if (cnn == null || bofa == null) return "normal"
  for (const rule of OVERHEAT_RULES) {
    if (cnn > rule.cnnAbove && bofa > rule.bofaAbove) {
      return rule.id
    }
  }
  return "normal"
}

/**
 * @param {"normal"|"cashPrep"|"partialCash"|"boundary"} tierId
 * @param {{ cnn: number; bofa: number; level: OverheatLayerView["level"] }} metrics
 */
function buildOverheatView(tierId, metrics) {
  const copy = OVERHEAT_CARD_COPY[tierId]
  return {
    id: tierId,
    emoji: copy.emoji,
    title: copy.title,
    cause: copy.cause,
    action: copy.action,
    label: copy.title,
    summary: copy.cause,
    color: copy.color,
    cnn: metrics.cnn,
    bofa: metrics.bofa,
    level: metrics.level,
  }
}

/**
 * @param {object | null | undefined} panicData
 * @returns {OverheatLayerView | null}
 */
export function resolveOverheatLayer(panicData) {
  if (!panicData) return null
  const cnn = toNum(panicData.fearGreed)
  const bofa = toNum(panicData.bofa)
  if (cnn == null || bofa == null) return null

  const tierId = resolveOverheatTierId(cnn, bofa)
  const rule = OVERHEAT_RULES.find((r) => r.id === tierId)

  return buildOverheatView(tierId, {
    cnn,
    bofa,
    level: rule?.level ?? "none",
  })
}

/**
 * Hero Overheat 카드 — 과열 해소(unwind) 등 맥락 반영
 * @param {object | null | undefined} panicData
 * @param {object[]} [historyRows]
 * @param {import("./ydsMomentumLayer.js").MomentumLayerView | null | undefined} [momentum]
 */
export function resolveOverheatCardView(panicData, historyRows = [], momentum = null) {
  const base = resolveOverheatLayer(panicData)
  if (!base) return null

  if (base.id === "normal" && historyRows.length) {
    const regime = resolveMarketState(panicData, historyRows, momentum)
    if (regime?.id === "overheatUnwind") {
      return {
        ...base,
        id: "unwind",
        emoji: "🟠",
        color: "#f97316",
        title: "과열 해소 진행",
        cause: "최근 과열권 이탈",
        action: "추격 매수 금지",
        label: "과열 해소 진행",
        summary: "최근 과열권 이탈",
        level: "elevated",
      }
    }
  }

  return base
}
