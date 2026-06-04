import {
  computeYdsScore,
  resolveYdsStage,
  formatMetric,
} from "./ydsHistoricalEventTypes.js"
import {
  buildPrecursorEnginePhase2Event,
  computePriA,
  computePriB,
  resolvePriTier,
  PRECURSOR_ENGINE_PHASE2_T_OFFSETS,
  PRECURSOR_ENGINE_PHASE2_BASELINE_OFFSET,
  PRECURSOR_ENGINE_PHASE2_WARN_PRI_A,
  PRECURSOR_ENGINE_PHASE2_WARN_PRI_B,
  PRECURSOR_ENGINE_PHASE2_LEAD_MIN,
  PRECURSOR_ENGINE_PHASE2_LEAD_MAX,
} from "./ydsPrecursorEnginePhase2.js"
import {
  buildRadarPatternCentroids,
  buildStressFeatureVector,
  buildCalmFeatureVector,
  computePatternSimilarities,
} from "./ydsPrecursorEnginePhase6.js"
import {
  computeRegimeStressScore,
  REGIME_CHANGE_LOOKBACK_DAYS,
} from "./ydsPrecursorEnginePhase10.js"
import { resolveActionGuideStep } from "./ydsPrecursorEnginePhase15.js"
import { resolveConfidenceLabel } from "./ydsPrecursorEnginePhase16.js"
import { buildPhase3ValidationDataset, PRECURSOR_PHASE3_PANIC_IDS } from "./ydsPrecursorPhase3EventCatalog.js"
import { formatRiskPatternLabel } from "./ydsPrecursorMetricDisplay.js"
import { REGIME_STATES, regimeDisplayForId } from "./ydsPrecursorRegimeDisplay.js"

export const PRECURSOR_ENGINE_PHASE20_LABEL =
  "YDS Precursor Engine — Phase 20 (패닉 타임머신)"

/** 향후 독립 페이지 마운트용 — 라우트만 참조 */
export const PANIC_TIME_MACHINE_PAGE = {
  path: "/market-timemachine",
  title: "패닉 타임머신",
  description: "과거 주요 위기 시점을 T-28~T-0 슬라이더로 재생",
}

export const PANIC_TIME_MACHINE_EVENTS = [
  { id: "lehman", eventId: "panic-2008-lehman", shortLabel: "리먼", emoji: "🏦" },
  { id: "covid", eventId: "panic-2020-covid", shortLabel: "코로나", emoji: "😱" },
  { id: "tariff", eventId: "panic-2025-tariff-shock", shortLabel: "관세", emoji: "📜" },
  { id: "svb", eventId: "panic-2023-svb", shortLabel: "SVB", emoji: "🏛️" },
  { id: "yen_carry", eventId: "panic-2024-yen-carry", shortLabel: "엔캐리", emoji: "💴" },
  { id: "brexit", eventId: "interest-2016-brexit", shortLabel: "브렉시트", emoji: "🇬🇧" },
  { id: "trade_war", eventId: "interest-2018-trade-war", shortLabel: "무역분쟁", emoji: "⚔️" },
  { id: "dotcom", eventId: "overheated-2000-dotcom", shortLabel: "닷컴", emoji: "💻" },
  { id: "q4_2018", eventId: "panic-2018-q4", shortLabel: "2018 Q4", emoji: "📉" },
  { id: "ukraine", eventId: "panic-2022-ukraine", shortLabel: "우크라이나", emoji: "🛡️" },
]

const REPLAY_MAX_OFFSET = PRECURSOR_ENGINE_PHASE2_BASELINE_OFFSET
const CALM_LOOKBACK_DAYS = 21
const YDS_INTEREST_THRESHOLD = 50

const METRIC_KEYS = [
  "ydsScore",
  "priA",
  "priB",
  "bullSimilarity",
  "lehmanSimilarity",
  "covidSimilarity",
  "tariffSimilarity",
  "svbSimilarity",
]

const REGIME_SCORE_BANDS = { transition: 8, risk: 18, panic: 32 }

/** @type {readonly { key: string; label: string; react: (b: number, c: number) => number; threshold: number }[]} */
const FIRST_REACTION_METRICS = [
  { key: "putCall", label: "Put/Call", react: (b, c) => c - b, threshold: 0.08 },
  { key: "vix", label: "VIX", react: (b, c) => ((c - b) / Math.max(b, 1)) * 100, threshold: 12 },
  { key: "cnn", label: "CNN", react: (b, c) => b - c, threshold: 10 },
  { key: "highYield", label: "HY", react: (b, c) => c - b, threshold: 0.12 },
  { key: "move", label: "MOVE", react: (b, c) => c - b, threshold: 4 },
  { key: "bofa", label: "BofA", react: (b, c) => b - c, threshold: 0.35 },
]

const STRESS_PATTERN_IDS = ["lehman", "covid", "tariff", "svb"]

/**
 * @param {ReturnType<typeof computePatternSimilarities>} sims
 */
function simsToPointMetrics(sims) {
  /** @type {Record<string, number | null>} */
  const map = {}
  for (const s of sims) map[s.patternId] = s.similarity
  return {
    bullSimilarity: map.bull ?? null,
    lehmanSimilarity: map.lehman ?? null,
    covidSimilarity: map.covid ?? null,
    tariffSimilarity: map.tariff ?? null,
    svbSimilarity: map.svb ?? null,
  }
}

/**
 * @param {Record<string, number | null>} point
 */
function dominantPatternId(point) {
  const ranked = [
    ["bull", point.bullSimilarity],
    ["lehman", point.lehmanSimilarity],
    ["covid", point.covidSimilarity],
    ["tariff", point.tariffSimilarity],
    ["svb", point.svbSimilarity],
  ].sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
  return ranked[0]?.[0] ?? null
}

/**
 * @param {Record<string, number | null>} current
 * @param {Record<string, number | null>} past
 */
function buildThirtyDayDeltas(current, past) {
  /** @type {Record<string, number | null | boolean>} */
  const deltas = {}
  for (const key of METRIC_KEYS) {
    const c = current[key]
    const p = past[key]
    if (c == null || p == null || !Number.isFinite(c) || !Number.isFinite(p)) deltas[key] = null
    else deltas[key] = Math.round((c - p) * 10) / 10
  }
  const panicKeys = ["lehmanSimilarity", "covidSimilarity", "tariffSimilarity"]
  const panicDeltas = panicKeys.map((k) => deltas[k]).filter((v) => v != null)
  deltas.panicSimilarityAvg =
    panicDeltas.length > 0
      ? Math.round((panicDeltas.reduce((a, b) => a + b, 0) / panicDeltas.length) * 10) / 10
      : null
  deltas.dominantShift = dominantPatternId(current) !== dominantPatternId(past)
  return deltas
}

/**
 * @param {ReturnType<typeof buildThirtyDayDeltas>} deltas
 * @param {number} dayGap
 */
function scaleDeltasToThirtyDay(deltas, dayGap) {
  if (!deltas || dayGap <= 0) return deltas
  const factor = REGIME_CHANGE_LOOKBACK_DAYS / dayGap
  /** @type {Record<string, number | null | boolean>} */
  const scaled = { ...deltas, dominantShift: deltas.dominantShift }
  for (const key of METRIC_KEYS) {
    if (deltas[key] != null && Number.isFinite(deltas[key])) {
      scaled[key] = Math.round(deltas[key] * factor * 10) / 10
    }
  }
  if (deltas.panicSimilarityAvg != null) {
    scaled.panicSimilarityAvg = Math.round(deltas.panicSimilarityAvg * factor * 10) / 10
  }
  return scaled
}

/**
 * @param {{ offsetDays: number }} point
 * @param {ReturnType<typeof buildThirtyDayDeltas>} deltas30
 */
function resolveReplayRegime(point, deltas30) {
  const progress = 1 - (point.offsetDays ?? 0) / REPLAY_MAX_OFFSET
  const deltaScore = Math.min(computeRegimeStressScore(deltas30), 28)
  const stressScore = Math.round((deltaScore * 0.35 + progress * 52) * 10) / 10

  const panicDelta = deltas30.panicSimilarityAvg ?? 0
  const priDeltaA = deltas30.priA ?? 0
  const ydsRise = deltas30.ydsScore ?? 0

  if (stressScore >= REGIME_SCORE_BANDS.panic) {
    return regimeDisplayForId("panic", {
      reason: `Replay 스트레스 ${stressScore}`,
      scores: { stressScore, panicDelta, priDeltaA, ydsRise, progress },
    })
  }
  if (stressScore >= REGIME_SCORE_BANDS.risk) {
    return regimeDisplayForId("risk", {
      reason: `Replay 스트레스 ${stressScore}`,
      scores: { stressScore, panicDelta, priDeltaA, ydsRise, progress },
    })
  }
  if (stressScore >= REGIME_SCORE_BANDS.transition) {
    return regimeDisplayForId("transition", {
      reason: `Replay 스트레스 ${stressScore}`,
      scores: { stressScore, panicDelta, priDeltaA, ydsRise, progress },
    })
  }
  return regimeDisplayForId("stable", {
    reason: `Replay 스트레스 ${stressScore}`,
    scores: { stressScore, panicDelta, priDeltaA, ydsRise, progress },
  })
}

/**
 * @param {ReturnType<typeof buildTimeMachineFrames>} frames
 */
function applyMonotonicRegimeEnvelope(frames) {
  let peak = 0
  return frames.map((p) => {
    peak = Math.max(peak, p.regime.order)
    const state = REGIME_STATES.find((s) => s.order === peak) ?? p.regime
    return {
      ...p,
      regime: {
        ...state,
        reason: p.regime.reason,
        scores: p.regime.scores,
      },
    }
  })
}

/**
 * @param {ReturnType<typeof buildTimeMachineFrames>} frames
 * @param {number} index
 */
function getPastFrame(frames, index) {
  const pastIndex = Math.max(0, index - 1)
  return frames[pastIndex] ?? frames[0]
}

/**
 * @param {ReturnType<typeof buildPrecursorEnginePhase2Event>["timeSeries"]} timeSeries
 * @param {number} minOffsetDays
 */
function findSnapAtOrAboveOffset(timeSeries, minOffsetDays) {
  const sorted = [...timeSeries].sort((a, b) => b.offsetDays - a.offsetDays)
  return sorted.find((s) => s.offsetDays >= minOffsetDays) ?? sorted[sorted.length - 1] ?? null
}

/**
 * @param {ReturnType<typeof buildPrecursorEnginePhase2Event>["timeSeries"][number]} snap
 * @param {ReturnType<typeof buildPrecursorEnginePhase2Event>["timeSeries"]} timeSeries
 * @param {ReturnType<typeof buildRadarPatternCentroids>} centroids
 */
function buildFramePatternContext(snap, timeSeries, centroids) {
  const baseline = findSnapAtOrAboveOffset(timeSeries, snap.offsetDays + PRECURSOR_ENGINE_PHASE2_BASELINE_OFFSET)
  const calm = findSnapAtOrAboveOffset(timeSeries, snap.offsetDays + CALM_LOOKBACK_DAYS)
  const stressVec = buildStressFeatureVector(baseline ?? snap, snap)
  const calmVec = buildCalmFeatureVector(calm ?? snap)
  const sims = stressVec && calmVec ? computePatternSimilarities(stressVec, calmVec, centroids) : []
  const top3 = sims.slice(0, 3)
  const metrics = simsToPointMetrics(sims)
  const historyData = {
    date: snap.date,
    vix: snap.vix,
    cnn: snap.cnn,
    bofa: snap.bofa,
    putCall: snap.putCall,
    highYield: snap.highYield,
  }
  const ydsScore = computeYdsScore(historyData)
  const priA = computePriA(
    timeSeries.find((s) => s.offsetDays === PRECURSOR_ENGINE_PHASE2_BASELINE_OFFSET) ?? snap,
    snap,
  )
  const priB = computePriB(snap)

  return {
    ydsScore,
    priA,
    priB,
    sims,
    top3,
    patternId: top3[0]?.patternId ?? null,
    patternLabel: top3[0]?.patternLabel ?? null,
    ...metrics,
  }
}

/**
 * @param {ReturnType<typeof buildPrecursorEnginePhase2Event>["timeSeries"]} timeSeries
 * @param {ReturnType<typeof buildRadarPatternCentroids>} centroids
 */
function buildTimeMachineFrames(timeSeries, centroids) {
  const sorted = [...timeSeries].sort((a, b) => b.offsetDays - a.offsetDays)

  const raw = sorted.map((snap) => {
    const ctx = buildFramePatternContext(snap, timeSeries, centroids)
    const ydsStage = resolveYdsStage(ctx.ydsScore)
    return {
      offsetDays: snap.offsetDays,
      offsetLabel: snap.offsetLabel,
      date: snap.date?.slice?.(0, 10) ?? null,
      vix: snap.vix,
      cnn: snap.cnn,
      bofa: snap.bofa,
      highYield: snap.highYield,
      putCall: snap.putCall,
      move: snap.move,
      ydsScore: ctx.ydsScore,
      ydsStage,
      priA: ctx.priA,
      priB: ctx.priB,
      priATier: resolvePriTier(ctx.priA, "A"),
      priBTier: resolvePriTier(ctx.priB, "B"),
      top3: ctx.top3,
      patternId: ctx.patternId,
      patternLabel: formatRiskPatternLabel(ctx.patternId, ctx.patternLabel),
      bullSimilarity: ctx.bullSimilarity,
      lehmanSimilarity: ctx.lehmanSimilarity,
      covidSimilarity: ctx.covidSimilarity,
      tariffSimilarity: ctx.tariffSimilarity,
      svbSimilarity: ctx.svbSimilarity,
    }
  })

  const withRegime = raw.map((point, index) => {
    const past = getPastFrame(raw, index)
    const dayGap = Math.max(1, past.offsetDays - point.offsetDays)
    const rawDeltas = buildThirtyDayDeltas(point, past)
    const deltas30 = scaleDeltasToThirtyDay(rawDeltas, dayGap)
    const regime = resolveReplayRegime(point, deltas30)
    const confidenceScore = computeFrameConfidence(point.top3, point.priA, point.priB, regime)
    const confidence = resolveConfidenceLabel(confidenceScore)
    const action = resolveActionGuideStep({
      ydsScore: point.ydsScore,
      priA: point.priA,
      priB: point.priB,
      regimeId: regime.id,
      patternId: point.patternId,
    })
    return {
      ...point,
      deltas30,
      regime,
      confidenceScore,
      confidence,
      action,
    }
  })

  return applyMonotonicRegimeEnvelope(withRegime)
}

/**
 * @param {ReturnType<typeof computePatternSimilarities>} top3
 * @param {number | null} priA
 * @param {number | null} priB
 * @param {ReturnType<typeof regimeDisplayForId>} regime
 */
function computeFrameConfidence(top3, priA, priB, regime) {
  const margin = Math.max(0, (top3[0]?.similarity ?? 0) - (top3[1]?.similarity ?? 0))
  let score = 48 + margin * 1.8 + (priA ?? 0) * 0.18 + (priB ?? 0) * 0.12
  if (regime.order >= 2) score += 10
  if (regime.order >= 3) score += 8
  return Math.round(Math.min(100, Math.max(0, score)))
}

/**
 * @param {ReturnType<typeof buildTimeMachineFrames>} frames
 */
function buildReplayTimeline(frames) {
  return frames.map((f) => ({
    offsetDays: f.offsetDays,
    offsetLabel: f.offsetLabel,
    regimeId: f.regime.id,
    regimeLabel: f.regime.label,
    regimeEmoji: f.regime.emoji,
    headline:
      f.offsetDays === 0 ? `${f.offsetLabel} 패닉 정점` : `${f.offsetLabel} ${f.regime.label}`,
  }))
}

/**
 * @param {ReturnType<typeof buildPrecursorEnginePhase2Event>["timeSeries"]} timeSeries
 * @param {ReturnType<typeof buildTimeMachineFrames>} frames
 */
function buildFirstMetricReactions(timeSeries, frames) {
  const baseline =
    timeSeries.find((s) => s.offsetDays === PRECURSOR_ENGINE_PHASE2_BASELINE_OFFSET) ??
    timeSeries[timeSeries.length - 1]
  if (!baseline) return []

  /** @type {{ order: number; key: string; label: string; offsetDays: number; offsetLabel: string; delta: number }[]} */
  const reactions = []

  for (const metric of FIRST_REACTION_METRICS) {
    const bVal = baseline[metric.key]
    if (!Number.isFinite(bVal)) continue

    const chron = [...frames].sort((a, b) => b.offsetDays - a.offsetDays)
    for (const frame of chron) {
      const cVal = frame[metric.key]
      if (!Number.isFinite(cVal)) continue
      const delta = metric.react(bVal, cVal)
      if (delta >= metric.threshold) {
        reactions.push({
          order: 0,
          key: metric.key,
          label: metric.label,
          offsetDays: frame.offsetDays,
          offsetLabel: frame.offsetLabel,
          delta: Math.round(delta * 100) / 100,
        })
        break
      }
    }
  }

  reactions.sort((a, b) => b.offsetDays - a.offsetDays)
  return reactions.map((r, i) => ({ ...r, order: i + 1 }))
}

/**
 * @param {ReturnType<typeof buildTimeMachineFrames>} frames
 * @param {number} selectedOffset
 */
function buildPatternEvolution(frames, selectedOffset) {
  const baseline = frames.find((f) => f.offsetDays === PRECURSOR_ENGINE_PHASE2_BASELINE_OFFSET) ?? frames[0]
  const current = frames.find((f) => f.offsetDays === selectedOffset) ?? frames[frames.length - 1]
  if (!baseline || !current) return []

  return STRESS_PATTERN_IDS.map((id) => {
    const key = `${id}Similarity`
    const from = baseline[key] ?? 0
    const to = current[key] ?? 0
    const label =
      id === "lehman"
        ? "리먼형"
        : id === "covid"
          ? "코로나형"
          : id === "tariff"
            ? "관세형"
            : "SVB형"
    return {
      patternId: id,
      label,
      from: Math.round(from),
      to: Math.round(to),
      delta: Math.round(to - from),
    }
  }).sort((a, b) => b.to - a.to)
}

/**
 * @param {ReturnType<typeof buildTimeMachineFrames>} frames
 * @param {ReturnType<typeof buildPrecursorEnginePhase2Event>} phase2
 */
function buildFinalEvaluation(frames, phase2) {
  const inLead = (offsetDays) =>
    offsetDays >= PRECURSOR_ENGINE_PHASE2_LEAD_MIN && offsetDays <= PRECURSOR_ENGINE_PHASE2_LEAD_MAX

  const ydsFirst = [...frames]
    .filter((f) => f.ydsScore != null && f.ydsScore >= YDS_INTEREST_THRESHOLD && inLead(f.offsetDays))
    .sort((a, b) => b.offsetDays - a.offsetDays)[0]

  const ydsAnyFirst = [...frames]
    .filter((f) => f.ydsScore != null && f.ydsScore >= YDS_INTEREST_THRESHOLD)
    .sort((a, b) => b.offsetDays - a.offsetDays)[0]

  const priAFrame = phase2.firstWarning.priADays != null
    ? frames.find((f) => f.offsetDays === phase2.firstWarning.priADays)
    : null
  const priBFrame = phase2.firstWarning.priBDays != null
    ? frames.find((f) => f.offsetDays === phase2.firstWarning.priBDays)
    : null

  return {
    yds: {
      offsetLabel: ydsFirst?.offsetLabel ?? ydsAnyFirst?.offsetLabel ?? "—",
      daysBefore: ydsFirst?.offsetDays ?? ydsAnyFirst?.offsetDays ?? null,
      score: ydsFirst?.ydsScore ?? ydsAnyFirst?.ydsScore ?? null,
      inLeadWindow: ydsFirst != null,
    },
    priA: {
      offsetLabel: phase2.firstWarning.priA,
      daysBefore: phase2.firstWarning.priADays,
      score: priAFrame?.priA ?? null,
      threshold: PRECURSOR_ENGINE_PHASE2_WARN_PRI_A,
    },
    priB: {
      offsetLabel: phase2.firstWarning.priB,
      daysBefore: phase2.firstWarning.priBDays,
      score: priBFrame?.priB ?? null,
      threshold: PRECURSOR_ENGINE_PHASE2_WARN_PRI_B,
    },
    climaxDate: phase2.climaxDate,
    leadWindow: `T-${PRECURSOR_ENGINE_PHASE2_LEAD_MAX}~T-${PRECURSOR_ENGINE_PHASE2_LEAD_MIN}`,
  }
}

/**
 * @param {import("./ydsHistoricalEventTypes.js").EventDetailData} event
 * @param {ReturnType<typeof buildRadarPatternCentroids>} centroids
 */
export function buildTimeMachineEventReport(event, centroids) {
  const phase2 = buildPrecursorEnginePhase2Event(event, { panicIds: PRECURSOR_PHASE3_PANIC_IDS })
  const frames = buildTimeMachineFrames(phase2.timeSeries, centroids)
  const timeline = buildReplayTimeline(frames)
  const firstReactions = buildFirstMetricReactions(phase2.timeSeries, frames)

  return {
    eventId: event.id,
    name: event.name,
    climaxDate: phase2.climaxDate,
    phase2,
    frames,
    timeline,
    firstReactions,
    phase2FirstWarning: phase2.firstWarning,
    finalEvaluation: buildFinalEvaluation(frames, phase2),
    offsets: [...PRECURSOR_ENGINE_PHASE2_T_OFFSETS],
  }
}

/**
 * @param {import("./ydsHistoricalEventTypes.js").EventDetailData[]} events
 * @param {{ selectedEventId?: string; selectedOffset?: number }} [options]
 */
export function buildPrecursorEnginePhase20Report(events, options = {}) {
  const dataset = buildPhase3ValidationDataset(events)
  const byId = new Map(dataset.map((e) => [e.id, e]))
  const eventReports = dataset.map((e) =>
    buildPrecursorEnginePhase2Event(e, { panicIds: PRECURSOR_PHASE3_PANIC_IDS }),
  )
  const centroids = buildRadarPatternCentroids(eventReports)

  const machineEvents = PANIC_TIME_MACHINE_EVENTS.map((spec) => {
    const event = byId.get(spec.eventId)
    if (!event) {
      return {
        ...spec,
        available: false,
        report: null,
      }
    }
    return {
      ...spec,
      available: true,
      report: buildTimeMachineEventReport(event, centroids),
    }
  })

  const defaultEvent =
    machineEvents.find((e) => e.id === options.selectedEventId && e.available) ??
    machineEvents.find((e) => e.available) ??
    null

  const selectedOffset =
    options.selectedOffset ??
    defaultEvent?.report?.offsets?.[defaultEvent.report.offsets.length - 1] ??
    0

  const selectedFrame =
    defaultEvent?.report?.frames.find((f) => f.offsetDays === selectedOffset) ??
    defaultEvent?.report?.frames[defaultEvent.report.frames.length - 1] ??
    null

  const patternEvolution = defaultEvent?.report
    ? buildPatternEvolution(defaultEvent.report.frames, selectedOffset)
    : []

  const finalEvaluation = defaultEvent?.report?.finalEvaluation ?? null

  return {
    meta: {
      label: PRECURSOR_ENGINE_PHASE20_LABEL,
      page: PANIC_TIME_MACHINE_PAGE,
      eventCount: machineEvents.filter((e) => e.available).length,
      offsets: [...PRECURSOR_ENGINE_PHASE2_T_OFFSETS],
    },
    events: machineEvents,
    selected: {
      eventId: defaultEvent?.id ?? null,
      eventSpec: defaultEvent,
      offset: selectedOffset,
      frame: selectedFrame,
      patternEvolution,
      finalEvaluation,
      timeline: defaultEvent?.report?.timeline ?? [],
      firstReactions: defaultEvent?.report?.firstReactions ?? [],
    },
    notes: [
      "Phase 3·5·6·10·15 데이터 읽기 전용 · Phase 0~19 엔진·PRI·getFinalScore 미수정",
      "국면 Replay는 Phase 10 밀집 타임라인과 동일한 스케일·단조 봉투 로직을 Phase 20에서 재현",
      `향후 ${PANIC_TIME_MACHINE_PAGE.path} 독립 페이지에서 buildPrecursorEnginePhase20Report 재사용 가능`,
    ],
  }
}

export function formatTimeMachineScore(value, suffix = "") {
  if (value == null || !Number.isFinite(value)) return "—"
  return `${formatMetric(value)}${suffix}`
}
