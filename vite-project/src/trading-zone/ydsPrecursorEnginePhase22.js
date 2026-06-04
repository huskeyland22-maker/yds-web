import { computeYdsScore, formatMetric } from "./ydsHistoricalEventTypes.js"
import {
  buildPrecursorEnginePhase2Event,
  PRECURSOR_ENGINE_PHASE2_T_OFFSETS,
} from "./ydsPrecursorEnginePhase2.js"
import { buildPrecursorLivePriCards } from "./ydsPrecursorEnginePhase3.js"
import {
  buildPrecursorEnginePhase6Report,
  buildRadarPatternCentroids,
  cosineSimilarityPercent,
} from "./ydsPrecursorEnginePhase6.js"
import {
  buildPhase3ValidationDataset,
  PRECURSOR_PHASE3_PANIC_IDS,
} from "./ydsPrecursorPhase3EventCatalog.js"
import { buildTimeMachineEventReport } from "./ydsPrecursorEnginePhase20.js"
import { PATTERN_LABELS } from "./ydsPrecursorEnginePhase7.js"

export const PRECURSOR_ENGINE_PHASE22_LABEL =
  "YDS Precursor Engine — Phase 22 (Live Market Comparison)"

export const LIVE_COMPARISON_EVENTS = [
  { id: "tariff", eventId: "panic-2025-tariff-shock", shortLabel: "관세쇼크", emoji: "📜" },
  { id: "lehman", eventId: "panic-2008-lehman", shortLabel: "리먼쇼크", emoji: "🏦" },
  { id: "covid", eventId: "panic-2020-covid", shortLabel: "코로나", emoji: "😱" },
  { id: "svb", eventId: "panic-2023-svb", shortLabel: "SVB", emoji: "🏛️" },
  { id: "yen_carry", eventId: "panic-2024-yen-carry", shortLabel: "엔캐리", emoji: "💴" },
  { id: "brexit", eventId: "interest-2016-brexit", shortLabel: "브렉시트", emoji: "🇬🇧" },
  { id: "repo", eventId: "panic-2019-repo", shortLabel: "Repo Shock", emoji: "🏦" },
  { id: "q4_2018", eventId: "panic-2018-q4", shortLabel: "2018 Q4", emoji: "📉" },
]

const DNA_PATTERN_IDS = ["tariff", "lehman", "svb", "covid"]

const DNA_PATTERN_LABELS = {
  tariff: "관세형",
  lehman: "리먼형",
  svb: "SVB형",
  covid: "코로나형",
}

const MEDAL = ["🥇", "🥈", "🥉"]

/**
 * @param {number | null | undefined} v
 * @param {number} lo
 * @param {number} hi
 */
function norm01(v, lo, hi) {
  if (v == null || !Number.isFinite(v)) return 0
  return Math.max(0, Math.min(1, (v - lo) / (hi - lo)))
}

/**
 * @param {object} state
 */
function buildMarketStateVector(state) {
  return {
    vix: norm01(state.vix, 12, 55),
    cnn: norm01(55 - (state.cnn ?? 50), 0, 45),
    hy: norm01(state.highYield, 3, 8),
    putCall: norm01(state.putCall, 0.72, 1.12),
    bofa: norm01(7 - (state.bofa ?? 5), 0, 4),
    priA: norm01(state.priA, 0, 100),
    priB: norm01(state.priB, 0, 100),
    yds: norm01(state.ydsScore, 0, 100),
  }
}

/**
 * @param {ReturnType<typeof buildMarketStateVector>} liveVec
 * @param {object} frame
 */
function similarityToFrame(liveVec, frame) {
  const frameVec = buildMarketStateVector({
    vix: frame.vix,
    cnn: frame.cnn,
    highYield: frame.highYield,
    putCall: frame.putCall,
    bofa: frame.bofa,
    priA: frame.priA,
    priB: frame.priB,
    ydsScore: frame.ydsScore,
  })
  return cosineSimilarityPercent(liveVec, frameVec)
}

/**
 * @param {number[]} values
 */
function average(values) {
  const finite = values.filter((v) => v != null && Number.isFinite(v))
  if (finite.length === 0) return null
  return Math.round((finite.reduce((a, b) => a + b, 0) / finite.length) * 10) / 10
}

/**
 * @param {{ eventId: string; offsetDays: number; similarity: number }[]} topEvents
 * @param {import("./ydsHistoricalEventTypes.js").EventDetailData[]} dataset
 */
function buildHistoricalOutcomes(topEvents, dataset) {
  const byId = new Map(dataset.map((e) => [e.id, e]))

  /** @type {Record<"m1"|"m3"|"m6"|"m12", { scale: number; field: "after6mSp500Pct" | "after12mSp500Pct" }>} */
  const horizonSpec = {
    m1: { scale: 0.2, field: "after6mSp500Pct" },
    m3: { scale: 0.45, field: "after6mSp500Pct" },
    m6: { scale: 1, field: "after6mSp500Pct" },
    m12: { scale: 1, field: "after12mSp500Pct" },
  }

  return (["m1", "m3", "m6", "m12"]).map((key) => {
    const spec = horizonSpec[key]
    /** @type {number[]} */
    const returns = []
    /** @type {number[]} */
    const mdds = []

    for (const match of topEvents) {
      const event = byId.get(match.eventId)
      if (!event?.marketPerformance) continue
      const mp = event.marketPerformance
      const base = mp[spec.field]
      if (base != null && Number.isFinite(base)) {
        const t = match.offsetDays / 28
        const adjusted = base * spec.scale * (0.55 + 0.45 * (1 - t))
        returns.push(Math.round(adjusted * 10) / 10)
      }
      if (mp.maxDrawdownPct != null && Number.isFinite(mp.maxDrawdownPct)) {
        mdds.push(mp.maxDrawdownPct * (0.5 + 0.5 * (match.offsetDays / 28)))
      }
    }

    const winRate =
      returns.length > 0
        ? Math.round((returns.filter((r) => r > 0).length / returns.length) * 1000) / 10
        : null

    return {
      horizon: key,
      label: key.toUpperCase(),
      avgReturn: average(returns),
      winRate,
      maxMdd: mdds.length > 0 ? Math.round(Math.min(...mdds) * 10) / 10 : null,
      sampleCount: returns.length,
    }
  })
}

/**
 * @param {import("./ydsHistoricalEventTypes.js").EventDetailData[]} events
 * @param {{ latestSnapshot?: Record<string, unknown> | null }} [options]
 */
export function buildPrecursorEnginePhase22Report(events, options = {}) {
  const dataset = buildPhase3ValidationDataset(events)
  const byId = new Map(dataset.map((e) => [e.id, e]))

  const eventReports = dataset.map((e) =>
    buildPrecursorEnginePhase2Event(e, { panicIds: PRECURSOR_PHASE3_PANIC_IDS }),
  )
  const centroids = buildRadarPatternCentroids(eventReports)

  const livePri = buildPrecursorLivePriCards(options.latestSnapshot ?? null)
  const snap = livePri.snapshot
  const baseline = livePri.baseline30

  const historyData = snap
    ? {
        vix: snap.vix,
        cnn: snap.cnn,
        bofa: snap.bofa,
        putCall: snap.putCall,
        highYield: snap.highYield,
      }
    : null
  const ydsScore = historyData ? computeYdsScore(historyData) : null

  const liveState = {
    vix: snap?.vix ?? null,
    cnn: snap?.cnn ?? null,
    bofa: snap?.bofa ?? null,
    putCall: snap?.putCall ?? null,
    highYield: snap?.highYield ?? null,
    priA: livePri.priA,
    priB: livePri.priB,
    ydsScore,
    asOf: livePri.asOf,
    baselineDate: baseline?.date ?? null,
  }

  const liveVec = buildMarketStateVector(liveState)
  const hasLive = snap != null

  const phase6 = buildPrecursorEnginePhase6Report(events, { latestSnapshot: options.latestSnapshot ?? null })

  const marketDna = DNA_PATTERN_IDS.map((patternId) => {
    const match = phase6.patternSimilarity.find((p) => p.patternId === patternId)
    return {
      patternId,
      label: DNA_PATTERN_LABELS[patternId] ?? PATTERN_LABELS[patternId] ?? patternId,
      similarity: match?.similarity ?? 0,
    }
  }).sort((a, b) => b.similarity - a.similarity)

  /** @type {Array<{ spec: typeof LIVE_COMPARISON_EVENTS[number]; eventId: string; name: string; bestOffset: number; bestOffsetLabel: string; similarity: number; framesCompared: number }>} */
  const eventMatches = []

  /** @type {{ eventId: string; shortLabel: string; emoji: string; offsetDays: number; offsetLabel: string; similarity: number } | null} */
  let globalBest = null

  for (const spec of LIVE_COMPARISON_EVENTS) {
    const event = byId.get(spec.eventId)
    if (!event) {
      eventMatches.push({
        spec,
        eventId: spec.eventId,
        name: spec.shortLabel,
        bestOffset: 0,
        bestOffsetLabel: "—",
        similarity: 0,
        framesCompared: 0,
      })
      continue
    }

    const tmReport = buildTimeMachineEventReport(event, centroids)
    let bestSim = -1
    let bestFrame = tmReport.frames[0] ?? null

    for (const frame of tmReport.frames) {
      const sim = hasLive ? similarityToFrame(liveVec, frame) : 0
      if (sim > bestSim) {
        bestSim = sim
        bestFrame = frame
      }
    }

    const match = {
      spec,
      eventId: spec.eventId,
      name: event.name,
      shortLabel: spec.shortLabel,
      emoji: spec.emoji,
      bestOffset: bestFrame?.offsetDays ?? 0,
      bestOffsetLabel: bestFrame?.offsetLabel ?? "T-0",
      similarity: Math.max(0, bestSim),
      framesCompared: tmReport.frames.length,
    }
    eventMatches.push(match)

    if (!globalBest || match.similarity > globalBest.similarity) {
      globalBest = {
        eventId: spec.eventId,
        shortLabel: spec.shortLabel,
        emoji: spec.emoji,
        offsetDays: match.bestOffset,
        offsetLabel: match.bestOffsetLabel,
        similarity: match.similarity,
      }
    }
  }

  const sortedEvents = [...eventMatches].sort((a, b) => b.similarity - a.similarity)
  const topSimilarEvents = sortedEvents.slice(0, 3).map((m, i) => ({
    rank: i + 1,
    medal: MEDAL[i] ?? `${i + 1}`,
    eventId: m.eventId,
    shortLabel: m.spec.shortLabel,
    emoji: m.spec.emoji,
    name: m.name,
    similarity: m.similarity,
    mappedOffset: m.bestOffset,
    mappedOffsetLabel: m.bestOffsetLabel,
  }))

  const currentPosition = globalBest
    ? {
        offsetDays: globalBest.offsetDays,
        offsetLabel: globalBest.offsetLabel,
        similarity: globalBest.similarity,
        eventId: globalBest.eventId,
        eventLabel: globalBest.shortLabel,
        eventEmoji: globalBest.emoji,
        timeline: PRECURSOR_ENGINE_PHASE2_T_OFFSETS.map((off) => ({
          offsetDays: off,
          offsetLabel: off === 0 ? "T-0" : `T-${off}`,
          active: off === globalBest.offsetDays,
        })),
      }
    : null

  const outcomeMatches = topSimilarEvents.map((e) => ({
    eventId: e.eventId,
    offsetDays: e.mappedOffset,
    similarity: e.similarity,
  }))
  const historicalOutcomes = buildHistoricalOutcomes(outcomeMatches, dataset)

  return {
    meta: {
      label: PRECURSOR_ENGINE_PHASE22_LABEL,
      asOf: liveState.asOf,
      hasLive,
      comparisonEventCount: LIVE_COMPARISON_EVENTS.length,
      offsets: [...PRECURSOR_ENGINE_PHASE2_T_OFFSETS],
    },
    liveState,
    topSimilarEvents,
    currentPosition,
    historicalOutcomes,
    marketDna,
    allEventMatches: sortedEvents,
    phase6TopPattern: phase6.top3[0] ?? null,
    notes: [
      "Phase 2·6·20 읽기 전용 · 현재 스냅샷·PRI·YDS 기반 파생 비교",
      "이벤트 유사도 = live 지표 벡터 vs 역사 이벤트 T-28~T-0 프레임 코사인 유사도",
      "Historical Outcome = Top 3 유사 이벤트 marketPerformance 기반 추정(검증용)",
      "Phase 0~21 엔진·getFinalScore·PRI 공식 미수정",
    ],
  }
}

export function formatComparisonPct(value) {
  if (value == null || !Number.isFinite(value)) return "—"
  return `${formatMetric(value)}%`
}
