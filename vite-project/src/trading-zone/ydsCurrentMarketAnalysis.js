import { resolveYdsStage, formatMetric } from "./ydsHistoricalEventTypes.js"
import { resolvePriTier, buildPrecursorEnginePhase2Event } from "./ydsPrecursorEnginePhase2.js"
import { buildPrecursorDashboardBetaReport } from "./ydsPrecursorEnginePhase12.js"
import { buildPrecursorEnginePhase6Report } from "./ydsPrecursorEnginePhase6.js"
import { buildPrecursorEnginePhase15Report } from "./ydsPrecursorEnginePhase15.js"
import { buildPrecursorEnginePhase16Report } from "./ydsPrecursorEnginePhase16.js"
import { buildPrecursorEnginePhase22Report } from "./ydsPrecursorEnginePhase22.js"
import {
  buildPhase3ValidationDataset,
  PRECURSOR_PHASE3_PANIC_IDS,
} from "./ydsPrecursorPhase3EventCatalog.js"
import { buildRadarPatternCentroids } from "./ydsPrecursorEnginePhase6.js"
import { buildTimeMachineEventReport } from "./ydsPrecursorEnginePhase20.js"
import { MACRO_V1_STATUS_BANDS } from "../panic-v2/panicMacroV1Status.js"
import { loadPrecursorValidationLog } from "./ydsPrecursorValidationLogStorage.js"
import { buildPortfolioRecommendation } from "./ydsPrecursorEnginePhase23.js"

export const CURRENT_MARKET_ANALYSIS_LABEL = "현재 시장 분석"

/** 사용자-facing YDS 단계 (행동 가이드 래더) */
export const YDS_STAGE_LADDER = MACRO_V1_STATUS_BANDS.map((s) => ({
  id: s.id,
  emoji: s.emoji,
  label: s.label.replace("구간", "").replace("분할매수", "분할매수"),
  shortLabel:
    s.id === "overheated"
      ? "과열"
      : s.id === "neutral"
        ? "중립"
        : s.id === "interest"
          ? "관심"
          : s.id === "dca"
            ? "분할매수"
            : "패닉매수",
  color: s.color,
}))

/** @type {Record<string, string>} */
const ACTION_STAGE_HERO_COPY = {
  overheated:
    "시장이 과열 구간입니다. 추격 매수보다 비중 축소·현금 확보와 관망이 우선입니다.",
  neutral:
    "현재는 패닉매수 단계가 아닌 관찰 및 선별 단계입니다.",
  interest:
    "공포 신호가 올라오는 관심 구간입니다. 매수보다 우량 종목 추적·현금 유지에 집중하세요.",
  dca:
    "분할매수에 적합한 구간입니다. 준비된 현금을 나눠 투입하며 낙폭 구간을 활용하세요.",
  panicBuy:
    "극단적 공포 구간입니다. 역사적 저점 매수를 검토할 수 있는 패닉매수 단계입니다.",
}

/** 사용자-facing 시장 환경 4단계 (행동 단계에 종속) */
export const MARKET_ENVIRONMENT_LEVELS = [
  {
    id: "stable",
    label: "안정",
    emoji: "🟢",
    description: "시장 리스크 낮음",
  },
  {
    id: "watch",
    label: "경계",
    emoji: "🟡",
    description: "일부 리스크 존재 · 모니터링 필요",
  },
  {
    id: "danger",
    label: "위험",
    emoji: "🟠",
    description: "리스크 확대 · 방어적 접근 필요",
  },
  {
    id: "crisis",
    label: "위기",
    emoji: "🔴",
    description: "패닉 가능성 증가 · 역사적 매수 기회 접근",
  },
]

/** @type {Record<string, number>} Precursor 내부 국면 → 신호 강도 (표시용, 엔진 미변경) */
const PRECURSOR_REGIME_SIGNAL = {
  stable: 0,
  transition: 1,
  risk: 2,
  panic: 3,
  unknown: 0,
}

/** @type {Record<string, number>} */
const RADAR_ALERT_SIGNAL = {
  normal: 0,
  caution: 1,
  danger: 2,
  critical: 3,
}

/**
 * 행동 단계별 시장 환경 기준선·상한 (위기는 패닉매수 직전 단계에서만 허용)
 * @type {Record<string, { baseline: number; cap: number }>}
 */
const ACTION_ENV_ANCHOR = {
  overheated: { baseline: 0, cap: 1 },
  neutral: { baseline: 1, cap: 1 },
  interest: { baseline: 1, cap: 2 },
  dca: { baseline: 2, cap: 3 },
  panicBuy: { baseline: 3, cap: 3 },
}

const MARKET_ENV_PHILOSOPHY =
  "시장 환경은 현재 시장의 위험 수준을 의미합니다. 행동 단계는 실제 투자 행동 기준입니다."

/**
 * @param {{ patternId?: string | null; similarity?: number | null } | null} topPattern
 */
function patternStressSignal(topPattern) {
  if (!topPattern?.patternId || topPattern.patternId === "bull") return 0
  const sim = topPattern.similarity ?? 0
  if (sim >= 70) return 2
  if (sim >= 40) return 1
  return 0
}

/**
 * @param {{
 *   actionStageId?: string | null
 *   precursorRegimeId?: string | null
 *   radarAlertId?: string | null
 *   topPattern?: { patternId?: string | null; similarity?: number | null } | null
 *   bullSimilarity?: number | null
 * }} input
 */
export function resolveMarketEnvironmentLevel(input) {
  const anchor = ACTION_ENV_ANCHOR[input.actionStageId ?? ""] ?? {
    baseline: 1,
    cap: 1,
  }

  let signal = Math.max(
    PRECURSOR_REGIME_SIGNAL[input.precursorRegimeId ?? "unknown"] ?? 0,
    RADAR_ALERT_SIGNAL[input.radarAlertId ?? "normal"] ?? 0,
    patternStressSignal(input.topPattern),
  )

  const bullSim = input.bullSimilarity
  if (bullSim != null && Number.isFinite(bullSim) && bullSim >= 70) {
    const bullCap =
      input.actionStageId === "panicBuy"
        ? 3
        : input.actionStageId === "dca"
          ? 2
          : 1
    signal = Math.min(signal, bullCap)
  }

  const index = Math.min(
    anchor.cap,
    Math.max(anchor.baseline, signal),
  )
  const level = MARKET_ENVIRONMENT_LEVELS[index] ?? MARKET_ENVIRONMENT_LEVELS[1]

  return {
    ...level,
    index,
    precursorRegimeId: input.precursorRegimeId ?? "unknown",
  }
}

/**
 * @param {ReturnType<typeof buildActionStageHero>} actionHero
 * @param {ReturnType<typeof resolveMarketEnvironmentLevel>} envLevel
 */
function buildMarketEnvironmentContrast(actionHero, envLevel) {
  const action = `${actionHero.emoji} ${actionHero.shortLabel}`
  const env = `${envLevel.emoji} ${envLevel.label}`
  if (envLevel.id === "crisis" && actionHero.id === "panicBuy") {
    return `시장 환경 : ${env} · 행동 단계 : ${action} → 패닉 가능성이 높아진 구간으로, 역사적 매수 기회를 검토할 수 있습니다.`
  }
  if (envLevel.id === "stable" && actionHero.id === "overheated") {
    return `시장 환경 : ${env} · 행동 단계 : ${action} → 리스크는 낮으나 시장 과열로 비중 축소·관망이 우선입니다.`
  }
  return `시장 환경 : ${env} · 행동 단계 : ${action} → 일부 위험 신호는 있으나 아직 공격적인 패닉매수 구간은 아님.`
}

/**
 * @param {ReturnType<typeof enrichSimilarCases>} similarCases
 */
function buildSimilarCasesSummary(similarCases) {
  if (!similarCases.length) return "유사 과거 사례 데이터 없음"
  const parts = similarCases.map((c) => `${c.name}(${formatMetric(c.similarity)}%)`)
  return `유사 사례 기준 ${parts.join(", ")} 패턴과 유사`
}

/**
 * @param {ReturnType<typeof resolveYdsStage>} stage
 * @param {typeof YDS_STAGE_LADDER[number] | undefined} ladderMeta
 * @param {string} [fallbackDescription]
 */
function buildActionStageHero(stage, ladderMeta, fallbackDescription = "") {
  if (!stage) {
    return {
      kicker: "현재 행동 단계",
      emoji: "⚪",
      label: "—",
      shortLabel: "—",
      color: "#64748b",
      description: "YDS 점수가 없어 행동 단계를 표시할 수 없습니다.",
    }
  }
  return {
    kicker: "현재 행동 단계",
    id: stage.id,
    emoji: stage.emoji,
    label: stage.label,
    shortLabel: ladderMeta?.shortLabel ?? stage.label,
    color: ladderMeta?.color ?? "#64748b",
    description: ACTION_STAGE_HERO_COPY[stage.id] ?? fallbackDescription,
  }
}

/** @type {Record<string, { label: string; emoji: string; tone: string }>} */
const RISK_FROM_RADAR = {
  normal: { label: "낮음", emoji: "🟢", tone: "low" },
  caution: { label: "주의", emoji: "🟡", tone: "mid" },
  danger: { label: "위험", emoji: "🟠", tone: "high" },
  critical: { label: "심각", emoji: "🔴", tone: "critical" },
}

/**
 * @param {import("./ydsHistoricalEventTypes.js").EventDetailData[]} events
 * @param {ReturnType<typeof buildPrecursorEnginePhase22Report>["topSimilarEvents"]} topSimilar
 * @param {ReturnType<typeof buildRadarPatternCentroids>} centroids
 */
function enrichSimilarCases(events, topSimilar, centroids) {
  const dataset = buildPhase3ValidationDataset(events)
  const byId = new Map(dataset.map((e) => [e.id, e]))

  return topSimilar.map((item) => {
    const event = byId.get(item.eventId)
    if (!event) {
      return {
        rank: item.rank,
        medal: item.medal,
        eventId: item.eventId,
        name: item.shortLabel,
        emoji: item.emoji,
        similarity: item.similarity,
        timelineLabel: item.mappedOffsetLabel,
        historicalStage: null,
        historicalStageLabel: "—",
      }
    }

    const tm = buildTimeMachineEventReport(event, centroids)
    const frame = tm.frames.find((f) => f.offsetDays === item.mappedOffset) ?? null
    const stage = frame?.ydsStage ?? resolveYdsStage(frame?.ydsScore ?? null)

    return {
      rank: item.rank,
      medal: item.medal,
      eventId: item.eventId,
      name: item.shortLabel,
      emoji: item.emoji,
      similarity: item.similarity,
      timelineLabel: item.mappedOffsetLabel,
      historicalStage: stage?.id ?? null,
      historicalStageLabel: stage ? `${stage.emoji} ${stage.label}` : "—",
      historicalYds: frame?.ydsScore ?? null,
    }
  })
}

/**
 * @param {import("./ydsHistoricalEventTypes.js").EventDetailData[]} events
 * @param {{ latestSnapshot?: Record<string, unknown> | null; extraRows?: object[] }} [options]
 */
export function buildCurrentMarketAnalysisReport(events, options = {}) {
  const engineOptions = {
    latestSnapshot: options.latestSnapshot ?? null,
    extraRows: options.extraRows ?? [],
    log: loadPrecursorValidationLog(),
  }

  const dashboard = buildPrecursorDashboardBetaReport(events, engineOptions)
  const phase6 = buildPrecursorEnginePhase6Report(events, engineOptions)
  const action = buildPrecursorEnginePhase15Report(events, engineOptions)
  const confidence = buildPrecursorEnginePhase16Report(events, engineOptions)
  const comparison = buildPrecursorEnginePhase22Report(events, {
    latestSnapshot: options.latestSnapshot ?? null,
  })

  const ydsScore = dashboard.cards.yds.value
  const stage = resolveYdsStage(ydsScore)
  const priATier = resolvePriTier(dashboard.cards.priA.value, "A")
  const priBTier = resolvePriTier(dashboard.cards.priB.value, "B")

  const radarAlert = dashboard.cards.interpretation.radarAlert
  const risk =
    RISK_FROM_RADAR[radarAlert?.id ?? "normal"] ?? RISK_FROM_RADAR.normal

  const dataset = buildPhase3ValidationDataset(events)
  const eventReports = dataset.map((e) =>
    buildPrecursorEnginePhase2Event(e, { panicIds: PRECURSOR_PHASE3_PANIC_IDS }),
  )
  const centroids = buildRadarPatternCentroids(eventReports)
  const similarCases = enrichSimilarCases(events, comparison.topSimilarEvents, centroids)

  const stageLadder = YDS_STAGE_LADDER.map((s) => ({
    ...s,
    active: stage?.id === s.id,
  }))

  const ladderMeta = stageLadder.find((s) => s.active)
  const actionStageHero = buildActionStageHero(stage, ladderMeta, action.oneLiner)

  const positionMapping = comparison.currentPosition
    ? {
        offsetLabel: comparison.currentPosition.offsetLabel,
        similarity: comparison.currentPosition.similarity,
        eventLabel: comparison.currentPosition.eventLabel,
        eventEmoji: comparison.currentPosition.eventEmoji,
      }
    : null

  const regimeId = dashboard.cards.regime.regimeId ?? "unknown"
  const topPattern = phase6.top3[0] ?? null
  const bullSimilarity =
    phase6.patternSimilarity.find((p) => p.patternId === "bull")?.similarity ?? null

  const envLevel = resolveMarketEnvironmentLevel({
    actionStageId: stage?.id ?? null,
    precursorRegimeId: regimeId,
    radarAlertId: radarAlert?.id ?? "normal",
    topPattern,
    bullSimilarity,
  })

  const marketEnvironment = {
    title: "시장 환경",
    kicker: "보조 정보 · Market Condition",
    philosophyNote: MARKET_ENV_PHILOSOPHY,
    contrastNote: buildMarketEnvironmentContrast(actionStageHero, envLevel),
    marketCondition: {
      levelId: envLevel.id,
      emoji: envLevel.emoji,
      label: envLevel.label,
      description: envLevel.description,
      fullLabel: `${envLevel.emoji} ${envLevel.label} — ${envLevel.description}`,
      precursorRegimeId: regimeId,
      precursorLabel: dashboard.cards.regime.label,
    },
    ydsScore: ydsScore,
    ydsDisplay: dashboard.cards.yds.display,
    confidenceScore: confidence.confidence.score,
    confidenceLabel: confidence.confidence.label?.label ?? "—",
    bullSimilarity:
      bullSimilarity != null ? Math.round(Number(bullSimilarity)) : null,
    dominantPattern: topPattern
      ? {
          label: topPattern.patternLabel,
          similarity: topPattern.similarity,
        }
      : null,
    similarSummary: buildSimilarCasesSummary(similarCases),
    positionHint: positionMapping
      ? `${positionMapping.eventEmoji} ${positionMapping.eventLabel} ${positionMapping.offsetLabel} · 유사 ${formatMetric(positionMapping.similarity)}%`
      : null,
    levels: MARKET_ENVIRONMENT_LEVELS,
  }

  return {
    label: CURRENT_MARKET_ANALYSIS_LABEL,
    asOf: dashboard.asOf,
    hasLive: comparison.meta.hasLive,
    actionStageHero,
    marketEnvironment,
    headline: {
      regime: dashboard.cards.regime,
      interpretation: dashboard.cards.interpretation.text,
      pattern: dashboard.cards.pattern,
    },
    currentState: {
      yds: {
        value: ydsScore,
        display: dashboard.cards.yds.display,
        stage: stage
          ? { id: stage.id, label: stage.label, emoji: stage.emoji }
          : null,
      },
      risk: {
        ...risk,
        priA: dashboard.cards.priA.value,
        priB: dashboard.cards.priB.value,
        priALabel: priATier.label,
        priBLabel: priBTier.label,
      },
      confidence: {
        score: confidence.confidence.score,
        label: confidence.confidence.label?.label ?? "—",
        tone: confidence.confidence.label?.tone ?? "mid",
      },
      regime: dashboard.cards.regime,
    },
    similarCases,
    positionMapping,
    actionGuide: {
      current: action.currentAction,
      recommended: action.recommendedAction,
      oneLiner: action.oneLiner,
      stageLadder,
      currentStageId: stage?.id ?? null,
    },
    portfolio: buildPortfolioRecommendation(ydsScore),
    expectedReturns: comparison.historicalOutcomes.map((h) => ({
      horizon: h.horizon,
      label: h.label,
      avgReturn: h.avgReturn,
      winRate: h.winRate,
      maxMdd: h.maxMdd,
    })),
    notes: [
      "Phase 12·15·16·22·23 읽기 전용 집약 · 검증 엔진 미수정",
      "유사 사례·기대 수익률은 역사적 패턴 추정(투자 조언 아님)",
    ],
  }
}

export function formatAnalysisPct(value) {
  if (value == null || !Number.isFinite(value)) return "—"
  const sign = value > 0 ? "+" : ""
  return `${sign}${formatMetric(value)}%`
}
