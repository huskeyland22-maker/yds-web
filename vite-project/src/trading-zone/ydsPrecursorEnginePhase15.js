import { buildPrecursorDashboardBetaReport } from "./ydsPrecursorEnginePhase12.js"
import { buildPrecursorLivePriCards, resolveCashAllocationGuide } from "./ydsPrecursorEnginePhase3.js"
import { resolveYdsStage } from "./ydsHistoricalEventTypes.js"
import { formatRiskPatternLabel, getPrecursorMetricDisplay } from "./ydsPrecursorMetricDisplay.js"
import { loadPrecursorValidationLog } from "./ydsPrecursorValidationLogStorage.js"
import { offsetPrecursorDay, parsePrecursorDay } from "./ydsPrecursorInterpolation.js"
import { formatMetric } from "./ydsHistoricalEventTypes.js"

export const PRECURSOR_ENGINE_PHASE15_LABEL =
  "YDS Precursor Engine — Phase 15 (행동 가이드)"

/** @typedef {typeof ACTION_GUIDE_STEPS[number]} ActionGuideStep */

export const ACTION_GUIDE_STEPS = [
  { order: 0, id: "cash_prep", label: "현금 준비", emoji: "💵" },
  { order: 1, id: "watch", label: "관망", emoji: "👀" },
  { order: 2, id: "track", label: "관심종목 추적", emoji: "📋" },
  { order: 3, id: "dca_prep", label: "분할매수 준비", emoji: "🟡" },
  { order: 4, id: "dca_active", label: "분할매수 진행", emoji: "🟠" },
  { order: 5, id: "panic_buy", label: "패닉매수", emoji: "🔴" },
  { order: 6, id: "historic", label: "역사적 기회", emoji: "🟥" },
]

const YDS_BASE_ACTION = {
  overheated: 0,
  neutral: 1,
  interest: 2,
  dca: 4,
  panicBuy: 5,
}

/**
 * @param {number} order
 */
function stepByOrder(order) {
  const clamped = Math.max(0, Math.min(ACTION_GUIDE_STEPS.length - 1, order))
  return ACTION_GUIDE_STEPS.find((s) => s.order === clamped) ?? ACTION_GUIDE_STEPS[1]
}

/**
 * @param {{
 *   ydsScore: number | null
 *   priA: number | null
 *   priB: number | null
 *   regimeId: string
 *   patternId?: string | null
 * }} input
 */
export function resolveActionGuideStep(input) {
  const stage = resolveYdsStage(input.ydsScore)
  let order = stage?.id ? (YDS_BASE_ACTION[stage.id] ?? 1) : 1

  if (input.regimeId === "transition") order = Math.max(order, 2)
  if (input.regimeId === "risk") order = Math.max(order, 3)
  if (input.regimeId === "panic") order = Math.max(order, 5)

  const priA = input.priA ?? 0
  const priB = input.priB ?? 0
  if (priA >= 30) order = Math.max(order, 2)
  if (priA >= 50) order = Math.max(order, 3)
  if (priA >= 70) order = Math.max(order, 4)
  if (priB >= 40) order = Math.max(order, order + 1)
  if (priB >= 55) order = Math.max(order, 5)

  const yds = input.ydsScore ?? 0
  if (yds >= 80) order = Math.max(order, 5)
  if (yds >= 100) order = 6

  if (input.patternId && input.patternId !== "bull" && priA >= 45) {
    order = Math.max(order, 3)
  }

  return stepByOrder(order)
}

/**
 * @param {import("./ydsHistoricalEventTypes.js").EventDetailData[]} events
 * @param {{ latestSnapshot?: Record<string, unknown> | null; extraRows?: object[]; log?: ReturnType<typeof loadPrecursorValidationLog> }} [options]
 */
export function buildPrecursorEnginePhase15Report(events, options = {}) {
  const dashboard = buildPrecursorDashboardBetaReport(events, options)
  const livePri = buildPrecursorLivePriCards(options.latestSnapshot ?? null, options.extraRows)
  const cashGuide = resolveCashAllocationGuide(dashboard.cards.priA.value)

  const ydsScore = dashboard.cards.yds.value
  const priA = dashboard.cards.priA.value
  const priB = dashboard.cards.priB.value
  const regime = dashboard.cards.regime
  const patternId = dashboard.cards.pattern.patternId
  const patternLabel = formatRiskPatternLabel(patternId, dashboard.cards.pattern.label)
  const ydsStage = resolveYdsStage(ydsScore)

  const currentAction = resolveActionGuideStep({
    ydsScore,
    priA,
    priB,
    regimeId: regime.regimeId,
    patternId,
  })

  const rationale = [
    {
      key: "yds",
      label: getPrecursorMetricDisplay("yds").label,
      line: ydsStage
        ? `${ydsStage.emoji} ${ydsStage.label} (점수 ${formatMetric(ydsScore, 0)})`
        : "—",
    },
    {
      key: "priA",
      label: getPrecursorMetricDisplay("priA").label,
      line: `점수 ${formatMetric(priA, 0)} · ${getPrecursorMetricDisplay("priA").hint}`,
    },
    {
      key: "regime",
      label: getPrecursorMetricDisplay("regime").label,
      line: `${regime.emoji} ${regime.label}`,
    },
    {
      key: "pattern",
      label: getPrecursorMetricDisplay("pattern").label,
      line: `${patternLabel} ${formatMetric(dashboard.cards.pattern.similarity, 0)}% 유사`,
    },
  ]

  const oneLiner = buildOneLineInterpretation(regime, patternLabel, dashboard.cards.pattern.similarity)

  const log = options.log ?? loadPrecursorValidationLog()
  const trend30 = buildActionTrend30(log, dashboard.asOf, {
    ydsScore,
    priA,
    priB,
    regimeId: regime.regimeId,
    patternId,
  })

  return {
    label: PRECURSOR_ENGINE_PHASE15_LABEL,
    asOf: dashboard.asOf,
    currentAction,
    recommendedAction: {
      label: currentAction.label,
      allocation: cashGuide.label,
      equityPct: cashGuide.equityPct,
      cashPct: cashGuide.cashPct,
      disclaimer: cashGuide.disclaimer,
    },
    rationale,
    oneLiner,
    trend30,
    inputs: { ydsScore, priA, priB, ydsStage, regime, patternLabel },
    notes: [
      "Phase 0~14 읽기 전용 · 행동 단계는 시장위치+국면+조기경보+충격감지 합성",
      "비중 가이드 = Phase 3 표시용 현금비중(조기경보 기준)",
      "30일 추세 = Validation Log 스냅샷 기반",
    ],
  }
}

/**
 * @param {object} regime
 * @param {string} patternLabel
 * @param {number | null} similarity
 */
function buildOneLineInterpretation(regime, patternLabel, similarity) {
  const simPart =
    similarity != null && Number.isFinite(similarity)
      ? `${patternLabel} 위험 패턴이 ${Math.round(similarity)}% 수준으로 `
      : `${patternLabel} 위험 패턴이 `
  if (regime.regimeId === "transition") {
    return `시장은 ${regime.label}에 진입했으며 ${simPart}확대되고 있습니다.`
  }
  if (regime.regimeId === "risk" || regime.regimeId === "panic") {
    return `시장은 ${regime.label} 단계이며 ${simPart}뚜렷합니다.`
  }
  return `시장은 ${regime.label}이며 ${simPart}제한적입니다.`
}

/**
 * @param {ReturnType<typeof loadPrecursorValidationLog>} log
 * @param {string | null} endDate
 * @param {object} currentInput
 */
function buildActionTrend30(log, endDate, currentInput) {
  const end = endDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10)
  const targetTs = parsePrecursorDay(offsetPrecursorDay(end, -30))
  let pastSnap = null
  for (const row of log) {
    if (parsePrecursorDay(row.date) <= targetTs) pastSnap = row
  }

  const currentStep = resolveActionGuideStep(currentInput)
  const pastStep = pastSnap
    ? resolveActionGuideStep({
        ydsScore: pastSnap.ydsScore,
        priA: pastSnap.priA,
        priB: pastSnap.priB,
        regimeId: pastSnap.regimeId,
        patternId: pastSnap.dominantPatternId,
      })
    : null

  if (!pastStep) {
    return {
      hasPast: false,
      pastDate: null,
      currentOrder: currentStep.order,
      pastOrder: null,
      direction: { id: "unknown", label: "비교 데이터 없음" },
    }
  }

  const delta = currentStep.order - pastStep.order
  const direction =
    delta > 0
      ? { id: "up", label: "행동 단계 상승 (공격적 대응 강화)" }
      : delta < 0
        ? { id: "down", label: "행동 단계 하락 (방어·관망 완화)" }
        : { id: "flat", label: "행동 단계 유지" }

  return {
    hasPast: true,
    pastDate: pastSnap.date,
    pastAction: pastStep.label,
    currentAction: currentStep.label,
    currentOrder: currentStep.order,
    pastOrder: pastStep.order,
    delta,
    direction,
  }
}
