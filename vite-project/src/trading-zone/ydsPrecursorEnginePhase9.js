import { computeYdsScore } from "./ydsHistoricalEventTypes.js"
import { computePriA, computePriB } from "./ydsPrecursorEnginePhase2.js"
import {
  buildPrecursorHistorySeries,
  interpolateSeriesAt,
  PRECURSOR_LIVE_BASELINE_DAYS,
} from "./ydsPrecursorEnginePhase3.js"
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
import { buildPrecursorEnginePhase2Event } from "./ydsPrecursorEnginePhase2.js"
import { offsetPrecursorDay, parsePrecursorDay } from "./ydsPrecursorInterpolation.js"
import { PATTERN_LABELS } from "./ydsPrecursorEnginePhase7.js"
import { regimeDisplayForId } from "./ydsPrecursorRegimeDisplay.js"

export const PRECURSOR_ENGINE_PHASE9_LABEL =
  "YDS Precursor Engine — Phase 9 (Pattern History & Regime Tracker)"

export const HISTORY_WINDOWS = [
  { id: 30, label: "30일" },
  { id: 90, label: "90일" },
  { id: 180, label: "180일" },
]

export const PATTERN_HISTORY_KEYS = [
  { key: "bullSimilarity", label: "Bull", color: "#22c55e" },
  { key: "lehmanSimilarity", label: "Lehman", color: "#dc2626" },
  { key: "covidSimilarity", label: "Covid", color: "#db2777" },
  { key: "tariffSimilarity", label: "Tariff", color: "#ea580c" },
  { key: "svbSimilarity", label: "SVB", color: "#ca8a04" },
]

const TREND_OFFSETS = [7, 30, 90]
const CALM_SNAP_OFFSET_DAYS = 21

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

/**
 * @param {ReturnType<typeof buildPrecursorHistorySeries>} series
 * @param {string} date
 */
function buildHistoryPoint(series, date, centroids) {
  const current = interpolateSeriesAt(series, date)
  const baselineDate = offsetPrecursorDay(date, -PRECURSOR_LIVE_BASELINE_DAYS)
  const baseline = interpolateSeriesAt(series, baselineDate)
  const calmDate = offsetPrecursorDay(date, -CALM_SNAP_OFFSET_DAYS)
  const calmSnap = interpolateSeriesAt(series, calmDate) ?? current
  if (!current || !baseline) return null

  const priA = computePriA(baseline, current)
  const priB = computePriB(current)
  const sims = computePointPatternSimilarities(baseline, current, calmSnap, centroids)

  const historyData = {
    date: current.date,
    vix: current.vix,
    cnn: current.cnn,
    bofa: current.bofa,
    putCall: current.putCall,
    highYield: current.highYield,
  }

  return {
    date: current.date.slice(0, 10),
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
 * @param {import("./ydsHistoricalEventTypes.js").EventDetailData[]} events
 * @param {{ latestSnapshot?: Record<string, unknown> | null; extraRows?: object[] }} [options]
 */
export function buildPatternHistoryStore(events, options = {}) {
  const dataset = buildPhase3ValidationDataset(events)
  const eventReports = dataset.map((e) =>
    buildPrecursorEnginePhase2Event(e, { panicIds: PRECURSOR_PHASE3_PANIC_IDS }),
  )
  const centroids = buildMixedPatternCentroids(eventReports)
  const series = buildPrecursorHistorySeries(options.latestSnapshot ?? null, options.extraRows)

  const history = series
    .map((s) => buildHistoryPoint(series, s.date, centroids))
    .filter(Boolean)

  return { history, centroids, seriesLength: series.length }
}

/**
 * @param {ReturnType<typeof buildHistoryPoint>[]} history
 * @param {number} days
 */
function sliceHistoryWindow(history, days) {
  if (!history.length) return []
  const endTs = parsePrecursorDay(history[history.length - 1].date)
  const startTs = endTs - days * 86_400_000
  return history.filter((h) => parsePrecursorDay(h.date) >= startTs)
}

/**
 * @param {ReturnType<typeof buildHistoryPoint>[]} history
 * @param {string} key
 */
function getValueAtOffset(history, key, offsetDays) {
  if (!history.length) return null
  const endDate = history[history.length - 1].date
  const targetDate = offsetPrecursorDay(endDate, -offsetDays)
  const endTs = parsePrecursorDay(endDate)
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
    if (ts <= targetTs && ts >= parsePrecursorDay(best.date)) best = row
  }
  const atEnd = history[history.length - 1]
  return {
    past: best[key],
    current: atEnd[key],
    pastDate: best.date,
    currentDate: atEnd.date,
  }
}

/**
 * @param {number | null} past
 * @param {number | null} current
 */
function formatDelta(past, current) {
  if (past == null || current == null || !Number.isFinite(past) || !Number.isFinite(current)) {
    return { delta: null, label: "—" }
  }
  const d = Math.round((current - past) * 10) / 10
  const sign = d > 0 ? "+" : ""
  return { delta: d, label: `${sign}${d}` }
}

/**
 * @param {ReturnType<typeof buildHistoryPoint>[]} history
 */
function buildSimilarityTrends(history) {
  return PATTERN_HISTORY_KEYS.map(({ key, label }) => {
    const trends = TREND_OFFSETS.map((days) => {
      const pair = getValueAtOffset(history, key, days)
      const { delta, label: deltaLabel } = formatDelta(pair?.past, pair?.current)
      return { days, delta, label: deltaLabel, past: pair?.past, current: pair?.current }
    })
    return { key, label, trends }
  })
}

/**
 * @param {ReturnType<typeof buildHistoryPoint>[]} history
 */
function buildPatternRotation(history) {
  const pair = getValueAtOffset(history, "bullSimilarity", 30)
  const end = history[history.length - 1]
  const startRow = history.find((h) => h.date === pair?.pastDate) ?? history[0]

  return PATTERN_HISTORY_KEYS.map(({ key, label }) => {
    const from = startRow?.[key]
    const to = end?.[key]
    const { delta, label: deltaLabel } = formatDelta(from, to)
    return {
      key,
      label,
      from,
      to,
      delta,
      deltaLabel,
      direction:
        delta == null
          ? "—"
          : delta > 5
            ? "↑"
            : delta < -5
              ? "↓"
              : "→",
    }
  }).sort((a, b) => Math.abs(b.delta ?? 0) - Math.abs(a.delta ?? 0))
}

/**
 * @param {ReturnType<typeof buildHistoryPoint>[]} history
 */
function resolveRegimeState(history) {
  const last = history[history.length - 1]
  if (!last) {
    return { id: "unknown", label: "—", emoji: "⚪", reason: "데이터 없음" }
  }

  const pri7 = getValueAtOffset(history, "priA", 7)
  const lehman7 = getValueAtOffset(history, "lehmanSimilarity", 7)
  const covid7 = getValueAtOffset(history, "covidSimilarity", 7)
  const bull7 = getValueAtOffset(history, "bullSimilarity", 7)

  const priDelta7 = (pri7?.current ?? 0) - (pri7?.past ?? 0)
  const panicSim =
    ((last.lehmanSimilarity ?? 0) + (last.covidSimilarity ?? 0) + (last.tariffSimilarity ?? 0)) / 3
  const panicDelta7 =
    ((lehman7?.current ?? 0) - (lehman7?.past ?? 0) +
      (covid7?.current ?? 0) - (covid7?.past ?? 0)) /
    2
  const bullDrop7 = (bull7?.past ?? 0) - (bull7?.current ?? 0)

  const topNow = [
    { id: "bull", sim: last.bullSimilarity },
    { id: "lehman", sim: last.lehmanSimilarity },
    { id: "covid", sim: last.covidSimilarity },
    { id: "tariff", sim: last.tariffSimilarity },
    { id: "svb", sim: last.svbSimilarity },
  ].sort((a, b) => (b.sim ?? 0) - (a.sim ?? 0))

  const topPast = [
    { id: "bull", sim: startRowSim(history, 30, "bullSimilarity") },
    { id: "lehman", sim: startRowSim(history, 30, "lehmanSimilarity") },
    { id: "covid", sim: startRowSim(history, 30, "covidSimilarity") },
    { id: "tariff", sim: startRowSim(history, 30, "tariffSimilarity") },
    { id: "svb", sim: startRowSim(history, 30, "svbSimilarity") },
  ].sort((a, b) => (b.sim ?? 0) - (a.sim ?? 0))

  const regimeShift = topNow[0]?.id !== topPast[0]?.id

  if ((last.priA ?? 0) >= 55 || (last.priB ?? 0) >= 55 || (panicSim >= 60 && priDelta7 >= 5)) {
    return regimeDisplayForId("panic", {
      reason: `PRI-A ${last.priA} · 패닉 유사도 ${Math.round(panicSim)}% · 7일 PRI Δ${Math.round(priDelta7)}`,
    })
  }
  if (priDelta7 >= 6 || panicDelta7 >= 12 || bullDrop7 >= 15) {
    return regimeDisplayForId("risk", {
      reason: `7일 PRI-A Δ${Math.round(priDelta7)} · 패닉유사도 Δ${Math.round(panicDelta7)}`,
    })
  }
  if (regimeShift || Math.abs(priDelta7) >= 4) {
    return regimeDisplayForId("transition", {
      reason: `우세패턴 ${PATTERN_LABELS[topPast[0]?.id] ?? "—"} → ${PATTERN_LABELS[topNow[0]?.id] ?? "—"}`,
    })
  }
  return regimeDisplayForId("stable", {
    reason: `우세 ${PATTERN_LABELS[topNow[0]?.id] ?? "—"} 유지 · PRI·유사도 안정`,
  })
}

function startRowSim(history, offsetDays, key) {
  const pair = getValueAtOffset(history, key, offsetDays)
  return pair?.past ?? null
}

/**
 * @param {ReturnType<typeof buildHistoryPoint>[]} history
 */
function buildSummaryCard(history) {
  const last = history[history.length - 1]
  if (!last) return null

  const ranked = PATTERN_HISTORY_KEYS.map(({ key, label }) => ({
    key,
    label,
    similarity: last[key],
  })).sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0))

  const pri30 = getValueAtOffset(history, "priA", 30)
  const regime = resolveRegimeState(history)
  const rotation = buildPatternRotation(history)
  const topMove = rotation[0]

  return {
    dominantPattern: ranked[0]?.label ?? "—",
    dominantSimilarity: ranked[0]?.similarity ?? null,
    secondPattern: ranked[1]?.label ?? "—",
    secondSimilarity: ranked[1]?.similarity ?? null,
    priA: last.priA,
    priB: last.priB,
    priAChange30d: formatDelta(pri30?.past, pri30?.current).label,
    regimeChanged: regime.id === "transition" || regime.id === "risk" || regime.id === "panic",
    regime,
    topRotation: topMove
      ? `${topMove.label} ${topMove.from ?? "—"} → ${topMove.to ?? "—"} (${topMove.deltaLabel})`
      : "—",
    asOf: last.date,
  }
}

/**
 * @param {import("./ydsHistoricalEventTypes.js").EventDetailData[]} events
 * @param {{ latestSnapshot?: Record<string, unknown> | null; extraRows?: object[]; windowDays?: number }} [options]
 */
export function buildPrecursorEnginePhase9Report(events, options = {}) {
  const windowDays = options.windowDays ?? 180
  const store = buildPatternHistoryStore(events, options)
  const fullHistory = store.history
  const windowHistory = sliceHistoryWindow(fullHistory, windowDays)

  const regime = resolveRegimeState(windowHistory.length ? windowHistory : fullHistory)
  const summary = buildSummaryCard(windowHistory.length ? windowHistory : fullHistory)

  return {
    label: PRECURSOR_ENGINE_PHASE9_LABEL,
    storeMeta: {
      seriesLength: store.seriesLength,
      historyPoints: fullHistory.length,
      windowDays,
      windowPoints: windowHistory.length,
    },
    fullHistory,
    windows: {
      30: sliceHistoryWindow(fullHistory, 30),
      90: sliceHistoryWindow(fullHistory, 90),
      180: sliceHistoryWindow(fullHistory, 180),
    },
    similarityTrends: buildSimilarityTrends(fullHistory),
    patternRotation: buildPatternRotation(fullHistory),
    regime,
    summary,
    notes: [
      "검증 전용 시계열 · Phase 6/8 로직 재사용 · getFinalScore/PRI-A/B 엔진 미변경",
      "YDS = milestone 동일 입력으로 computeYdsScore(읽기 전용)",
      "패턴 유사도 = Level+Slope 혼합(Phase 8)",
      "Regime = PRI 변화율 + 패닉유사도 변화율 + 우세패턴 전환",
    ],
  }
}
