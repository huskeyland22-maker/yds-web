import { resolveYdsStage, formatMetric } from "./ydsHistoricalEventTypes.js"
import { resolvePriTier, buildPrecursorEnginePhase2Event } from "./ydsPrecursorEnginePhase2.js"
import { buildPrecursorDashboardBetaReport } from "./ydsPrecursorEnginePhase12.js"
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

/** Precursor 국면 → 보조 표시 (시장 환경) */
const REGIME_CONDITION_SHORT = {
  stable: { label: "안정", emoji: "🟢" },
  transition: { label: "전환", emoji: "🟡" },
  risk: { label: "경계", emoji: "🟠" },
  panic: { label: "위기", emoji: "🔴" },
  unknown: { label: "—", emoji: "⚪" },
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
  const regimeShort =
    REGIME_CONDITION_SHORT[regimeId] ?? REGIME_CONDITION_SHORT.unknown

  const marketEnvironment = {
    title: "시장 환경",
    kicker: "보조 정보 · Market Condition",
    marketCondition: {
      regimeId,
      emoji: regimeShort.emoji,
      label: regimeShort.label,
      fullLabel: dashboard.cards.regime.label,
    },
    ydsScore: ydsScore,
    ydsDisplay: dashboard.cards.yds.display,
    confidenceScore: confidence.confidence.score,
    confidenceLabel: confidence.confidence.label?.label ?? "—",
    similarSummary: buildSimilarCasesSummary(similarCases),
    positionHint: positionMapping
      ? `${positionMapping.eventEmoji} ${positionMapping.eventLabel} ${positionMapping.offsetLabel} · 유사 ${formatMetric(positionMapping.similarity)}%`
      : null,
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
