/**
 * 시장 건강도 — 컨디션 종합 체크 (시장 위치·패닉 강도와 역할 분리)
 */

import { buildMarketStatePriceStructureReport } from "./ydsMarketStatePriceStructure.js"
import { computeMarketPositionScore, resolveMarketPositionId } from "./ydsMarketPositionEngine.js"
import { sortHistoryRowsAsc } from "../utils/panicHistoryDesk.js"
import { toNum } from "./ydsLayerHistory.js"

/** @typedef {'good' | 'neutral' | 'risk'} MarketHealthGradeId */

/**
 * @typedef {{
 *   id: string
 *   label: string
 *   gradeId: MarketHealthGradeId
 *   gradeEmoji: string
 *   gradeLabel: string
 * }} MarketHealthItem
 */

/**
 * @typedef {{
 *   visible: boolean
 *   title: string
 *   subtitle: string
 *   items: MarketHealthItem[]
 *   summary: string
 * }} MarketHealthReport
 */

/** @type {Record<MarketHealthGradeId, { emoji: string; label: string }>} */
const GRADE_DISPLAY = {
  good: { emoji: "🟢", label: "양호" },
  neutral: { emoji: "🟡", label: "보통" },
  risk: { emoji: "🔴", label: "위험" },
}

/** @type {Record<MarketHealthGradeId, { emoji: string; label: string }>} */
const POLICY_GRADE_DISPLAY = {
  good: { emoji: "🟢", label: "우호" },
  neutral: { emoji: "🟡", label: "중립" },
  risk: { emoji: "🔴", label: "부담" },
}

/** @param {MarketHealthGradeId} gradeId @param {boolean} [policy] */
function displayForGrade(gradeId, policy = false) {
  const table = policy ? POLICY_GRADE_DISPLAY : GRADE_DISPLAY
  return table[gradeId] ?? GRADE_DISPLAY.neutral
}

/** @param {MarketHealthGradeId} gradeId @param {string} label @param {string} id @param {boolean} [policy] */
function healthItem(id, label, gradeId, policy = false) {
  const display = displayForGrade(gradeId, policy)
  return {
    id,
    label,
    gradeId,
    gradeEmoji: display.emoji,
    gradeLabel: display.label,
  }
}

/** @param {number | null} vix */
function gradeVolatility(vix) {
  if (vix == null) return /** @type {MarketHealthGradeId} */ ("neutral")
  if (vix < 18) return "good"
  if (vix <= 25) return "neutral"
  return "risk"
}

/** @param {import("./ydsMarketStatePriceStructure.js").MarketStatePriceStructureReport | null} price */
function gradeTrend(price) {
  if (price?.structureScore != null) {
    const s = price.structureScore
    if (s >= 62) return /** @type {MarketHealthGradeId} */ ("good")
    if (s >= 42) return "neutral"
    return "risk"
  }
  return "neutral"
}

/** @param {import("./ydsMarketStatePriceStructure.js").MarketStatePriceStructureReport | null} price @param {object[]} historyRows */
function gradeMomentum(price, historyRows) {
  const r5 = price?.return5d
  const r10 = price?.return10d
  if (r5 != null || r10 != null) {
    const blend = (r5 ?? 0) * 0.6 + (r10 ?? 0) * 0.4
    if (blend >= 1.2) return /** @type {MarketHealthGradeId} */ ("good")
    if (blend >= -2.5) return "neutral"
    return "risk"
  }

  const delta = resolveHistoryScoreDelta(historyRows, 3)
  if (delta == null) return "neutral"
  if (delta >= 3) return "good"
  if (delta >= -4) return "neutral"
  return "risk"
}

/** @param {number | null} cnn @param {number | null} bofa @param {number | null} putCall */
function gradeSentimentBreadth(cnn, bofa, putCall) {
  let score = 0
  let count = 0

  if (cnn != null) {
    count += 1
    if (cnn >= 42 && cnn <= 68) score += 1
    else if (cnn >= 32 && cnn <= 78) score += 0.4
  }
  if (bofa != null) {
    count += 1
    if (bofa >= 5 && bofa <= 7.2) score += 1
    else if (bofa >= 4.2 && bofa <= 8) score += 0.4
  }
  if (putCall != null) {
    count += 1
    if (putCall >= 0.82 && putCall <= 1.08) score += 1
    else if (putCall >= 0.7 && putCall <= 1.2) score += 0.4
  }

  if (count === 0) return /** @type {MarketHealthGradeId} */ ("neutral")
  const ratio = score / count
  if (ratio >= 0.75) return "good"
  if (ratio >= 0.35) return "neutral"
  return "risk"
}

/** @param {import("../market-os/liquidityDualEngine.js").DualLiquidityReport | null} dualLiquidity @param {number | null} hy */
function gradeLiquidity(dualLiquidity, hy) {
  const bandId = dualLiquidity?.market?.band?.id
  if (bandId === "very_favorable" || bandId === "favorable") return /** @type {MarketHealthGradeId} */ ("good")
  if (bandId === "alert" || bandId === "danger") return "risk"
  if (bandId === "neutral") return "neutral"

  if (hy != null) {
    if (hy <= 4.2) return "good"
    if (hy <= 5.5) return "neutral"
    return "risk"
  }
  return "neutral"
}

/** @param {number | null} putCall @param {import("./ydsMarketStatePriceStructure.js").MarketStatePriceStructureReport | null} price */
function gradeVolumeActivity(putCall, price) {
  if (price?.volumeIncrease === true) return /** @type {MarketHealthGradeId} */ ("good")
  if (price?.volumeIncrease === false) return "neutral"

  if (putCall != null) {
    if (putCall >= 0.88 && putCall <= 1.05) return "good"
    if (putCall >= 0.72 && putCall <= 1.18) return "neutral"
    return "risk"
  }
  return "neutral"
}

/** @param {number | null} bofa @param {number | null} cnn */
function gradeMarketBreadth(bofa, cnn) {
  if (bofa != null) {
    if (bofa >= 6.2) return /** @type {MarketHealthGradeId} */ ("good")
    if (bofa >= 4.8) return "neutral"
    return "risk"
  }
  if (cnn != null) {
    if (cnn >= 50 && cnn <= 72) return "good"
    if (cnn >= 38 && cnn <= 82) return "neutral"
    return "risk"
  }
  return "neutral"
}

/** @param {import("../market-os/liquidityDualEngine.js").DualLiquidityReport | null} dualLiquidity */
function gradePolicy(dualLiquidity) {
  const bandId = dualLiquidity?.policy?.band?.id
  if (bandId === "very_favorable" || bandId === "favorable") return /** @type {MarketHealthGradeId} */ ("good")
  if (bandId === "alert" || bandId === "danger") return "risk"
  if (bandId === "neutral") return "neutral"

  const score = dualLiquidity?.policyScore
  if (score != null) {
    if (score >= 62) return "good"
    if (score >= 42) return "neutral"
    return "risk"
  }
  return "neutral"
}

/** @param {object[]} historyRows @param {number} lookbackDays */
function resolveHistoryScoreDelta(historyRows, lookbackDays) {
  const sorted = sortHistoryRowsAsc(historyRows).filter((r) => r?.date)
  if (sorted.length < lookbackDays + 1) return null

  const scoreAt = (row) => {
    const cnn = toNum(row.fearGreed)
    const vix = toNum(row.vix)
    const bofa = toNum(row.bofa)
    if (cnn == null && vix == null) return null
    const id = resolveMarketPositionId(cnn, vix, bofa)
    return computeMarketPositionScore(cnn, vix, bofa, id)
  }

  const last = scoreAt(sorted[sorted.length - 1])
  const prev = scoreAt(sorted[sorted.length - 1 - lookbackDays])
  if (last == null || prev == null) return null
  return last - prev
}

/** @param {MarketHealthItem[]} items @param {string | null} cycleLabel */
function buildHealthSummary(items, cycleLabel) {
  const good = items.filter((i) => i.gradeId === "good").length
  const risk = items.filter((i) => i.gradeId === "risk").length
  const weak = items.filter((i) => i.gradeId === "risk").map((i) => i.label)
  const cycleHint = cycleLabel ? String(cycleLabel).trim() : ""

  if (good >= 6 && risk === 0) {
    return cycleHint
      ? `시장 건강도는 전반적으로 양호하며, 현재는 추세가 유지되는 ${cycleHint} 국면으로 판단됩니다.`
      : "시장 건강도는 전반적으로 양호하며, 주요 컨디션 지표가 안정적으로 유지되고 있습니다."
  }

  if (risk >= 3) {
    const focus = weak.slice(0, 2).join("·") || "핵심 지표"
    return `시장 건강도에 부담 요인이 누적되고 있습니다. ${focus} 점검 후 보수적 대응이 필요합니다.`
  }

  if (risk >= 1) {
    const focus = weak[0] ?? "일부 지표"
    return `시장 건강도는 대체로 양호하나 ${focus} 에 주의가 필요합니다. 선별적 접근을 유지하세요.`
  }

  if (good >= 5) {
    return cycleHint
      ? `시장 건강도는 양호한 편이며, ${cycleHint} 흐름 속에서 컨디션이 유지되고 있습니다.`
      : "시장 건강도는 양호한 편이며, 단기 변동성만 점검하며 대응하면 됩니다."
  }

  return "시장 건강도는 중립권입니다. 추세·유동성·변동성을 함께 보며 분할 대응을 검토하세요."
}

/**
 * @param {{
 *   panicData?: object | null
 *   historyRows?: object[]
 *   dualLiquidity?: import("../market-os/liquidityDualEngine.js").DualLiquidityReport | null
 *   cycleFlow?: import("./ydsMarketCycleFlow.js").MarketCycleFlowReport | null
 *   etfContext?: { qqqPrices?: Record<string, number>; spyPrices?: Record<string, number>; asOfDate?: string | null } | null
 * }} input
 * @returns {MarketHealthReport}
 */
export function buildMarketHealthReport({
  panicData = null,
  historyRows = [],
  dualLiquidity = null,
  cycleFlow = null,
  etfContext = null,
} = {}) {
  const vix = toNum(panicData?.vix)
  const cnn = toNum(panicData?.fearGreed)
  const bofa = toNum(panicData?.bofa)
  const putCall = toNum(panicData?.putCall)
  const hy = toNum(panicData?.highYield ?? panicData?.hyOas)

  const price = buildMarketStatePriceStructureReport({
    qqqPrices: etfContext?.qqqPrices,
    spyPrices: etfContext?.spyPrices,
    asOfDate: etfContext?.asOfDate ?? null,
  })

  const hasSignal =
    vix != null ||
    cnn != null ||
    bofa != null ||
    putCall != null ||
    hy != null ||
    price != null ||
    dualLiquidity?.visible

  if (!hasSignal) {
    return {
      visible: false,
      title: "시장 건강도",
      subtitle: "Market Health",
      items: [],
      summary: "",
    }
  }

  /** @type {MarketHealthItem[]} */
  const items = [
    healthItem("trend", "추세", gradeTrend(price)),
    healthItem("momentum", "모멘텀", gradeMomentum(price, historyRows)),
    healthItem("volatility", "변동성", gradeVolatility(vix)),
    healthItem("sentiment", "투자심리", gradeSentimentBreadth(cnn, bofa, putCall)),
    healthItem("liquidity", "유동성", gradeLiquidity(dualLiquidity, hy)),
    healthItem("volume", "거래량", gradeVolumeActivity(putCall, price)),
    healthItem("breadth", "시장폭", gradeMarketBreadth(bofa, cnn)),
    healthItem("policy", "정책환경", gradePolicy(dualLiquidity), true),
  ]

  const cycleLabel = cycleFlow?.currentCycleLabel ?? null

  return {
    visible: true,
    title: "시장 건강도",
    subtitle: "Market Health",
    items,
    summary: buildHealthSummary(items, cycleLabel),
  }
}
