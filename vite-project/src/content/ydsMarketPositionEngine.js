/**
 * YDS 시장 위치 — CNN · VIX · BofA 기반 5단계 (표시 전용)
 * 시장 상태 = 시장이 어디쯤인가 (과열 → 패닉)
 */

/** @typedef {"overheat" | "boundary" | "adjustment" | "fear" | "panic"} MarketPositionId */

/**
 * @typedef {{
 *   id: MarketPositionId
 *   emoji: string
 *   label: string
 *   short: string
 *   color: string
 * }} MarketPositionStage
 */

/** @type {MarketPositionStage[]} — 과열(낙관) → 패닉(공포) */
export const MARKET_POSITION_STAGES = [
  {
    id: "overheat",
    emoji: "🔴",
    label: "과열",
    short: "과열",
    color: "#ef4444",
  },
  {
    id: "boundary",
    emoji: "🟠",
    label: "경계",
    short: "경계",
    color: "#f97316",
  },
  {
    id: "adjustment",
    emoji: "🟡",
    label: "조정",
    short: "조정",
    color: "#eab308",
  },
  {
    id: "fear",
    emoji: "🟢",
    label: "위축",
    short: "위축",
    color: "#22c55e",
  },
  {
    id: "panic",
    emoji: "🔵",
    label: "충격",
    short: "충격",
    color: "#3b82f6",
  },
]

/** @type {Record<MarketPositionId, string[]>} */
export const MARKET_POSITION_DESCRIPTIONS = {
  overheat: ["극단적 낙관", "변동성 억제 · 추격 자제"],
  boundary: ["과열권 접근", "탐욕 확대 · 비중 점검"],
  adjustment: ["과열권 해소 진행", "투자심리 약화"],
  fear: ["공포 심리 확대", "변동성 상승 · 관망"],
  panic: ["극단적 위험회피", "패닉 매도 압력 · 기회 관찰"],
}

function toNum(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** @param {MarketPositionId} id */
function stageById(id) {
  return MARKET_POSITION_STAGES.find((s) => s.id === id) ?? MARKET_POSITION_STAGES[2]
}

/**
 * @param {number | null} cnn
 * @param {number | null} vix
 * @param {number | null} bofa
 * @returns {MarketPositionId}
 */
export function resolveMarketPositionId(cnn, vix, bofa) {
  const c = cnn ?? 50
  const v = vix ?? 20
  const b = bofa ?? 5

  if (v >= 35 || (v >= 30 && c < 28) || (c < 18 && v >= 24)) {
    return "panic"
  }
  if (v >= 26 || (c < 25 && v >= 22) || (c < 32 && v >= 23)) {
    return "fear"
  }
  if (c < 55 && v < 28 && !(c >= 52 && b >= 6.5)) {
    return "adjustment"
  }
  if (c >= 70 || (c >= 65 && v < 16) || (c >= 60 && b >= 7.5 && v < 18)) {
    return "overheat"
  }
  if (c >= 52 || (c >= 48 && b >= 6.5) || (c >= 55 && b >= 6)) {
    return "boundary"
  }
  return "adjustment"
}

/** @type {Record<MarketPositionId, number>} */
const STAGE_SCORE_ANCHOR = {
  overheat: 85,
  boundary: 68,
  adjustment: 52,
  fear: 34,
  panic: 16,
}

/**
 * 시장 상태 카드 표시용 0~100 점수 (높을수록 과열·낙관)
 * @param {number | null} cnn
 * @param {number | null} vix
 * @param {number | null} bofa
 * @param {MarketPositionId} stageId
 */
export function computeMarketPositionScore(cnn, vix, bofa, stageId) {
  const anchor = STAGE_SCORE_ANCHOR[stageId] ?? 50
  const c = cnn ?? 50
  const v = vix ?? 20
  const b = bofa ?? 5.5
  const nudge = (c - 50) * 0.12 + (20 - v) * 0.35 + (b - 5.5) * 1.2
  return Math.max(0, Math.min(100, Math.round(anchor + nudge)))
}

/**
 * @param {object | null | undefined} panicData
 */
export function resolveMarketPosition(panicData) {
  const cnn = toNum(panicData?.fearGreed)
  const vix = toNum(panicData?.vix)
  const bofa = toNum(panicData?.bofa)

  if (cnn == null && vix == null) return null

  const id = resolveMarketPositionId(cnn, vix, bofa)
  const stage = stageById(id)

  return {
    ...stage,
    id,
    cnn,
    vix,
    bofa,
    descriptions: MARKET_POSITION_DESCRIPTIONS[id] ?? [],
  }
}

/**
 * @param {MarketPositionId} currentId
 */
export function resolveMarketPositionNavigation(currentId) {
  const idx = MARKET_POSITION_STAGES.findIndex((s) => s.id === currentId)
  if (idx < 0) return { current: stageById("adjustment"), next: null, nextLine: null }

  const current = MARKET_POSITION_STAGES[idx]
  const next = idx < MARKET_POSITION_STAGES.length - 1 ? MARKET_POSITION_STAGES[idx + 1] : null

  return {
    current,
    next,
    nextLine: next ? `${next.emoji} ${next.label}` : "극단 공포 구간",
  }
}

/**
 * @param {object | null | undefined} panicData
 */
export function resolveMarketPositionView(panicData) {
  const position = resolveMarketPosition(panicData)
  if (!position) return null

  const score = computeMarketPositionScore(position.cnn, position.vix, position.bofa, position.id)
  const rail = MARKET_POSITION_STAGES.map((stage) => ({
    id: stage.id,
    emoji: stage.emoji,
    label: stage.label,
    color: stage.color,
    active: stage.id === position.id,
  }))

  return {
    position,
    score,
    rail,
    nav: resolveMarketPositionNavigation(position.id),
  }
}
