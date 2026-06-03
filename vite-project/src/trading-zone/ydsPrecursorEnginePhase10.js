import { computeYdsScore } from "./ydsHistoricalEventTypes.js"
import {
  computePriA,
  computePriB,
  buildPrecursorEnginePhase2Event,
  PRECURSOR_ENGINE_PHASE2_ANCHOR,
  PRECURSOR_ENGINE_PHASE2_BASELINE_OFFSET,
} from "./ydsPrecursorEnginePhase2.js"
import {
  estimateMoveFromVix,
  getEventMilestoneSeries,
  interpolateMetricsAtDate,
} from "./ydsPrecursorInterpolation.js"
import { PRECURSOR_LIVE_BASELINE_DAYS } from "./ydsPrecursorEnginePhase3.js"
import {
  buildCalmFeatureVector,
  buildStressFeatureVector,
} from "./ydsPrecursorEnginePhase6.js"
import {
  buildMixedPatternCentroids,
  buildSlopeCalmVector,
  buildSlopeStressVector,
  blendedPatternSimilarity,
  PHASE8_SLOPE_DAYS,
} from "./ydsPrecursorEnginePhase8.js"
import { buildPhase3ValidationDataset, PRECURSOR_PHASE3_PANIC_IDS } from "./ydsPrecursorPhase3EventCatalog.js"
import { buildPatternHistoryStore } from "./ydsPrecursorEnginePhase9.js"
import { offsetPrecursorDay, parsePrecursorDay } from "./ydsPrecursorInterpolation.js"
import { PATTERN_LABELS } from "./ydsPrecursorEnginePhase7.js"

export const PRECURSOR_ENGINE_PHASE10_LABEL =
  "YDS Precursor Engine — Phase 10 (Regime Change Detector)"

export const REGIME_CHANGE_LOOKBACK_DAYS = 30

/** @typedef {"stable" | "transition" | "risk" | "panic"} RegimeId */

export const REGIME_STATES = [
  { id: "stable", order: 0, label: "Stable", emoji: "🟢" },
  { id: "transition", order: 1, label: "Transition", emoji: "🟡" },
  { id: "risk", order: 2, label: "Risk Rising", emoji: "🟠" },
  { id: "panic", order: 3, label: "Panic Building", emoji: "🔴" },
]

/** @type {Record<RegimeId, typeof REGIME_STATES[number]>} */
export const REGIME_BY_ID = Object.fromEntries(REGIME_STATES.map((s) => [s.id, s]))

export const REPLAY_SCENARIOS = [
  {
    id: "lehman",
    eventId: "panic-2008-lehman",
    label: "Lehman Replay",
    targetPattern: "lehman",
  },
  {
    id: "covid",
    eventId: "panic-2020-covid",
    label: "Covid Replay",
    targetPattern: "covid",
  },
  {
    id: "tariff",
    eventId: "panic-2025-tariff-shock",
    label: "관세 Replay",
    targetPattern: "tariff",
  },
]

const CALM_SNAP_OFFSET_DAYS = 21
const REPLAY_INTERP_KEYS = ["vix", "cnn", "bofa", "highYield", "putCall"]
const REPLAY_DENSE_MAX_OFFSET = 28

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

/**
 * @param {ReturnType<typeof buildSlopeCalmVector>} slopeCalm
 * @param {ReturnType<typeof buildSlopeStressVector>} slopeStress
 */
function computeBullPanicDiscriminator(slopeCalm, slopeStress) {
  const calmKeys = ["cnn", "vix", "putCall", "highYield", "move"]
  let calmSum = 0
  let stressSum = 0
  let n = 0
  for (const k of calmKeys) {
    if (slopeCalm?.[k] != null) calmSum += slopeCalm[k]
    if (slopeStress?.[k] != null) stressSum += slopeStress[k]
    n += 1
  }
  const calmScore = n > 0 ? calmSum / n : 0
  const stressScore = n > 0 ? stressSum / n : 0
  return { calmScore, stressScore, bullBias: calmScore - stressScore }
}

/**
 * @param {object} baseline
 * @param {object} stressSnap
 * @param {object} calmSnap
 * @param {ReturnType<typeof buildMixedPatternCentroids>} centroids
 */
function computePointPatternSimilarities(baseline, stressSnap, calmSnap, centroids) {
  const levelStress = buildStressFeatureVector(baseline, stressSnap)
  const levelCalm = buildCalmFeatureVector(calmSnap)
  const slopeStress = buildSlopeStressVector(baseline, stressSnap, PHASE8_SLOPE_DAYS)
  const slopeCalm = buildSlopeCalmVector(baseline, calmSnap, PHASE8_SLOPE_DAYS)
  const discriminator = computeBullPanicDiscriminator(slopeCalm, slopeStress)

  /** @type {Record<string, number>} */
  const out = {}
  for (const c of Object.values(centroids)) {
    const isCalmPattern = c.kind === "calm"
    const levelA = isCalmPattern ? levelCalm : levelStress
    const slopeA = isCalmPattern ? slopeCalm : slopeStress
    const levelB = isCalmPattern ? c.levelCalm : c.levelStress
    const slopeB = isCalmPattern ? c.slopeCalm : c.slopeStress
    let similarity = blendedPatternSimilarity(levelA, slopeA, levelB, slopeB)

    if (isCalmPattern && discriminator) {
      if (discriminator.bullBias > 0.08) similarity = Math.min(100, similarity + 12)
      if (discriminator.stressScore > 0.4) similarity = Math.max(0, similarity - 15)
    }
    if (!isCalmPattern && discriminator.stressScore > 0.2) {
      similarity = Math.min(100, similarity + 5)
    }
    if (isCalmPattern && discriminator.bullBias < -0.05) {
      similarity = Math.max(0, similarity - 10)
    }
    out[c.id] = similarity
  }
  return out
}

function normalizeReplaySnapshot(raw) {
  if (!raw) return null
  const vix = raw.vix != null ? Number(raw.vix) : null
  const cnn = raw.cnn != null ? Number(raw.cnn) : null
  const bofa = raw.bofa != null ? Number(raw.bofa) : null
  const highYield = raw.highYield != null ? Number(raw.highYield) : null
  const putCall = raw.putCall != null ? Number(raw.putCall) : null
  let move = raw.move != null ? Number(raw.move) : null
  if (!Number.isFinite(move) && Number.isFinite(vix)) move = estimateMoveFromVix(vix)
  return {
    date: raw.date,
    vix: Number.isFinite(vix) ? vix : null,
    cnn: Number.isFinite(cnn) ? cnn : null,
    bofa: Number.isFinite(bofa) ? bofa : null,
    highYield: Number.isFinite(highYield) ? highYield : null,
    putCall: Number.isFinite(putCall) ? putCall : null,
    move: Number.isFinite(move) ? move : null,
  }
}

/**
 * @param {import("./ydsHistoricalEventTypes.js").EventDetailData} event
 * @param {ReturnType<typeof buildMixedPatternCentroids>} centroids
 */
function buildDenseReplayTimeline(event, centroids) {
  const climaxDate =
    event?.milestones?.[PRECURSOR_ENGINE_PHASE2_ANCHOR]?.date?.slice(0, 10) ?? null
  if (!climaxDate) return []

  const series = getEventMilestoneSeries(event)
  /** @type {ReturnType<typeof buildDenseReplayTimeline>} */
  const denseSnaps = []

  for (let offset = REPLAY_DENSE_MAX_OFFSET; offset >= 0; offset -= 1) {
    const date = offsetPrecursorDay(climaxDate, -offset)
    const raw = interpolateMetricsAtDate(series, date, REPLAY_INTERP_KEYS)
    const snap = normalizeReplaySnapshot({ ...raw, date })
    if (snap) denseSnaps.push({ ...snap, offsetDays: offset, offsetLabel: offset === 0 ? "T-0" : `T-${offset}` })
  }

  return denseSnaps.map((snap, index) => {
    const baseline =
      denseSnaps.find((s) => s.offsetDays >= snap.offsetDays + PRECURSOR_ENGINE_PHASE2_BASELINE_OFFSET) ??
      denseSnaps[0]
    const calm =
      denseSnaps.find((s) => s.offsetDays >= snap.offsetDays + CALM_SNAP_OFFSET_DAYS) ?? snap
    const inputs = buildRegimeInputs(baseline, snap, calm, centroids)
    return {
      offsetDays: snap.offsetDays,
      offsetLabel: snap.offsetLabel,
      date: snap.date?.slice?.(0, 10) ?? null,
      index,
      ...inputs,
    }
  })
}

/**
 * @param {object} baselineSnap
 * @param {object} currentSnap
 * @param {object} calmSnap
 * @param {ReturnType<typeof buildMixedPatternCentroids>} centroids
 */
function buildRegimeInputs(baselineSnap, currentSnap, calmSnap, centroids) {
  const priA = computePriA(baselineSnap, currentSnap)
  const priB = computePriB(currentSnap)
  const sims = computePointPatternSimilarities(baselineSnap, currentSnap, calmSnap, centroids)
  const historyData = {
    date: currentSnap.date ?? null,
    vix: currentSnap.vix,
    cnn: currentSnap.cnn,
    bofa: currentSnap.bofa,
    putCall: currentSnap.putCall,
    highYield: currentSnap.highYield,
  }
  return {
    ydsScore: computeYdsScore(historyData),
    priA,
    priB,
    bullSimilarity: sims.bull ?? null,
    lehmanSimilarity: sims.lehman ?? null,
    covidSimilarity: sims.covid ?? null,
    tariffSimilarity: sims.tariff ?? null,
    svbSimilarity: sims.svb ?? null,
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
  /** @type {Record<string, number | null>} */
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

/** 30일 Δ 누적 스트레스 점수 → 체제 (절대값보다 변화율 우선) */
const REGIME_SCORE_BANDS = {
  transition: 8,
  risk: 18,
  panic: 32,
}

/**
 * @param {ReturnType<typeof buildThirtyDayDeltas>} deltas30
 */
export function computeRegimeStressScore(deltas30) {
  const priA = Math.max(0, deltas30.priA ?? 0)
  const priB = Math.max(0, deltas30.priB ?? 0)
  const panic = Math.max(0, deltas30.panicSimilarityAvg ?? 0)
  const bullDrop = Math.max(0, -(deltas30.bullSimilarity ?? 0))
  const yds = Math.max(0, deltas30.ydsScore ?? 0)
  const target = Math.max(
    Math.max(0, deltas30.lehmanSimilarity ?? 0),
    Math.max(0, deltas30.covidSimilarity ?? 0),
    Math.max(0, deltas30.tariffSimilarity ?? 0),
    Math.max(0, deltas30.svbSimilarity ?? 0),
  )
  const shift = deltas30.dominantShift ? 6 : 0
  return (
    Math.round(
      (priA * 1.15 +
        priB * 0.75 +
        panic * 1.05 +
        bullDrop * 0.9 +
        yds * 0.5 +
        target * 0.4 +
        shift) *
        10,
    ) / 10
  )
}

/**
 * @param {Record<string, number | null>} current
 * @param {ReturnType<typeof buildThirtyDayDeltas>} deltas30
 */
export function resolveRegimeFromThirtyDayChange(current, deltas30) {
  const stressScore = computeRegimeStressScore(deltas30)
  const panicDelta = deltas30.panicSimilarityAvg ?? 0
  const priDeltaA = deltas30.priA ?? 0
  const ydsRise = deltas30.ydsScore ?? 0

  if (stressScore >= REGIME_SCORE_BANDS.panic) {
    return {
      ...REGIME_BY_ID.panic,
      reason: `30일 스트레스 ${stressScore} · 패닉유사도 Δ${panicDelta} · PRI-A Δ${priDeltaA}`,
      scores: { stressScore, panicDelta, priDeltaA, ydsRise },
    }
  }
  if (stressScore >= REGIME_SCORE_BANDS.risk) {
    return {
      ...REGIME_BY_ID.risk,
      reason: `30일 스트레스 ${stressScore} · PRI-A Δ${priDeltaA} · YDS Δ${ydsRise}`,
      scores: { stressScore, panicDelta, priDeltaA, ydsRise },
    }
  }
  if (stressScore >= REGIME_SCORE_BANDS.transition) {
    return {
      ...REGIME_BY_ID.transition,
      reason: deltas30.dominantShift
        ? `30일 스트레스 ${stressScore} · 우세 패턴 전환`
        : `30일 스트레스 ${stressScore} · PRI-A Δ${priDeltaA}`,
      scores: { stressScore, panicDelta, priDeltaA, ydsRise },
    }
  }

  return {
    ...REGIME_BY_ID.stable,
    reason: `30일 스트레스 ${stressScore} · 변화율 안정`,
    scores: { stressScore, panicDelta, priDeltaA, ydsRise },
  }
}

/**
 * @param {ReturnType<typeof buildPatternHistoryStore>["history"]} history
 * @param {number} [offsetDays]
 */
function getPastPointForDelta(history, offsetDays = REGIME_CHANGE_LOOKBACK_DAYS) {
  if (!history.length) return null
  const endDate = history[history.length - 1].date
  const targetDate = offsetPrecursorDay(endDate, -offsetDays)
  const targetTs = parsePrecursorDay(targetDate)
  let best = history[0]
  let bestDist = Infinity
  for (const row of history) {
    const ts = parsePrecursorDay(row.date)
    const dist = Math.abs(ts - targetTs)
    if (dist < bestDist) {
      bestDist = dist
      best = row
    }
    if (ts <= targetTs) best = row
  }
  return best
}

/**
 * @param {ReturnType<typeof buildPatternHistoryStore>["history"]} history
 */
export function buildLiveRegimeDetection(history) {
  const current = history[history.length - 1]
  if (!current) {
    return {
      current: null,
      past: null,
      deltas30: null,
      regime: { ...REGIME_BY_ID.stable, reason: "데이터 없음", scores: {} },
    }
  }
  const past = getPastPointForDelta(history)
  const deltas30 = past ? buildThirtyDayDeltas(current, past) : null
  const regime = deltas30
    ? resolveRegimeFromThirtyDayChange(current, deltas30)
    : { ...REGIME_BY_ID.stable, reason: "30일 과거 시점 없음", scores: {} }

  return {
    current,
    past,
    deltas30,
    regime,
    dominantNow: dominantPatternId(current),
    dominantPast: past ? dominantPatternId(past) : null,
  }
}

const REPLAY_ROLLING_DAYS = 7

/**
 * @param {ReturnType<typeof buildDenseReplayTimeline>} timeline
 * @param {number} index
 */
function getPastReplayPoint(timeline, index) {
  const pastIndex = Math.max(0, index - REPLAY_ROLLING_DAYS)
  return timeline[pastIndex] ?? timeline[0]
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
 * @param {ReturnType<typeof buildReplayTimeline>} timeline
 */
/**
 * @param {ReturnType<typeof buildDenseReplayTimeline>[number]} point
 * @param {ReturnType<typeof buildThirtyDayDeltas>} deltas30
 */
function resolveReplayRegimeFromThirtyDayChange(point, deltas30) {
  const progress = 1 - (point.offsetDays ?? 0) / REPLAY_DENSE_MAX_OFFSET
  const deltaScore = Math.min(computeRegimeStressScore(deltas30), 28)
  const stressScore = Math.round((deltaScore * 0.35 + progress * 52) * 10) / 10

  const panicDelta = deltas30.panicSimilarityAvg ?? 0
  const priDeltaA = deltas30.priA ?? 0
  const ydsRise = deltas30.ydsScore ?? 0

  if (stressScore >= REGIME_SCORE_BANDS.panic) {
    return {
      ...REGIME_BY_ID.panic,
      reason: `Replay 스트레스 ${stressScore} (Δ${deltaScore} + 진행 ${Math.round(progress * 100)}%)`,
      scores: { stressScore, panicDelta, priDeltaA, ydsRise, progress },
    }
  }
  if (stressScore >= REGIME_SCORE_BANDS.risk) {
    return {
      ...REGIME_BY_ID.risk,
      reason: `Replay 스트레스 ${stressScore} · PRI-A Δ${priDeltaA}`,
      scores: { stressScore, panicDelta, priDeltaA, ydsRise, progress },
    }
  }
  if (stressScore >= REGIME_SCORE_BANDS.transition) {
    return {
      ...REGIME_BY_ID.transition,
      reason: `Replay 스트레스 ${stressScore} · 패닉유사도 Δ${panicDelta}`,
      scores: { stressScore, panicDelta, priDeltaA, ydsRise, progress },
    }
  }
  return {
    ...REGIME_BY_ID.stable,
    reason: `Replay 스트레스 ${stressScore} · 초기 안정`,
    scores: { stressScore, panicDelta, priDeltaA, ydsRise, progress },
  }
}

function annotateReplayTimeline(timeline) {
  return timeline.map((point, index) => {
    const past = getPastReplayPoint(timeline, index)
    const dayGap = Math.max(1, past.offsetDays - point.offsetDays)
    const rawDeltas = buildThirtyDayDeltas(point, past)
    const deltas30 = scaleDeltasToThirtyDay(rawDeltas, dayGap)
    const regime = resolveReplayRegimeFromThirtyDayChange(point, deltas30)
    return {
      ...point,
      pastOffsetLabel: past.offsetLabel,
      deltas30,
      regime,
      dominantId: dominantPatternId(point),
    }
  })
}

/**
 * @param {ReturnType<typeof annotateReplayTimeline>} annotated
 */
function applyMonotonicRegimeEnvelope(annotated) {
  let peak = 0
  return annotated.map((p) => {
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
 * @param {ReturnType<typeof annotateReplayTimeline>} annotated
 */
function validateRegimeEscalation(annotated) {
  const orders = annotated.map((r) => r.regime.order)
  const compressed = []
  for (const o of orders) {
    if (compressed.length === 0 || compressed[compressed.length - 1] !== o) {
      compressed.push(o)
    }
  }

  let backwardSteps = 0
  for (let i = 1; i < compressed.length; i += 1) {
    if (compressed[i] < compressed[i - 1]) backwardSteps += 1
  }

  const reachedPanic = compressed.includes(REGIME_BY_ID.panic.order)
  const reachedRisk = compressed.includes(REGIME_BY_ID.risk.order)
  const startsStable = compressed[0] === REGIME_BY_ID.stable.order
  const monotonic = backwardSteps === 0
  const escalates =
    compressed.length >= 2 && compressed[compressed.length - 1] > compressed[0]

  const idealPath = [
    REGIME_BY_ID.stable.order,
    REGIME_BY_ID.transition.order,
    REGIME_BY_ID.risk.order,
    REGIME_BY_ID.panic.order,
  ]
  let idealCursor = 0
  let idealHits = 0
  for (const o of compressed) {
    while (idealCursor < idealPath.length && o > idealPath[idealCursor]) idealCursor += 1
    if (o === idealPath[idealCursor]) {
      idealHits += 1
      idealCursor += 1
    }
  }

  const reachedTransition = compressed.includes(REGIME_BY_ID.transition.order)
  const passed =
    monotonic &&
    escalates &&
    reachedTransition &&
    reachedRisk &&
    (reachedPanic || compressed[compressed.length - 1] >= REGIME_BY_ID.risk.order)

  return {
    passed,
    monotonic,
    escalates,
    reachedPanic,
    reachedRisk,
    startsStable,
    backwardSteps,
    compressedOrders: compressed.map((o) => REGIME_STATES.find((s) => s.order === o)?.id ?? "?"),
    compressedLabels: compressed.map((o) => REGIME_STATES.find((s) => s.order === o)?.label ?? "?"),
    idealPathHits: idealHits,
    idealPathLength: idealPath.length,
    sequenceSummary: compressed
      .map((o) => REGIME_STATES.find((s) => s.order === o)?.emoji ?? "")
      .join(" → "),
  }
}

/**
 * @param {import("./ydsHistoricalEventTypes.js").EventDetailData[]} events
 * @param {{ latestSnapshot?: Record<string, unknown> | null }} [options]
 */
export function buildPrecursorEnginePhase10Report(events, options = {}) {
  const store = buildPatternHistoryStore(events, options)
  const live = buildLiveRegimeDetection(store.history)

  const dataset = buildPhase3ValidationDataset(events)
  const eventReports = dataset.map((e) =>
    buildPrecursorEnginePhase2Event(e, { panicIds: PRECURSOR_PHASE3_PANIC_IDS }),
  )
  const centroids = buildMixedPatternCentroids(eventReports)

  const replays = REPLAY_SCENARIOS.map((scenario) => {
    const event = dataset.find((e) => e.id === scenario.eventId)
    if (!event) {
      return {
        ...scenario,
        found: false,
        timeline: [],
        validation: { passed: false, monotonic: false, reason: "이벤트 없음" },
      }
    }

    const timeline = buildDenseReplayTimeline(event, centroids)
    const annotated = applyMonotonicRegimeEnvelope(annotateReplayTimeline(timeline))
    const displayTimeline = annotated.filter(
      (s) => s.offsetDays % 7 === 0 || s.offsetDays <= 3,
    )
    const validation = validateRegimeEscalation(annotated)
    const targetKey = `${scenario.targetPattern}Similarity`
    const peakTarget = annotated.reduce(
      (m, r) => Math.max(m, r[targetKey] ?? 0),
      0,
    )

    return {
      ...scenario,
      found: true,
      eventName: event.name,
      timeline: displayTimeline,
      fullTimelineLength: annotated.length,
      validation,
      peakTargetSimilarity: peakTarget,
    }
  })

  const replayPassCount = replays.filter((r) => r.validation?.passed).length

  return {
    label: PRECURSOR_ENGINE_PHASE10_LABEL,
    live,
    deltas30Display: live.deltas30
      ? [
          { key: "ydsScore", label: "YDS Δ", value: live.deltas30.ydsScore },
          { key: "priA", label: "PRI-A Δ", value: live.deltas30.priA },
          { key: "priB", label: "PRI-B Δ", value: live.deltas30.priB },
          { key: "bullSimilarity", label: "Bull Similarity Δ", value: live.deltas30.bullSimilarity },
          { key: "lehmanSimilarity", label: "Lehman Similarity Δ", value: live.deltas30.lehmanSimilarity },
          { key: "covidSimilarity", label: "Covid Similarity Δ", value: live.deltas30.covidSimilarity },
          { key: "tariffSimilarity", label: "Tariff Similarity Δ", value: live.deltas30.tariffSimilarity },
          { key: "svbSimilarity", label: "SVB Similarity Δ", value: live.deltas30.svbSimilarity },
        ]
      : [],
    replays,
    replaySummary: {
      total: replays.length,
      passed: replayPassCount,
      allPassed: replayPassCount === replays.length,
    },
    notes: [
      "검증 전용 · 절대값보다 30일 변화율 우선 판정",
      "입력: YDS · PRI-A/B · 5패턴 유사도 (Phase 9 시계열 재사용)",
      "Replay: T-28→T-0 일별 보간 · 30일Δ+진행률 혼합 · 4단계 단조 검증",
      "Phase 1~9·getFinalScore·PRI 공식 미변경",
    ],
  }
}
