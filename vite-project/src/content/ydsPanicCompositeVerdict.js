/**
 * 패닉 V2 — 심리(State) vs 최종 투자 해석(Action) 분리
 *
 * 패닉 점수: 시장 심리만 (예: 46 = 중립)
 * 최종 해석: 패닉 40% + 가격 구조 40% + 추세/모멘텀 20%
 */

import { getFinalScore } from "../utils/tradingScores.js"
import { buildMarketStatePriceStructureReport } from "./ydsMarketStatePriceStructure.js"
import { formatPanicIntensityStageDisplay } from "./ydsPanicIntensityInterpretation.js"

/** @typedef {'trueFear' | 'scaleInStart' | 'scaleInPrep' | 'recoveryEarly' | 'watch' | 'bottomSearch' | 'adjustmentProgress' | 'uptrendContinue' | 'laggingFear' | 'reduceExposure'} PanicActionVerdictId */

/**
 * @typedef {{
 *   id: PanicActionVerdictId
 *   label: string
 *   emoji: string
 *   buyStrength: string
 *   actionLine: string
 *   narrative: string[]
 *   tone: string
 * }} PanicActionVerdictDef
 */

/** @type {Record<PanicActionVerdictId, PanicActionVerdictDef>} */
export const PANIC_ACTION_VERDICTS = {
  trueFear: {
    id: "trueFear",
    label: "진짜 공포",
    emoji: "🔴",
    buyStrength: "★★★★★",
    actionLine: "적극 분할매수",
    narrative: ["심리·가격 모두 공포·저점 구간", "분할매수 우선순위가 높습니다"],
    tone: "strong-buy",
  },
  scaleInStart: {
    id: "scaleInStart",
    label: "분할매수 시작",
    emoji: "🟢",
    buyStrength: "★★★★☆",
    actionLine: "분할매수 시작",
    narrative: ["가격 지지 확인 · 반등 신호", "계획된 비중으로 분할 접근"],
    tone: "buy",
  },
  scaleInPrep: {
    id: "scaleInPrep",
    label: "분할매수 준비",
    emoji: "🟡",
    buyStrength: "★★★☆☆",
    actionLine: "분할매수 준비",
    narrative: ["공포 심리와 가격 지지가 겹치는 구간", "관심 종목 위주로 준비"],
    tone: "prepare",
  },
  recoveryEarly: {
    id: "recoveryEarly",
    label: "회복 초기",
    emoji: "🟢",
    buyStrength: "★★★★☆",
    actionLine: "분할매수",
    narrative: ["차트상 회복 국면 확인", "과열 전 분할 접근 검토"],
    tone: "buy",
  },
  watch: {
    id: "watch",
    label: "관찰 단계",
    emoji: "🟡",
    buyStrength: "★★☆☆☆",
    actionLine: "관찰 · 대기",
    narrative: ["방향 확인 전", "추격매수 없이 관찰"],
    tone: "watch",
  },
  bottomSearch: {
    id: "bottomSearch",
    label: "바닥 탐색",
    emoji: "🔵",
    buyStrength: "★★☆☆☆",
    actionLine: "바닥 확인 대기",
    narrative: ["하락 진행 중 · 바닥 미확인", "분할 속도를 늦추고 지지 확인"],
    tone: "wait",
  },
  adjustmentProgress: {
    id: "adjustmentProgress",
    label: "조정 진행",
    emoji: "🟠",
    buyStrength: "★★☆☆☆",
    actionLine: "조정 진행 중 · 바닥 확인 전",
    narrative: ["가격 구조 하락 · 추세 약화", "신규 추격매수 자제"],
    tone: "caution",
  },
  uptrendContinue: {
    id: "uptrendContinue",
    label: "상승 지속",
    emoji: "🟢",
    buyStrength: "★★★☆☆",
    actionLine: "상승 추세 유지",
    narrative: ["가격·추세 강세", "보유 비중 점검 · 선별적 접근"],
    tone: "hold",
  },
  laggingFear: {
    id: "laggingFear",
    label: "늦은 공포",
    emoji: "🟠",
    buyStrength: "★★☆☆☆",
    actionLine: "추격매수 금지",
    narrative: ["심리는 위축 · 가격은 이미 회복", "조정 대기가 유리"],
    tone: "caution",
  },
  reduceExposure: {
    id: "reduceExposure",
    label: "비중 축소",
    emoji: "🟡",
    buyStrength: "★☆☆☆☆",
    actionLine: "비중 축소",
    narrative: ["심리·가격 모두 매수 우선순위 낮음", "익절·현금 비중 점검"],
    tone: "reduce",
  },
}

/** @deprecated use PANIC_ACTION_VERDICTS */
export const PANIC_COMPOSITE_VERDICTS = PANIC_ACTION_VERDICTS

/**
 * 패닉 점수 → 공포 강도 단계 (GO #84)
 * @param {number | null} psychScore
 */
export function resolvePanicStateLabel(psychScore) {
  return formatPanicIntensityStageDisplay(psychScore) ?? "—"
}

/** @param {number | null} psychScore */
export function resolvePsychologyLabel(psychScore) {
  return resolvePanicStateLabel(psychScore)
}

/**
 * @param {import("./ydsMarketStatePriceStructure.js").MarketStatePriceStructureReport | null} price
 */
export function resolvePriceStructureLabel(price) {
  if (!price) return "데이터 없음"
  const s = price.structureScore ?? 50
  const r5 = price.return5d ?? 0
  const r10 = price.return10d ?? 0

  if (price.lowerHigh && price.lowerLow && r5 < 0) return "하락 진행"
  if (r5 < -2 && r10 < -3) return "하락 진행"
  if (price.higherHigh && price.higherLow && s >= 58) return "상승 지속"
  if (price.aboveMa20 && (price.ma20SlopePct ?? 0) > 0 && r5 >= 0) return "상승 지속"
  if (price.aboveMa20 === false && (price.ma20GapPct ?? 0) > -2 && (price.ma60SlopePct ?? 0) > 0) {
    return "지지 확인"
  }
  if (s <= 35 && r10 <= -3) return "바닥 탐색"
  if (s <= 42 && r5 <= 0) return "조정 진행"
  if (s >= 55 && r5 >= 1) return "회복 진행"
  return price.trendLabel ?? "횡보·전환"
}

/**
 * @param {import("./ydsMarketStatePriceStructure.js").MarketStatePriceStructureReport | null} price
 */
export function resolveTrendMomentumLabel(price) {
  if (!price) return "—"
  const r5 = price.return5d ?? 0
  const r10 = price.return10d ?? 0
  const ma20 = price.ma20SlopePct ?? 0

  if (r5 >= 2 && r10 >= 3 && ma20 > 0) return "강세"
  if (r5 >= 0.5 && r10 >= 0 && ma20 >= 0) return "반등 시작"
  if (r5 <= -2 && r10 <= -1) return "약화"
  if (r5 < 0 && ma20 < 0) return "하락"
  if (Math.abs(r5) <= 1 && Math.abs(r10) <= 2) return "횡보"
  return "혼조"
}

/** @param {number | null} v */
function clamp100(v) {
  if (v == null || !Number.isFinite(v)) return 50
  return Math.max(0, Math.min(100, Math.round(v)))
}

/**
 * @param {import("./ydsMarketStatePriceStructure.js").MarketStatePriceStructureReport | null} price
 */
function computeTrendMomentumScore(price) {
  if (!price) return 50
  let score = 50
  if (price.return5d != null) score += Math.max(-15, Math.min(15, price.return5d * 2.5))
  if (price.return10d != null) score += Math.max(-12, Math.min(12, price.return10d * 1.5))
  if (price.ma20SlopePct != null) score += Math.max(-10, Math.min(10, price.ma20SlopePct * 3))
  if (price.higherHigh) score += 5
  if (price.higherLow) score += 4
  if (price.lowerHigh) score -= 6
  if (price.lowerLow) score -= 6
  return clamp100(score)
}

/**
 * @param {number} psychScore
 * @param {import("./ydsMarketStatePriceStructure.js").MarketStatePriceStructureReport | null} price
 * @param {number} trendScore
 * @returns {PanicActionVerdictId}
 */
function resolveActionVerdictId(psychScore, price, trendScore) {
  const psych = psychScore ?? 50
  const struct = price?.structureScore ?? 50
  const r5 = price?.return5d ?? 0
  const r10 = price?.return10d ?? 0
  const trend = trendScore ?? 50

  const psychFear = psych >= 55
  const psychLow = psych <= 35
  const priceDeclining = struct <= 38 || (r5 < -1.5 && r10 < -2) || price?.lowerHigh === true
  const priceRecovering =
    r5 >= 1 &&
    r10 >= -1 &&
    (price?.aboveMa20 === true || (price?.ma20GapPct ?? -99) > -2) &&
    trend >= 52
  const recoveryConfirmed =
    priceRecovering &&
    (price?.higherLow === true || r10 >= 2) &&
    (price?.ma20SlopePct ?? 0) >= -0.1
  const priceRecovered = struct >= 62 || r10 >= 8 || (price?.ma20GapPct ?? 0) >= 3
  const strongUptrend = struct >= 65 && trend >= 62 && (price?.ma20SlopePct ?? 0) > 0
  const supportHold =
    price?.aboveMa60 === true ||
    ((price?.ma20GapPct ?? -99) > -2.5 && (price?.ma60SlopePct ?? 0) > 0)

  if (psychFear && struct <= 32 && r10 <= 2 && !priceRecovered) return "trueFear"
  if (psychFear && priceRecovered && !recoveryConfirmed) return "laggingFear"
  if (psychLow && struct >= 55) return "reduceExposure"
  if (strongUptrend && !psychFear) return "uptrendContinue"
  if (recoveryConfirmed && psychFear && supportHold) return "scaleInStart"
  if (recoveryConfirmed) return "recoveryEarly"
  if (psychFear && supportHold && r5 >= -1 && !priceDeclining) return "scaleInPrep"
  if (priceDeclining && !supportHold) {
    if (struct <= 30 && r10 <= -4) return "bottomSearch"
    return "adjustmentProgress"
  }
  if (priceDeclining) return "watch"
  if (psychFear && struct <= 45) return "scaleInPrep"
  if (trend >= 58 && struct >= 55) return "uptrendContinue"
  if (psych >= 45 && psych <= 60 && struct <= 45 && trend <= 45) return "adjustmentProgress"
  return "watch"
}

/**
 * @param {object | null | undefined} panicData
 * @param {{
 *   spyPrices?: Record<string, number>
 *   qqqPrices?: Record<string, number>
 *   asOfDate?: string | null
 * }} [priceContext]
 */
export function buildPanicCompositeVerdictReport(panicData, priceContext = {}) {
  if (!panicData) {
    return { visible: false, title: "최종 투자 해석" }
  }

  const psychScore = Math.round(getFinalScore(panicData) ?? NaN)
  if (!Number.isFinite(psychScore)) {
    return { visible: false, title: "최종 투자 해석" }
  }

  const priceReport = buildMarketStatePriceStructureReport({
    spyPrices: priceContext.spyPrices,
    qqqPrices: priceContext.qqqPrices,
    asOfDate: priceContext.asOfDate,
  })

  const trendScore = computeTrendMomentumScore(priceReport)
  const actionCompositeScore = clamp100(
    psychScore * 0.4 + (priceReport?.structureScore ?? 50) * 0.4 + trendScore * 0.2,
  )

  const verdictId = resolveActionVerdictId(psychScore, priceReport, trendScore)
  const verdict = PANIC_ACTION_VERDICTS[verdictId]

  const stateLabel = resolvePanicStateLabel(psychScore)
  const priceLabel = resolvePriceStructureLabel(priceReport)
  const trendLabel = resolveTrendMomentumLabel(priceReport)

  return {
    visible: true,
    title: "최종 투자 해석",
    stateTitle: "패닉 (심리)",
    psychScore,
    psychLabel: stateLabel,
    stateLabel,
    priceLabel,
    trendLabel,
    structureScore: priceReport?.structureScore ?? null,
    trendScore,
    actionCompositeScore,
    weights: { panic: 0.4, structure: 0.4, trend: 0.2 },
    verdictId,
    verdictLabel: verdict.label,
    verdictEmoji: verdict.emoji,
    buyStrength: verdict.buyStrength,
    actionLine: verdict.actionLine,
    narrative: verdict.narrative,
    tone: verdict.tone,
    priceMetrics: priceReport
      ? [
          { id: "r5", label: "5일 수익률", value: priceReport.return5d, display: fmtPct(priceReport.return5d) },
          { id: "r10", label: "10일 수익률", value: priceReport.return10d, display: fmtPct(priceReport.return10d) },
          { id: "ma20", label: "MA20 괴리", value: priceReport.ma20GapPct, display: fmtPct(priceReport.ma20GapPct) },
          { id: "ma60", label: "MA60 괴리", value: priceReport.ma60GapPct, display: fmtPct(priceReport.ma60GapPct) },
          {
            id: "swing",
            label: "스윙",
            value: null,
            display: priceReport.lowerHigh
              ? "Lower High"
              : priceReport.higherHigh
                ? "Higher High"
                : "—",
          },
        ]
      : [],
    hasPriceData: Boolean(priceReport),
  }
}

/** @param {number | null | undefined} v */
function fmtPct(v) {
  if (v == null || !Number.isFinite(v)) return "—"
  return `${v > 0 ? "+" : ""}${v.toFixed(1)}%`
}

/**
 * @param {object | null | undefined} panicData
 * @param {Parameters<typeof buildPanicCompositeVerdictReport>[1]} [priceContext]
 */
export function resolvePanicCompositeActionView(panicData, priceContext) {
  const report = buildPanicCompositeVerdictReport(panicData, priceContext)
  if (!report.visible) return null
  return {
    buyStrength: report.buyStrength,
    actionLine: report.actionLine,
    verdictId: report.verdictId,
    verdictLabel: report.verdictLabel,
    verdictEmoji: report.verdictEmoji,
    narrative: report.narrative,
    stateLabel: report.stateLabel,
    psychLabel: report.stateLabel,
    priceLabel: report.priceLabel,
    trendLabel: report.trendLabel,
  }
}

/** @typedef {PanicActionVerdictId} PanicCompositeVerdictId */
