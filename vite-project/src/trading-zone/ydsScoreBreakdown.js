import {
  describeDynamicWeights,
  getDynamicWeights,
  getFinalScore,
  getMidScore,
  getShortScore,
  scoreBofa,
  scoreFearGreed,
  scoreHY,
  scorePutCall,
  scoreVIX,
} from "../utils/tradingScores.js"
import { canComputeYds, resolveYdsStage } from "./ydsHistoricalEventTypes.js"

/**
 * @param {import("./ydsHistoricalEventTypes.js").MilestoneIndicatorData | Record<string, unknown>} historyData
 */
export function historyDataToPanicPayload(historyData) {
  return {
    vix: historyData?.vix,
    fearGreed: historyData?.cnn,
    bofa: historyData?.bofa,
    putCall: historyData?.putCall,
    highYield: historyData?.highYield,
  }
}

/**
 * 기존 getFinalScore 엔진과 동일한 경로로 최종 점수·지표별 기여도 분해
 * @param {import("./ydsHistoricalEventTypes.js").MilestoneIndicatorData | Record<string, unknown>} historyData
 */
export function buildYdsScoreBreakdown(historyData) {
  if (!canComputeYds(historyData)) {
    return {
      computable: false,
      finalYds: null,
      stage: null,
      inputs: historyDataToPanicPayload(historyData),
      componentScores: null,
      contributions: null,
      shortScore: null,
      midScore: null,
      weights: null,
      weightNote: null,
      sumContributions: null,
      insights: ["핵심 5지표 중 미입력 값이 있어 YDS를 계산할 수 없습니다."],
    }
  }

  const payload = historyDataToPanicPayload(historyData)
  const componentScores = {
    vix: scoreVIX(payload.vix),
    cnn: scoreFearGreed(payload.fearGreed),
    bofa: scoreBofa(payload.bofa),
    highYield: scoreHY(payload.highYield),
    putCall: scorePutCall(payload.putCall),
  }

  const shortScore = getShortScore(payload.vix, payload.putCall)
  const midScore = getMidScore(payload.fearGreed, payload.bofa, payload.highYield)
  const weights = getDynamicWeights(payload.vix, payload.highYield)
  const finalYds = getFinalScore(payload)
  const stage = resolveYdsStage(finalYds)

  const contributions = {
    vix: componentScores.vix * 0.6 * weights.wShort,
    cnn: componentScores.cnn * 0.4 * weights.wMid,
    bofa: componentScores.bofa * 0.35 * weights.wMid,
    highYield: componentScores.highYield * 0.25 * weights.wMid,
    putCall: componentScores.putCall * 0.4 * weights.wShort,
  }

  const roundedContributions = {
    vix: Math.round(contributions.vix * 10) / 10,
    cnn: Math.round(contributions.cnn * 10) / 10,
    bofa: Math.round(contributions.bofa * 10) / 10,
    highYield: Math.round(contributions.highYield * 10) / 10,
    putCall: Math.round(contributions.putCall * 10) / 10,
  }

  const sumContributions =
    Math.round(
      (roundedContributions.vix +
        roundedContributions.cnn +
        roundedContributions.bofa +
        roundedContributions.highYield +
        roundedContributions.putCall) *
        10,
    ) / 10

  const insights = buildBreakdownInsights({
    payload,
    componentScores,
    shortScore,
    midScore,
    weights,
    finalYds,
    roundedContributions,
  })

  return {
    computable: true,
    finalYds,
    stage,
    inputs: payload,
    componentScores,
    contributions: roundedContributions,
    shortScore,
    midScore,
    weights,
    weightNote: describeDynamicWeights(payload.vix, payload.highYield),
    sumContributions,
    insights,
  }
}

function buildBreakdownInsights(ctx) {
  const { payload, componentScores, shortScore, midScore, weights, finalYds, roundedContributions } = ctx
  const lines = []

  lines.push(
    `단기 점수 ${shortScore} × ${Math.round(weights.wShort * 100)}% + 중기 점수 ${midScore} × ${Math.round(weights.wMid * 100)}% → 최종 YDS ${finalYds}`,
  )

  if (Number(payload.vix) > 40) {
    lines.push(`VIX ${payload.vix}는 scoreVIX 상한(40+)에 도달해 단기 VIX 성분이 100으로 캡됩니다.`)
  }

  if (Number(payload.highYield) > 6) {
    lines.push(
      `HY ${payload.highYield}% > 6 조건으로 중기 가중 ${Math.round(weights.wMid * 100)}%가 적용되어, VIX 극단값이 최종 점수에 반영되는 비중이 줄어듭니다.`,
    )
  } else if (Number(payload.vix) > 25) {
    lines.push(`VIX ${payload.vix} > 25 조건으로 단기 가중 ${Math.round(weights.wShort * 100)}%가 적용됩니다.`)
  }

  const top = Object.entries(roundedContributions).sort((a, b) => b[1] - a[1])[0]
  if (top) {
    const label = { vix: "VIX", cnn: "CNN", bofa: "BofA", highYield: "HY", putCall: "Put/Call" }[top[0]]
    lines.push(`최종 YDS에 가장 크게 기여한 지표: ${label} (+${top[1]}점)`)
  }

  if (componentScores.cnn < 90 && Number(payload.fearGreed) > 15) {
    lines.push(`CNN ${payload.fearGreed}은 극단 공포(0~10)가 아니어서 중기 점수가 상대적으로 완화됩니다.`)
  }

  if (finalYds < 80 && componentScores.vix >= 99) {
    lines.push("VIX는 극단 공포 수준이나, 중기 지표·동적 가중 때문에 패닉매수(80+) 구간에 도달하지 못했습니다.")
  }

  return lines
}

const CONTRIB_LABELS = {
  vix: "VIX",
  cnn: "CNN",
  bofa: "BofA",
  highYield: "HY",
  putCall: "P/C",
}

/**
 * 전일 대비 지표별 기여도 변화 (getFinalScore 경로 동일)
 * @param {Record<string, unknown>} currentData
 * @param {Record<string, unknown>} previousData
 */
export function buildYdsScoreDeltaBreakdown(currentData, previousData) {
  const today = buildYdsScoreBreakdown({
    vix: currentData?.vix,
    cnn: currentData?.fearGreed ?? currentData?.cnn,
    bofa: currentData?.bofa,
    putCall: currentData?.putCall,
    highYield: currentData?.highYield,
  })
  const prev = buildYdsScoreBreakdown({
    vix: previousData?.vix,
    cnn: previousData?.fearGreed ?? previousData?.cnn,
    bofa: previousData?.bofa,
    putCall: previousData?.putCall,
    highYield: previousData?.highYield,
  })

  if (!today.computable || !prev.computable) {
    return {
      computable: false,
      today,
      prev,
      finalDelta: null,
      contributionDeltas: null,
      drivers: [],
    }
  }

  /** @type {Record<string, number>} */
  const contributionDeltas = {}
  for (const key of Object.keys(CONTRIB_LABELS)) {
    contributionDeltas[key] =
      Math.round(((today.contributions?.[key] ?? 0) - (prev.contributions?.[key] ?? 0)) * 10) / 10
  }

  const finalDelta = today.finalYds - prev.finalYds
  const drivers = Object.entries(contributionDeltas)
    .filter(([, d]) => Math.abs(d) >= 0.1)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .map(([key, delta]) => ({
      key,
      label: CONTRIB_LABELS[key],
      delta,
      todayContribution: today.contributions[key],
      prevContribution: prev.contributions[key],
    }))

  return {
    computable: true,
    today,
    prev,
    finalDelta,
    contributionDeltas,
    drivers,
  }
}

/**
 * panicData + historyRows → 검증용 요약
 * @param {object | null} panicData
 * @param {object[]} historyRows
 */
export function buildYdsScoreVerification(panicData, historyRows = []) {
  if (!panicData) return null

  const payload = historyDataToPanicPayload({
    vix: panicData.vix,
    cnn: panicData.fearGreed,
    bofa: panicData.bofa,
    putCall: panicData.putCall,
    highYield: panicData.highYield,
  })

  const today = buildYdsScoreBreakdown({
    vix: payload.vix,
    cnn: payload.fearGreed,
    bofa: payload.bofa,
    putCall: payload.putCall,
    highYield: payload.highYield,
  })

  const rows = Array.isArray(historyRows) ? historyRows : []
  const prevRow = rows.length >= 2 ? rows[rows.length - 2] : null
  const prevPanic = prevRow?.panicData ?? prevRow ?? null
  const delta =
    prevPanic != null
      ? buildYdsScoreDeltaBreakdown(panicData, prevPanic)
      : { computable: false, today, prev: null, finalDelta: null, contributionDeltas: null, drivers: [] }

  const stage = resolveYdsStage(today.finalYds ?? 0)
  const interestThreshold = 40
  const nearInterest = today.finalYds != null && today.finalYds >= 36 && today.finalYds < interestThreshold

  return {
    today,
    delta,
    stage,
    interestThreshold,
    nearInterest,
    moveNote: "MOVE·SKEW·VXN·GS는 YDS 총점(getFinalScore) 산출에 미포함 · Panic V2 보조 지표",
  }
}

/**
 * @param {import("./ydsHistoricalEventTypes.js").EventDetailData} event
 * @param {import("./ydsHistoricalEventTypes.js").ReplayMilestoneKey} milestoneKey
 */
export function buildMilestoneBreakdown(event, milestoneKey) {
  const milestone = event?.milestones?.[milestoneKey]
  const breakdown = buildYdsScoreBreakdown(milestone?.historyData ?? {})
  return {
    eventId: event?.id,
    eventName: event?.name,
    milestoneKey,
    date: milestone?.date ?? null,
    ...breakdown,
  }
}

/**
 * @param {import("./ydsHistoricalEventTypes.js").EventDetailData} event
 */
export function buildEventMilestoneBreakdowns(event) {
  return ["start", "rise", "fearExpansion", "climax", "recovery"].map((key) =>
    buildMilestoneBreakdown(event, key),
  )
}
