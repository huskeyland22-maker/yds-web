/**
 * Overheat Layer V1.4 — 과열 대응 신호 (표시·행동 전용 · 점수 무관)
 * 패닉 = 언제 사는가 · Overheat = 언제 덜어내는가
 */

/** @typedef {"normal"|"cashPrep"|"partialCash"|"boundary"} OverheatTierId */

/**
 * @typedef {{
 *   id: OverheatTierId
 *   emoji: string
 *   label: string
 *   color: string
 *   summary: string
 *   action: string
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

/** @type {Record<OverheatTierId, Omit<OverheatLayerView, "id"|"cnn"|"bofa"|"level">> & { id: OverheatTierId }} */
export const OVERHEAT_TIER_COPY = {
  normal: {
    id: "normal",
    emoji: "🟢",
    label: "정상",
    color: "#22c55e",
    summary: "과열 신호 없음",
    action: "보유 유지",
  },
  cashPrep: {
    id: "cashPrep",
    emoji: "🟡",
    label: "현금 준비",
    color: "#eab308",
    summary: "과열권 접근 중",
    action: "추격매수 금지",
  },
  partialCash: {
    id: "partialCash",
    emoji: "🟠",
    label: "현금 확보",
    color: "#f97316",
    summary: "과열권 진입",
    action: "신규 진입 축소",
  },
  boundary: {
    id: "boundary",
    emoji: "🔴",
    label: "최고 과열",
    color: "#ef4444",
    summary: "극단적 탐욕 구간",
    action: "적극적 현금 확보",
  },
}

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
 * @param {object | null | undefined} panicData
 * @returns {OverheatLayerView | null}
 */
export function resolveOverheatLayer(panicData) {
  if (!panicData) return null
  const cnn = toNum(panicData.fearGreed)
  const bofa = toNum(panicData.bofa)
  if (cnn == null || bofa == null) return null

  const tierId = resolveOverheatTierId(cnn, bofa)
  const copy = OVERHEAT_TIER_COPY[tierId]
  const rule = OVERHEAT_RULES.find((r) => r.id === tierId)

  return {
    id: tierId,
    emoji: copy.emoji,
    label: copy.label,
    color: copy.color,
    summary: copy.summary,
    action: copy.action,
    cnn,
    bofa,
    level: rule?.level ?? "none",
  }
}
