import { buildPrecursorEnginePhase6Report } from "./ydsPrecursorEnginePhase6.js"
import { buildPrecursorEnginePhase7Report } from "./ydsPrecursorEnginePhase7.js"
import { buildPrecursorEnginePhase10Report } from "./ydsPrecursorEnginePhase10.js"
import { buildPrecursorEnginePhase15Report } from "./ydsPrecursorEnginePhase15.js"
import { formatRiskPatternDisplayLine, getPrecursorMetricDisplay, getRiskPatternDisplay } from "./ydsPrecursorMetricDisplay.js"
import { formatMetric } from "./ydsHistoricalEventTypes.js"

export const PRECURSOR_ENGINE_PHASE16_LABEL =
  "YDS Precursor Engine — Phase 16 (신뢰도 · 시장 해석)"

const REGIME_ORDER = { stable: 0, transition: 1, risk: 2, panic: 3, unknown: 1 }

const COMPONENT_WEIGHTS = {
  separation: 0.2,
  margin: 0.25,
  regime: 0.2,
  pri: 0.2,
  replay: 0.15,
}

/**
 * @param {number} score
 */
export function resolveConfidenceLabel(score) {
  const s = Math.max(0, Math.min(100, Math.round(score)))
  if (s >= 90) {
    return { id: "very_high", label: "매우 높음", min: 90, score: s, tone: "high" }
  }
  if (s >= 75) {
    return { id: "high", label: "높음", min: 75, score: s, tone: "good" }
  }
  if (s >= 60) {
    return { id: "medium", label: "보통", min: 60, score: s, tone: "mid" }
  }
  return { id: "caution", label: "주의", min: 0, score: s, tone: "low" }
}

/**
 * @param {ReturnType<typeof buildPrecursorEnginePhase6Report>["top3"]} top3
 * @param {number | null} validationSeparation
 */
function scorePatternSeparation(top3, validationSeparation) {
  const top = top3[0]
  const second = top3[1]
  const third = top3[2]
  if (!top) return validationSeparation ?? 50

  const margin = Math.max(0, top.similarity - (second?.similarity ?? 0))
  const spread = Math.max(0, top.similarity - (third?.similarity ?? 0))
  const strength = top.similarity >= 55 ? 15 : top.similarity >= 40 ? 8 : 0
  const live = Math.min(100, margin * 2.2 + spread * 0.4 + strength)
  const bench = validationSeparation ?? 55
  return Math.round(live * 0.6 + bench * 0.4)
}

/**
 * @param {ReturnType<typeof buildPrecursorEnginePhase6Report>["top3"]} top3
 */
function scoreTopMargin(top3) {
  const top = top3[0]
  const second = top3[1]
  if (!top) return 40
  const margin = Math.max(0, top.similarity - (second?.similarity ?? 0))
  if (margin >= 25) return 95
  if (margin >= 15) return 82
  if (margin >= 8) return 68
  if (margin >= 4) return 52
  return Math.max(25, Math.round(margin * 8))
}

/**
 * @param {string} regimeId
 * @param {number | null} ydsScore
 * @param {number | null} priA
 * @param {number | null} priB
 * @param {string | null} patternId
 */
function inferExpectedRegimeOrder(regimeId, ydsScore, priA, priB, patternId) {
  let order = 0
  const yds = ydsScore ?? 0
  const a = priA ?? 0
  const b = priB ?? 0
  if (yds >= 75 || b >= 55) order = 3
  else if (yds >= 55 || a >= 60 || b >= 40) order = 2
  else if (yds >= 40 || a >= 45 || (patternId && patternId !== "bull" && a >= 35)) order = 1
  if (regimeId === "unknown") return order
  return order
}

/**
 * @param {string} regimeId
 * @param {number | null} ydsScore
 * @param {number | null} priA
 * @param {number | null} priB
 * @param {string | null} patternId
 */
function scoreRegimeAlignment(regimeId, ydsScore, priA, priB, patternId) {
  const actual = REGIME_ORDER[regimeId] ?? 1
  const expected = inferExpectedRegimeOrder(regimeId, ydsScore, priA, priB, patternId)
  const diff = Math.abs(actual - expected)
  return Math.max(35, 100 - diff * 22)
}

/**
 * @param {number | null} priA
 * @param {number | null} priB
 */
function scorePriAlignment(priA, priB) {
  const a = priA ?? 0
  const b = priB ?? 0
  const tierA = a >= 70 ? 3 : a >= 50 ? 2 : a >= 30 ? 1 : 0
  const tierB = b >= 55 ? 3 : b >= 40 ? 2 : b >= 25 ? 1 : 0
  const gap = Math.abs(tierA - tierB)
  if (a >= 45 && b < 30) return 78
  if (a < 30 && b >= 45) return 55
  return Math.max(40, 100 - gap * 18)
}

/**
 * @param {{ passed: number; total: number; allPassed: boolean }} replaySummary
 */
function scoreReplayValidation(replaySummary) {
  if (!replaySummary.total) return 50
  const ratio = replaySummary.passed / replaySummary.total
  const base = Math.round(ratio * 100)
  return replaySummary.allPassed ? Math.min(100, base + 5) : base
}

/**
 * @param {object} input
 */
export function buildMarketNarrative(input) {
  const {
    regimeLabel,
    regimeId,
    patternLine,
    priA,
    priB,
    priADelta30,
    actionLabel,
    allocationLine,
  } = input

  const lines = []
  lines.push(
    `현재 시장은 ${regimeLabel}에 진입했으며,`,
    `${patternLine}이(가) 우세합니다.`,
  )

  const a = priA ?? 0
  const b = priB ?? 0
  if (a >= 45 && b < 35) {
    const deltaNote =
      priADelta30 != null && priADelta30 > 0 ? " 상승 중이지만" : " 높은 편이지만"
    lines.push(`조기경보가${deltaNote}`)
    lines.push("충격감지는 아직 낮은 수준입니다.")
  } else if (a >= 45 && b >= 40) {
    lines.push("조기경보와 충격감지가 동시에 높아지고 있습니다.")
  } else if (b >= 45) {
    lines.push("충격감지가 뚜렷하며 단기 변동성에 유의가 필요합니다.")
  } else if (a >= 30) {
    lines.push("조기경보가 서서히 올라가는 구간입니다.")
  } else {
    lines.push("선행·충격 지표 모두 상대적으로 억제된 상태입니다.")
  }

  if (regimeId === "stable" || regimeId === "transition") {
    lines.push(`${actionLabel}과 관심 종목 관리가 적절한 구간입니다.`)
  } else if (regimeId === "risk") {
    lines.push(`현금 비중 점검과 ${actionLabel}이 권장됩니다.`)
  } else {
    lines.push(`${allocationLine || actionLabel}에 집중할 단계입니다.`)
  }

  return lines.join("\n")
}

/**
 * @param {import("./ydsHistoricalEventTypes.js").EventDetailData[]} events
 * @param {{ latestSnapshot?: Record<string, unknown> | null; extraRows?: object[]; log?: import("./ydsPrecursorValidationLogStorage.js").PrecursorValidationLogEntry[] }} [options]
 */
export function buildPrecursorEnginePhase16Report(events, options = {}) {
  const phase6 = buildPrecursorEnginePhase6Report(events, options)
  const phase7 = buildPrecursorEnginePhase7Report(events)
  const phase10 = buildPrecursorEnginePhase10Report(events, options)
  const phase15 = buildPrecursorEnginePhase15Report(events, options)

  const top3 = phase6.top3
  const top = top3[0] ?? null
  const second = top3[1] ?? null
  const regime = phase10.live.regime
  const priA = phase6.inputs.priA
  const priB = phase6.inputs.priB
  const patternId = top?.patternId ?? null
  const patternDisplay = getRiskPatternDisplay(patternId, top?.patternLabel)
  const patternLine = formatRiskPatternDisplayLine(patternId, top?.patternLabel)

  const components = {
    separation: {
      key: "separation",
      label: "패턴 분리도",
      score: scorePatternSeparation(top3, phase7.separationScore),
      detail: `검증 분리도 ${phase7.separationScore ?? "—"} · Top1 ${top?.similarity ?? "—"}%`,
    },
    margin: {
      key: "margin",
      label: "Top1 vs Top2 Margin",
      score: scoreTopMargin(top3),
      detail:
        top && second
          ? `${formatMetric(top.similarity, 0)}% − ${formatMetric(second.similarity, 0)}% = ${formatMetric(top.similarity - second.similarity, 1)}%p`
          : "2위 패턴 없음",
    },
    regime: {
      key: "regime",
      label: "국면 일치도",
      score: scoreRegimeAlignment(
        regime.id,
        phase10.live.current?.ydsScore ?? null,
        priA,
        priB,
        patternId,
      ),
      detail: `${regime.emoji} ${regime.label}`,
    },
    pri: {
      key: "pri",
      label: "PRI 일치도",
      score: scorePriAlignment(priA, priB),
      detail: `${getPrecursorMetricDisplay("priA").label} ${formatMetric(priA, 0)} · ${getPrecursorMetricDisplay("priB").label} ${formatMetric(priB, 0)}`,
    },
    replay: {
      key: "replay",
      label: "Replay 검증",
      score: scoreReplayValidation(phase10.replaySummary),
      detail: `${phase10.replaySummary.passed}/${phase10.replaySummary.total} 시나리오 통과`,
    },
  }

  const confidenceScore = Math.round(
    components.separation.score * COMPONENT_WEIGHTS.separation +
      components.margin.score * COMPONENT_WEIGHTS.margin +
      components.regime.score * COMPONENT_WEIGHTS.regime +
      components.pri.score * COMPONENT_WEIGHTS.pri +
      components.replay.score * COMPONENT_WEIGHTS.replay,
  )

  const confidenceLabel = resolveConfidenceLabel(confidenceScore)

  const priADelta30 = phase10.live.deltas30?.priA ?? null
  const narrative = buildMarketNarrative({
    regimeLabel: regime.label,
    regimeId: regime.id,
    patternLine,
    priA,
    priB,
    priADelta30,
    actionLabel: phase15.currentAction.label,
    allocationLine: phase15.recommendedAction.allocation,
  })

  return {
    label: PRECURSOR_ENGINE_PHASE16_LABEL,
    asOf: phase6.inputs.asOf,
    confidence: {
      score: confidenceScore,
      label: confidenceLabel,
      components: Object.values(components),
    },
    narrative: {
      text: narrative,
      paragraphs: narrative.split("\n"),
    },
    context: {
      regime,
      pattern: patternDisplay,
      patternLine,
      action: phase15.currentAction,
      top3,
    },
    notes: [
      "Phase 0~15 읽기 전용 · 신뢰도 = 5요소 가중 합산",
      "패턴 분리도 = 라이브 Margin·Spread + Phase 7 검증 분리도",
      "시장 해석 = 국면·패턴·PRI·행동 가이드 자동 생성",
    ],
  }
}
