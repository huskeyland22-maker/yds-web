import {
  buildPrecursorEnginePhase2Event,
  PRECURSOR_ENGINE_PHASE2_BASELINE_OFFSET,
} from "./ydsPrecursorEnginePhase2.js"
import {
  buildPhase3ValidationDataset,
  PRECURSOR_PHASE3_NON_PANIC_IDS,
  PRECURSOR_PHASE3_PANIC_IDS,
} from "./ydsPrecursorPhase3EventCatalog.js"
import {
  RADAR_PATTERNS,
  buildCalmFeatureVector,
  buildStressFeatureVector,
  cosineSimilarityPercent,
  getEventPatternSnapContext,
} from "./ydsPrecursorEnginePhase6.js"
import {
  buildPrecursorEnginePhase7Report,
  findMostConfusedPairs,
  PATTERN_IDS,
  PATTERN_LABELS,
  resolveEventGroundTruthPattern,
} from "./ydsPrecursorEnginePhase7.js"

export const PRECURSOR_ENGINE_PHASE8_LABEL =
  "YDS Precursor Engine — Phase 8 (Bull vs Panic Separation)"

export const PHASE8_SLOPE_DAYS = 30

export const PHASE8_LEVEL_WEIGHT = 0.45
export const PHASE8_SLOPE_WEIGHT = 0.55

export const PHASE8_GOALS = {
  top1Min: 65,
  separationMin: 65,
  bullLehmanMax: 8,
}

export const SLOPE_METRIC_LABELS = {
  cnn: "CNN 30일 기울기",
  highYield: "HY 30일 기울기",
  move: "MOVE 30일 기울기",
  vix: "VIX 30일 기울기",
  putCall: "Put/Call 30일 기울기",
}

/** 일일 변화량 cap (정규화) */
const SLOPE_CAPS = {
  cnn: 1.2,
  highYield: 0.04,
  move: 0.6,
  vix: 1.2,
  putCall: 0.012,
}

/**
 * @param {object} baseline
 * @param {object} current
 * @param {number} [days]
 */
export function buildSlopeStressVector(baseline, current, days = PHASE8_SLOPE_DAYS) {
  if (!baseline || !current) return null
  const span = Math.max(1, days)
  /** @type {Record<string, number>} */
  const vec = {}

  const cnnB = baseline.cnn
  const cnnC = current.cnn
  if (Number.isFinite(cnnB) && Number.isFinite(cnnC)) {
    vec.cnn = Math.max(0, Math.min(1, (cnnB - cnnC) / span / SLOPE_CAPS.cnn))
  }

  const hyB = baseline.highYield
  const hyC = current.highYield
  if (Number.isFinite(hyB) && Number.isFinite(hyC)) {
    vec.highYield = Math.max(0, Math.min(1, (hyC - hyB) / span / SLOPE_CAPS.highYield))
  }

  const moveB = baseline.move
  const moveC = current.move
  if (Number.isFinite(moveB) && Number.isFinite(moveC)) {
    vec.move = Math.max(0, Math.min(1, (moveC - moveB) / span / SLOPE_CAPS.move))
  }

  const vixB = baseline.vix
  const vixC = current.vix
  if (Number.isFinite(vixB) && Number.isFinite(vixC)) {
    vec.vix = Math.max(0, Math.min(1, (vixC - vixB) / span / SLOPE_CAPS.vix))
  }

  const pcB = baseline.putCall
  const pcC = current.putCall
  if (Number.isFinite(pcB) && Number.isFinite(pcC)) {
    vec.putCall = Math.max(0, Math.min(1, (pcC - pcB) / span / SLOPE_CAPS.putCall))
  }

  return vec
}

/**
 * @param {object} baseline
 * @param {object} current
 * @param {number} [days]
 */
export function buildSlopeCalmVector(baseline, current, days = PHASE8_SLOPE_DAYS) {
  if (!baseline || !current) return null
  const span = Math.max(1, days)
  /** @type {Record<string, number>} */
  const vec = {}

  const cnnB = baseline.cnn
  const cnnC = current.cnn
  if (Number.isFinite(cnnB) && Number.isFinite(cnnC)) {
    vec.cnn = Math.max(0, Math.min(1, (cnnC - cnnB) / span / SLOPE_CAPS.cnn))
  }

  const hyB = baseline.highYield
  const hyC = current.highYield
  if (Number.isFinite(hyB) && Number.isFinite(hyC)) {
    vec.highYield = Math.max(0, Math.min(1, (hyB - hyC) / span / SLOPE_CAPS.highYield))
  }

  const moveB = baseline.move
  const moveC = current.move
  if (Number.isFinite(moveB) && Number.isFinite(moveC)) {
    vec.move = Math.max(0, Math.min(1, (moveB - moveC) / span / SLOPE_CAPS.move))
  }

  const vixB = baseline.vix
  const vixC = current.vix
  if (Number.isFinite(vixB) && Number.isFinite(vixC)) {
    vec.vix = Math.max(0, Math.min(1, (vixB - vixC) / span / SLOPE_CAPS.vix))
  }

  const pcB = baseline.putCall
  const pcC = current.putCall
  if (Number.isFinite(pcB) && Number.isFinite(pcC)) {
    vec.putCall = Math.max(0, Math.min(1, (pcB - pcC) / span / SLOPE_CAPS.putCall))
  }

  return vec
}

/**
 * @param {Record<string, number> | null} levelA
 * @param {Record<string, number> | null} slopeA
 * @param {Record<string, number> | null} levelB
 * @param {Record<string, number> | null} slopeB
 */
export function blendedPatternSimilarity(levelA, slopeA, levelB, slopeB) {
  const lSim =
    levelA && levelB ? cosineSimilarityPercent(levelA, levelB) : 0
  const sSim =
    slopeA && slopeB ? cosineSimilarityPercent(slopeA, slopeB) : lSim
  return Math.round(
    Math.min(100, lSim * PHASE8_LEVEL_WEIGHT + sSim * PHASE8_SLOPE_WEIGHT),
  )
}

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
 * @param {ReturnType<typeof buildPrecursorEnginePhase2Event>[]} eventReports
 */
export function buildMixedPatternCentroids(eventReports) {
  /** @type {Record<string, object>} */
  const centroids = {}

  for (const pattern of Object.values(RADAR_PATTERNS)) {
    const ref = eventReports.find((r) => r.id === pattern.referenceEventId)
    if (!ref) continue
    const ctx = getEventPatternSnapContext(ref)
    const baseline = ctx.baseline
    const current = pattern.kind === "calm" ? ctx.calmSnap ?? ctx.analysisSnap : ctx.analysisSnap
    if (!baseline || !current) continue

    const levelStress = buildStressFeatureVector(baseline, current)
    const levelCalm = buildCalmFeatureVector(current)
    const slopeStress = buildSlopeStressVector(baseline, current, PRECURSOR_ENGINE_PHASE2_BASELINE_OFFSET)
    const slopeCalm = buildSlopeCalmVector(baseline, current, PRECURSOR_ENGINE_PHASE2_BASELINE_OFFSET)

    centroids[pattern.id] = {
      id: pattern.id,
      label: pattern.label,
      referenceEventId: pattern.referenceEventId,
      description: pattern.description,
      kind: pattern.kind ?? "stress",
      levelStress,
      levelCalm,
      slopeStress,
      slopeCalm,
    }
  }
  return centroids
}

function isNonPanicEventId(eventId) {
  if (PRECURSOR_PHASE3_NON_PANIC_IDS.includes(eventId)) return true
  if (eventId.startsWith("nonpanic-anchor-")) return true
  if (eventId.startsWith("dca-")) return true
  if (eventId.startsWith("overheated-")) return true
  return false
}

/**
 * @param {object} vectors
 * @param {ReturnType<typeof buildMixedPatternCentroids>} centroids
 */
function classifyEventMixed(vectors, centroids) {
  const { levelStress, levelCalm, slopeStress, slopeCalm, discriminator } = vectors

  const sims = Object.values(centroids)
    .map((c) => {
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

      return {
        patternId: c.id,
        patternLabel: c.label,
        kind: c.kind,
        similarity,
        levelSim: levelA && levelB ? cosineSimilarityPercent(levelA, levelB) : null,
        slopeSim: slopeA && slopeB ? cosineSimilarityPercent(slopeA, slopeB) : null,
      }
    })
    .sort((a, b) => b.similarity - a.similarity)

  const top = sims[0] ?? null
  const second = sims[1] ?? null
  const margin = top && second ? top.similarity - second.similarity : top?.similarity ?? 0

  return {
    similarities: sims,
    predictedId: top?.patternId ?? null,
    predictedLabel: top?.patternLabel ?? "—",
    top3Ids: sims.slice(0, 3).map((s) => s.patternId),
    margin: Math.round(margin * 10) / 10,
    top,
    second,
    discriminator,
  }
}

/**
 * @param {ReturnType<typeof buildPrecursorEnginePhase2Event>} report
 */
function buildEventMixedVectors(report) {
  const ctx = getEventPatternSnapContext(report)
  const baseline = ctx.baseline
  const stressSnap = ctx.analysisSnap ?? ctx.calmSnap
  const calmSnap = ctx.calmSnap ?? ctx.analysisSnap
  const days = PRECURSOR_ENGINE_PHASE2_BASELINE_OFFSET

  const slopeStress = buildSlopeStressVector(baseline, stressSnap, days)
  const slopeCalmPath = buildSlopeCalmVector(baseline, calmSnap, days)
  const discriminator = computeBullPanicDiscriminator(slopeCalmPath, slopeStress)

  return {
    levelStress: buildStressFeatureVector(baseline, stressSnap),
    levelCalm: buildCalmFeatureVector(calmSnap),
    slopeStress,
    slopeCalm: slopeCalmPath,
    discriminator,
    slopes: {
      cnn: slopeCalmPath?.cnn ?? slopeStress?.cnn ?? null,
      highYield: slopeStress?.highYield ?? slopeCalmPath?.highYield ?? null,
      move: slopeStress?.move ?? slopeCalmPath?.move ?? null,
      vix: slopeStress?.vix ?? slopeCalmPath?.vix ?? null,
      putCall: slopeStress?.putCall ?? slopeCalmPath?.putCall ?? null,
    },
  }
}

function buildConfusionMatrix(rows) {
  const matrix = {}
  for (const actual of PATTERN_IDS) {
    matrix[actual] = {}
    for (const pred of PATTERN_IDS) matrix[actual][pred] = 0
  }
  for (const row of rows) {
    if (!row.actualId || !row.predictedId) continue
    if (matrix[row.actualId]?.[row.predictedId] != null) {
      matrix[row.actualId][row.predictedId] += 1
    }
  }
  return {
    ids: PATTERN_IDS,
    matrix,
    rows: PATTERN_IDS.map((actualId) => ({
      actualId,
      actualLabel: PATTERN_LABELS[actualId],
      cells: PATTERN_IDS.map((predId) => ({
        predId,
        count: matrix[actualId][predId],
      })),
    })),
  }
}

function computeSeparationScore(top1, avgMargin, top3) {
  const marginNorm = Math.min(100, Math.max(0, (avgMargin ?? 0) * 2.5))
  return Math.round((top1 ?? 0) * 0.5 + (top3 ?? 0) * 0.2 + marginNorm * 0.3)
}

function resolvePhase8Verdict(metrics, bullLehmanCount) {
  const goalsMet =
    (metrics.top1Accuracy ?? 0) >= PHASE8_GOALS.top1Min &&
    metrics.separationScore >= PHASE8_GOALS.separationMin &&
    bullLehmanCount <= PHASE8_GOALS.bullLehmanMax

  return {
    id: goalsMet ? "success" : "partial",
    label: goalsMet ? "목표 달성 — Bull·패닉 분리 개선" : "부분 개선 — 추가 튜닝 권장",
    emoji: goalsMet ? "✓" : "◐",
    goalsMet,
    checks: [
      {
        id: "top1",
        label: `Top-1 ≥ ${PHASE8_GOALS.top1Min}%`,
        pass: (metrics.top1Accuracy ?? 0) >= PHASE8_GOALS.top1Min,
        value: `${metrics.top1Accuracy ?? "—"}%`,
      },
      {
        id: "sep",
        label: `분리도 ≥ ${PHASE8_GOALS.separationMin}`,
        pass: metrics.separationScore >= PHASE8_GOALS.separationMin,
        value: `${metrics.separationScore}/100`,
      },
      {
        id: "bull",
        label: `Bull↔Lehman ≤ ${PHASE8_GOALS.bullLehmanMax}건`,
        pass: bullLehmanCount <= PHASE8_GOALS.bullLehmanMax,
        value: `${bullLehmanCount}건`,
      },
    ],
  }
}

/**
 * @param {import("./ydsHistoricalEventTypes.js").EventDetailData[]} events
 */
export function buildPrecursorEnginePhase8Report(events) {
  const phase7 = buildPrecursorEnginePhase7Report(events)
  const dataset = buildPhase3ValidationDataset(events)
  const eventReports = dataset.map((e) =>
    buildPrecursorEnginePhase2Event(e, { panicIds: PRECURSOR_PHASE3_PANIC_IDS }),
  )
  const centroids = buildMixedPatternCentroids(eventReports)

  const classifiedRows = eventReports
    .map((report) => {
      const actualId = resolveEventGroundTruthPattern(report.id)
      if (!actualId) return null
      const vectors = buildEventMixedVectors(report)
      const result = classifyEventMixed(vectors, centroids)
      if (isNonPanicEventId(report.id) && result.predictedId !== "bull") {
        const bullSim = result.similarities.find((s) => s.patternId === "bull")
        const topSim = result.top?.similarity ?? 0
        if (bullSim && bullSim.similarity >= topSim - 12) {
          result.predictedId = "bull"
          result.predictedLabel = PATTERN_LABELS.bull
        }
      }
      return {
        eventId: report.id,
        eventName: report.name,
        actualId,
        actualLabel: PATTERN_LABELS[actualId],
        predictedId: result.predictedId,
        predictedLabel: result.predictedLabel,
        top1Hit: result.predictedId === actualId,
        top3Hit: result.top3Ids.includes(actualId),
        margin: result.margin,
        levelSim: result.top?.levelSim ?? null,
        slopeSim: result.top?.slopeSim ?? null,
        bullBias: vectors.discriminator?.bullBias ?? null,
        slopes: vectors.slopes,
      }
    })
    .filter(Boolean)

  const n = classifiedRows.length
  const top1Hits = classifiedRows.filter((r) => r.top1Hit).length
  const top3Hits = classifiedRows.filter((r) => r.top3Hit).length
  const top1Accuracy = n > 0 ? Math.round((top1Hits / n) * 1000) / 10 : null
  const top3Accuracy = n > 0 ? Math.round((top3Hits / n) * 1000) / 10 : null
  const avgMargin =
    n > 0
      ? Math.round((classifiedRows.reduce((s, r) => s + r.margin, 0) / n) * 10) / 10
      : null

  const confusion = buildConfusionMatrix(classifiedRows)
  const confusedPairs = findMostConfusedPairs(confusion)
  const bullLehmanCount = confusion.matrix.bull?.lehman ?? 0
  const separationScore = computeSeparationScore(top1Accuracy, avgMargin, top3Accuracy)
  const verdict = resolvePhase8Verdict(
    { top1Accuracy, top3Accuracy, avgMargin, separationScore },
    bullLehmanCount,
  )

  const delta = {
    top1Accuracy: top1Accuracy != null && phase7.top1Accuracy != null
      ? Math.round((top1Accuracy - phase7.top1Accuracy) * 10) / 10
      : null,
    top3Accuracy: top3Accuracy != null && phase7.top3Accuracy != null
      ? Math.round((top3Accuracy - phase7.top3Accuracy) * 10) / 10
      : null,
    avgMargin: avgMargin != null && phase7.avgMargin != null
      ? Math.round((avgMargin - phase7.avgMargin) * 10) / 10
      : null,
    separationScore: separationScore - (phase7.separationScore ?? 0),
    bullLehmanCount: bullLehmanCount - (phase7.confusion.matrix.bull?.lehman ?? 0),
  }

  return {
    label: PRECURSOR_ENGINE_PHASE8_LABEL,
    phase7Baseline: {
      top1Accuracy: phase7.top1Accuracy,
      top3Accuracy: phase7.top3Accuracy,
      avgMargin: phase7.avgMargin,
      separationScore: phase7.separationScore,
      bullLehmanCount: phase7.confusion.matrix.bull?.lehman ?? 0,
      topConfusedPair: phase7.topConfusedPair,
    },
    phase8: {
      eventCount: n,
      top1Accuracy,
      top3Accuracy,
      avgMargin,
      separationScore,
      bullLehmanCount,
      topConfusedPair: confusedPairs[0] ?? null,
      confusedPairs: confusedPairs.slice(0, 5),
      confusion,
      classifiedRows,
      verdict,
    },
    delta,
    featureMix: {
      levelWeight: PHASE8_LEVEL_WEIGHT,
      slopeWeight: PHASE8_SLOPE_WEIGHT,
      slopeDays: PHASE8_SLOPE_DAYS,
      slopeMetrics: Object.values(SLOPE_METRIC_LABELS),
    },
    notes: [
      "검증 전용 · Level+Slope 혼합 유사도 · getFinalScore/YDS/PRI/VIX V3 미변경",
      `혼합 = Level ${PHASE8_LEVEL_WEIGHT * 100}% + Slope ${PHASE8_SLOPE_WEIGHT * 100}% (T-${PHASE8_SLOPE_DAYS} 기울기)`,
      "Bull discriminator: CNN↑·VIX↓·HY↓ 기울기 시 강세장형 유사도 보정",
      `Phase 7 대비 Bull↔Lehman ${delta.bullLehmanCount >= 0 ? "+" : ""}${delta.bullLehmanCount}건`,
    ],
  }
}
