import {
  buildPrecursorEnginePhase2Event,
} from "./ydsPrecursorEnginePhase2.js"
import {
  buildPhase3ValidationDataset,
  PRECURSOR_PHASE3_PANIC_IDS,
  PRECURSOR_PHASE3_NON_PANIC_IDS,
} from "./ydsPrecursorPhase3EventCatalog.js"
import {
  RADAR_PATTERNS,
  buildCalmFeatureVector,
  buildRadarPatternCentroids,
  buildStressFeatureVector,
  computePatternSimilarities,
  getEventPatternSnapContext,
} from "./ydsPrecursorEnginePhase6.js"

export const PRECURSOR_ENGINE_PHASE7_LABEL =
  "YDS Precursor Engine — Phase 7 (Pattern Separation Validation)"

export const PATTERN_IDS = ["lehman", "covid", "tariff", "svb", "bull"]

export const PATTERN_LABELS = {
  lehman: "리먼형",
  covid: "코로나형",
  tariff: "관세형",
  svb: "SVB형",
  bull: "강세장형",
}

/** @type {Record<string, string>} */
const EVENT_GROUND_TRUTH = {
  "panic-2008-lehman": "lehman",
  "overheated-2000-dotcom": "lehman",
  "panic-2018-q4": "lehman",
  "panic-2015-china-deval": "lehman",
  "panic-2022-tightening": "lehman",
  "panic-2020-covid": "covid",
  "panic-2022-ukraine": "covid",
  "panic-2010-flash": "covid",
  "panic-2025-tariff-shock": "tariff",
  "interest-2018-trade-war": "tariff",
  "panic-2023-svb": "svb",
  "panic-2019-repo": "svb",
  "panic-2011-us-downgrade": "svb",
  "panic-2024-yen-carry": "svb",
  "interest-2016-brexit": "svb",
  "nonpanic-2024-bull-market": "bull",
  "nonpanic-2023-ai-rally": "bull",
  "nonpanic-2024-ath-breakout": "bull",
  "nonpanic-2025-bull-continuation": "bull",
  "nonpanic-current-market": "bull",
}

/**
 * @param {string} eventId
 */
export function resolveEventGroundTruthPattern(eventId) {
  if (EVENT_GROUND_TRUTH[eventId]) return EVENT_GROUND_TRUTH[eventId]
  if (PRECURSOR_PHASE3_NON_PANIC_IDS.includes(eventId)) return "bull"
  if (eventId.startsWith("nonpanic-anchor-")) return "bull"
  if (eventId.startsWith("dca-")) return "bull"
  if (eventId.startsWith("overheated-")) return "bull"
  if (eventId.startsWith("interest-")) return "svb"
  if (PRECURSOR_PHASE3_PANIC_IDS.includes(eventId)) return "covid"
  return null
}

/**
 * @param {ReturnType<typeof buildPrecursorEnginePhase2Event>} report
 */
function buildEventVectors(report) {
  const ctx = getEventPatternSnapContext(report)
  return {
    stress: buildStressFeatureVector(ctx.baseline, ctx.analysisSnap),
    calm: buildCalmFeatureVector(ctx.analysisSnap ?? ctx.calmSnap),
    snap: ctx.analysisSnap,
  }
}

/**
 * @param {ReturnType<typeof buildEventVectors>} vectors
 * @param {ReturnType<typeof buildRadarPatternCentroids>} centroids
 */
function classifyEvent(vectors, centroids) {
  const sims = computePatternSimilarities(vectors.stress, vectors.calm, centroids)
  const top = sims[0] ?? null
  const second = sims[1] ?? null
  const top3Ids = sims.slice(0, 3).map((s) => s.patternId)
  const margin = top && second ? top.similarity - second.similarity : top?.similarity ?? 0

  return {
    similarities: sims,
    predictedId: top?.patternId ?? null,
    predictedLabel: top?.patternLabel ?? "—",
    top3Ids,
    top1Similarity: top?.similarity ?? null,
    secondSimilarity: second?.similarity ?? null,
    margin: Math.round(margin * 10) / 10,
  }
}

/**
 * @param {ReturnType<typeof classifyEvent>[]} rows
 */
function buildConfusionMatrix(rows) {
  /** @type {Record<string, Record<string, number>>} */
  const matrix = {}
  for (const actual of PATTERN_IDS) {
    matrix[actual] = {}
    for (const pred of PATTERN_IDS) matrix[actual][pred] = 0
  }
  for (const row of rows) {
    if (!row.actualId || !row.predictedId) continue
    if (matrix[row.actualId] && row.predictedId in matrix[row.actualId]) {
      matrix[row.actualId][row.predictedId] += 1
    }
  }
  return {
    labels: PATTERN_IDS.map((id) => PATTERN_LABELS[id]),
    ids: PATTERN_IDS,
    matrix,
    rows: PATTERN_IDS.map((actualId) => ({
      actualId,
      actualLabel: PATTERN_LABELS[actualId],
      cells: PATTERN_IDS.map((predId) => ({
        predId,
        predLabel: PATTERN_LABELS[predId],
        count: matrix[actualId][predId],
      })),
    })),
  }
}

/**
 * @param {ReturnType<typeof buildConfusionMatrix>} confusion
 */
export function findMostConfusedPairs(confusion) {
  /** @type {{ pair: string; actualId: string; predId: string; count: number }[]} */
  const pairs = []
  for (const actualId of PATTERN_IDS) {
    for (const predId of PATTERN_IDS) {
      if (actualId === predId) continue
      const count = confusion.matrix[actualId][predId]
      if (count > 0) {
        pairs.push({
          pair: `${PATTERN_LABELS[actualId]} ↔ ${PATTERN_LABELS[predId]}`,
          actualId,
          predId,
          count,
        })
      }
    }
  }
  pairs.sort((a, b) => b.count - a.count)
  return pairs
}

/**
 * @param {number | null} top1Accuracy
 * @param {number | null} avgMargin
 * @param {number | null} top3Accuracy
 */
function computeSeparationScore(top1Accuracy, avgMargin, top3Accuracy) {
  const t1 = top1Accuracy ?? 0
  const t3 = top3Accuracy ?? 0
  const margin = avgMargin ?? 0
  const marginNorm = Math.min(100, Math.max(0, margin * 2.5))
  return Math.round(t1 * 0.5 + t3 * 0.2 + marginNorm * 0.3)
}

/**
 * @param {number} score
 * @param {number | null} top1Accuracy
 */
function resolveSeparationVerdict(score, top1Accuracy) {
  const pass = score >= 65 && (top1Accuracy ?? 0) >= 55
  return {
    id: pass ? "success" : "tuning",
    label: pass ? "A. 패턴 분리 성공" : "B. 추가 튜닝 필요",
    emoji: pass ? "✓" : "⚠",
    detail: pass
      ? "Top-1·Margin·분리도 기준 충족 — Pattern Radar 패턴 구분 유효"
      : "혼동 쌍·centroid·벡터 공간 재조정 권장",
  }
}

/**
 * @param {ReturnType<typeof buildRadarPatternCentroids>} centroids
 * @param {ReturnType<typeof buildPrecursorEnginePhase2Event>[]} eventReports
 */
function buildReferenceSelfMatchRows(centroids, eventReports) {
  return Object.values(RADAR_PATTERNS).map((pattern) => {
    const ref = eventReports.find((r) => r.id === pattern.referenceEventId)
    if (!ref) return null
    const vectors = buildEventVectors(ref)
    const sims = computePatternSimilarities(vectors.stress, vectors.calm, centroids)
    const own = sims.find((s) => s.patternId === pattern.id)
    const top = sims[0]
    const second = sims[1]
    return {
      patternId: pattern.id,
      patternLabel: pattern.label,
      referenceEventId: pattern.referenceEventId,
      referenceEventName: ref.name,
      selfSimilarity: own?.similarity ?? null,
      top1Match: top?.patternId === pattern.id,
      margin:
        top && second && top.patternId === pattern.id
          ? Math.round((top.similarity - second.similarity) * 10) / 10
          : null,
    }
  }).filter(Boolean)
}

/**
 * @param {import("./ydsHistoricalEventTypes.js").EventDetailData[]} events
 */
export function buildPrecursorEnginePhase7Report(events) {
  const dataset = buildPhase3ValidationDataset(events)
  const eventReports = dataset.map((e) =>
    buildPrecursorEnginePhase2Event(e, { panicIds: PRECURSOR_PHASE3_PANIC_IDS }),
  )
  const centroids = buildRadarPatternCentroids(eventReports)

  const classifiedRows = eventReports
    .map((report) => {
      const actualId = resolveEventGroundTruthPattern(report.id)
      if (!actualId) return null
      const vectors = buildEventVectors(report)
      const result = classifyEvent(vectors, centroids)
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
        top1Similarity: result.top1Similarity,
        secondSimilarity: result.secondSimilarity,
        similarities: result.similarities,
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
      ? Math.round(
          (classifiedRows.reduce((s, r) => s + (r.margin ?? 0), 0) / n) * 10,
        ) / 10
      : null

  const confusion = buildConfusionMatrix(classifiedRows)
  const confusedPairs = findMostConfusedPairs(confusion)
  const separationScore = computeSeparationScore(top1Accuracy, avgMargin, top3Accuracy)
  const verdict = resolveSeparationVerdict(separationScore, top1Accuracy)
  const referenceSelfMatch = buildReferenceSelfMatchRows(centroids, eventReports)

  return {
    label: PRECURSOR_ENGINE_PHASE7_LABEL,
    eventCount: n,
    top1Accuracy,
    top3Accuracy,
    avgMargin,
    separationScore,
    verdict,
    classifiedRows,
    referenceSelfMatch,
    confusion,
    confusedPairs: confusedPairs.slice(0, 5),
    topConfusedPair: confusedPairs[0] ?? null,
    notes: [
      "검증 전용 · Pattern Radar centroid·유사도 로직 재사용 · 프로덕션 미변경",
      "모든 이벤트 = Phase3 표본 · ground truth 라벨 매핑 · 자기 패턴 Top-1/Top-3 검증",
      "Reference self-match = 5 archetype 참조 이벤트 자기 centroid 유사도",
      "분리도 = Top-1 50% + Top-3 20% + Margin 30%",
    ],
  }
}
