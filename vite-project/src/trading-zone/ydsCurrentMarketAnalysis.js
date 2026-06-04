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

  return {
    label: CURRENT_MARKET_ANALYSIS_LABEL,
    asOf: dashboard.asOf,
    hasLive: comparison.meta.hasLive,
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
    positionMapping: comparison.currentPosition
      ? {
          offsetLabel: comparison.currentPosition.offsetLabel,
          similarity: comparison.currentPosition.similarity,
          eventLabel: comparison.currentPosition.eventLabel,
          eventEmoji: comparison.currentPosition.eventEmoji,
        }
      : null,
    actionGuide: {
      current: action.currentAction,
      recommended: action.recommendedAction,
      oneLiner: action.oneLiner,
      stageLadder,
      currentStageId: stage?.id ?? null,
    },
    expectedReturns: comparison.historicalOutcomes.map((h) => ({
      horizon: h.horizon,
      label: h.label,
      avgReturn: h.avgReturn,
      winRate: h.winRate,
      maxMdd: h.maxMdd,
    })),
    notes: [
      "Phase 12·15·16·22 읽기 전용 집약 · 검증 엔진 미수정",
      "유사 사례·기대 수익률은 역사적 패턴 추정(투자 조언 아님)",
    ],
  }
}

export function formatAnalysisPct(value) {
  if (value == null || !Number.isFinite(value)) return "—"
  const sign = value > 0 ? "+" : ""
  return `${sign}${formatMetric(value)}%`
}
