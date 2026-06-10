/**
 * 시장 사이클 표시 전용 — CNN + BofA (getFinalScore·엔진 무관)
 * @see docs/YDS_UPPER_CYCLE_STUDY.md · docs/YDS_DUAL_CYCLE_FRAMEWORK.md
 */

/** @typedef {"normal"|"warning"|"cashPrep"|"partialCash"} MarketCycleStageId */

/**
 * @typedef {{
 *   id: MarketCycleStageId
 *   label: string
 *   short: string
 *   emoji: string
 *   color: string
 *   role: string
 *   mood: string
 *   harvestGuide: string
 *   tooltip: string
 *   cnnMin: number | null
 *   bofaMin: number | null
 * }} MarketCycleStage
 */

/** @type {MarketCycleStage[]} */
export const MARKET_CYCLE_STAGES = [
  {
    id: "normal",
    label: "보유 구간",
    short: "보유 구간",
    emoji: "🟡",
    color: "#22c55e",
    role: "보유 유지 · 추격 자제",
    mood: "균형",
    harvestGuide: "보유 유지 · 추격매수 자제",
    tooltip: "CNN·BofA 중립 — 성장 국면 · 추격 자제",
    cnnMin: null,
    bofaMin: null,
  },
  {
    id: "warning",
    label: "기회 대기",
    short: "기회 대기",
    emoji: "🟠",
    color: "#eab308",
    role: "좋은 기회를 기다리는 구간",
    mood: "탐욕 증가",
    harvestGuide: "비중 점검 · 추격 자제 · 수익 관리",
    tooltip: "CNN 55+ · BofA 6+ — 기회 대기 · 수익 관리",
    cnnMin: 55,
    bofaMin: 6,
  },
  {
    id: "cashPrep",
    label: "현금 준비",
    short: "현금 준비",
    emoji: "🔴",
    color: "#ef4444",
    role: "과열권 접근 · 신규 진입 축소",
    mood: "탐욕·과열",
    harvestGuide: "현금 비중 준비 · 추격매수 금지",
    tooltip: "CNN 60+ · BofA 6+ · 과열권 접근 · 신규 진입 축소 · 현금 비중 준비",
    cnnMin: 60,
    bofaMin: 6,
  },
  {
    id: "partialCash",
    label: "현금 확보",
    short: "현금 확보",
    emoji: "🔴",
    color: "#dc2626",
    role: "극단적 탐욕 · 적극적 현금 확보",
    mood: "극단 탐욕",
    harvestGuide: "적극적 현금 확보 · 비중 축소",
    tooltip: "CNN 80+ · BofA 8+ · 극단적 탐욕 · 적극적 현금 확보",
    cnnMin: 80,
    bofaMin: 8,
  },
]

/** 시장 사이클 레일 범례 (CNN·BofA) */
export const MARKET_CYCLE_RAIL_LABELS =
  "🟡 보유 구간 · 🟠 기회 대기 · 🔴 현금 준비 · 🔴 현금 확보"

/** @type {{ id: MarketCycleStageId; cnnMin: number; bofaMin: number }[]} */
const MARKET_CYCLE_THRESHOLDS = [
  { id: "partialCash", cnnMin: 80, bofaMin: 8 },
  { id: "cashPrep", cnnMin: 60, bofaMin: 6 },
  { id: "warning", cnnMin: 55, bofaMin: 6 },
]

function toNum(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** @param {MarketCycleStageId} id */
function stageById(id) {
  return MARKET_CYCLE_STAGES.find((s) => s.id === id) ?? MARKET_CYCLE_STAGES[0]
}

/**
 * @param {number | null | undefined} fearGreed CNN F&G
 * @param {number | null | undefined} bofa
 */
export function resolveMarketCycleStage(fearGreed, bofa) {
  const cnn = toNum(fearGreed)
  const b = toNum(bofa)
  if (cnn == null || b == null) return null

  for (const rule of MARKET_CYCLE_THRESHOLDS) {
    if (cnn >= rule.cnnMin && b >= rule.bofaMin) {
      return stageById(rule.id)
    }
  }
  return stageById("normal")
}

/**
 * @param {MarketCycleStageId} currentId
 */
export function resolveMarketCycleNavigation(currentId) {
  const current = stageById(currentId)
  const idx = MARKET_CYCLE_STAGES.findIndex((s) => s.id === current.id)
  const next = idx >= 0 && idx < MARKET_CYCLE_STAGES.length - 1 ? MARKET_CYCLE_STAGES[idx + 1] : null

  return {
    currentStage: current,
    nextStage: next,
    nextLine: next ? `${next.emoji} ${next.label}` : "최고 수확 단계 — 계획 유지",
  }
}

/**
 * @param {string | null | undefined} fearStageId
 * @param {MarketCycleStageId} marketStageId
 */
export function buildDualCycleInterpretation(fearStageId, marketStageId) {
  const market = stageById(marketStageId)
  const fear = fearStageId ?? "neutral"

  if (fear === "neutral" && (market.id === "warning" || market.id === "cashPrep")) {
    return "매수 기회는 아니지만 수익 관리가 필요한 구간"
  }
  if (fear === "neutral" && market.id === "partialCash") {
    return "매수는 관찰 · 적극적 현금 확보 우선"
  }
  if (fear === "neutral" && market.id === "normal") {
    return "공포·탐욕 모두 중립 — 관찰·리스트 정리"
  }
  if (fear === "overheated" && market.id !== "normal") {
    return "공포·탐욕 이중 경계 — 리스크 관리 최우선"
  }
  if ((fear === "interest" || fear === "dca") && market.id !== "normal") {
    return "매수 준비·실행과 수익 관리를 동시에 — 비중·현금 균형"
  }
  if (fear === "interest" || fear === "dca") {
    return "매수 사이클 진행 — 계획대로 준비·실행"
  }
  if (fear === "panicBuy") {
    return "극단 공포 보너스 — 계획 현금 투입"
  }
  if (market.id !== "normal") {
    return `${market.harvestGuide}`
  }
  return "시장 모니터링 · 추격매수 자제"
}

/** @param {string | null | undefined} fearStageId */
export function fearCycleMood(fearStageId) {
  const map = {
    overheated: "극단 탐욕(공포 최저)",
    neutral: "관망 유지",
    interest: "공포 증가 · 준비",
    dca: "공포 확대 · 실행",
    panicBuy: "극단 공포",
  }
  return map[fearStageId] ?? "—"
}

/**
 * @param {MarketCycleStageId} id
 */
export function marketCycleTooltip(id) {
  return stageById(id).tooltip
}
