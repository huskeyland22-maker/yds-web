import { resolveMacroV1Status } from "../panic-v2/panicMacroV1Status.js"
import {
  getDynamicWeights,
  getMidScore,
  scorePutCall,
  scoreVIX,
} from "../utils/tradingScores.js"
import { canComputeYds, computeYdsScore } from "./ydsHistoricalEventTypes.js"
import { YDS_MILESTONE_ORDER, YDS_MILESTONE_STEP_LABEL } from "./ydsHistoricalEventTypes.js"
import { historyDataToPanicPayload } from "./ydsScoreBreakdown.js"
import { PANIC_PEAK_RANKING_IDS } from "./ydsPanicPeakRankingReport.js"
import { resolveExperimentalYdsStage } from "./ydsScoreStageSimulation.js"

/** 실험 A: VIX 극단 구간 앵커 (40 이상 — 캡 대신 차등 반영) */
export const VIX_EXPERIMENT_ANCHORS = [
  { vix: 12, score: 0 },
  { vix: 40, score: 100 },
  { vix: 50, score: 110 },
  { vix: 60, score: 120 },
  { vix: 70, score: 135 },
  { vix: 80, score: 150 },
]

export const VIX_EXPERIMENT_NOTE =
  "실험 A: VIX 40+=100 캡 해제 · 40→100 · 50→110 · 60→120 · 70→135 · 80→150 (선형 보간) · getFinalScore 미수정"

const HISTORIC_PANIC_MIN = 85
const CURRENT_PANIC_BUY_MIN = 80

function toNum(x) {
  if (x === null || x === undefined || x === "") return NaN
  const n = Number(x)
  return Number.isFinite(n) ? n : NaN
}

/** @param {number | null | undefined} vix */
export function scoreVIXExperimental(vix) {
  const v = toNum(vix)
  if (!Number.isFinite(v)) return 50

  const anchors = VIX_EXPERIMENT_ANCHORS
  if (v <= anchors[0].vix) return anchors[0].score
  const last = anchors[anchors.length - 1]
  if (v >= last.vix) return last.score

  for (let i = 0; i < anchors.length - 1; i += 1) {
    const a = anchors[i]
    const b = anchors[i + 1]
    if (v >= a.vix && v <= b.vix) {
      const t = (v - a.vix) / (b.vix - a.vix)
      return a.score + t * (b.score - a.score)
    }
  }
  return 50
}

/** @param {number | null | undefined} vix @param {number | null | undefined} putCall */
export function getExperimentalShortScore(vix, putCall) {
  const raw = scoreVIXExperimental(vix) * 0.6 + scorePutCall(putCall) * 0.4
  return Math.round(raw)
}

/**
 * getFinalScore와 동일 경로 · VIX 단기 점수만 실험안 적용 · 상한 100 미적용
 * @param {{ vix?: number; putCall?: number; fearGreed?: number; bofa?: number; highYield?: number }} data
 */
export function getExperimentalFinalScore(data) {
  const short = getExperimentalShortScore(data.vix, data.putCall)
  const mid = getMidScore(data.fearGreed, data.bofa, data.highYield)
  const { wShort, wMid } = getDynamicWeights(data.vix, data.highYield)
  const raw = short * wShort + mid * wMid
  return Math.round(Math.max(0, raw))
}

/**
 * @param {import("./ydsHistoricalEventTypes.js").MilestoneIndicatorData | Record<string, unknown>} historyData
 */
export function computeExperimentalYdsScore(historyData) {
  if (!canComputeYds(historyData)) return null
  const payload = historyDataToPanicPayload(historyData)
  return getExperimentalFinalScore(payload)
}

/**
 * @param {import("./ydsHistoricalEventTypes.js").MilestoneIndicatorData | Record<string, unknown>} historyData
 */
export function buildVixSensitivitySnapshot(historyData) {
  if (!canComputeYds(historyData)) {
    return { computable: false, currentYds: null, experimentalYds: null, delta: null, vix: null }
  }
  const payload = historyDataToPanicPayload(historyData)
  const currentYds = computeYdsScore(historyData)
  const experimentalYds = getExperimentalFinalScore(payload)
  const vix = toNum(payload.vix)
  return {
    computable: true,
    currentYds,
    experimentalYds,
    delta: experimentalYds != null && currentYds != null ? experimentalYds - currentYds : null,
    vix: Number.isFinite(vix) ? vix : null,
    scoreVixCurrent: scoreVIX(payload.vix),
    scoreVixExperimental: scoreVIXExperimental(payload.vix),
  }
}

/**
 * @param {import("./ydsHistoricalEventTypes.js").EventDetailData} event
 */
export function buildVixSensitivityEventRow(event) {
  const snapshots = YDS_MILESTONE_ORDER.map((key) => {
    const milestone = event?.milestones?.[key]
    const snap = buildVixSensitivitySnapshot(milestone?.historyData ?? {})
    return {
      key,
      label: YDS_MILESTONE_STEP_LABEL[key],
      date: milestone?.date ?? null,
      ...snap,
    }
  }).filter((s) => s.computable)

  const peakCurrent =
    snapshots.length > 0
      ? snapshots.reduce((best, cur) => ((cur.currentYds ?? 0) > (best.currentYds ?? 0) ? cur : best), snapshots[0])
      : null
  const peakExperimental =
    snapshots.length > 0
      ? snapshots.reduce(
          (best, cur) => ((cur.experimentalYds ?? 0) > (best.experimentalYds ?? 0) ? cur : best),
          snapshots[0],
        )
      : null

  const currentMaxYds = peakCurrent?.currentYds ?? null
  const experimentalMaxYds = peakExperimental?.experimentalYds ?? null
  const delta =
    currentMaxYds != null && experimentalMaxYds != null ? experimentalMaxYds - currentMaxYds : null

  return {
    id: event.id,
    name: event.name,
    currentMaxYds,
    experimentalMaxYds,
    delta,
    peakMilestone: peakExperimental?.label ?? peakCurrent?.label ?? null,
    peakDate: peakExperimental?.date ?? peakCurrent?.date ?? null,
    currentStage: resolveMacroV1Status(currentMaxYds),
    experimentalStageCurrentBands: resolveMacroV1Status(experimentalMaxYds),
    experimentalHistoricStage: resolveExperimentalYdsStage(experimentalMaxYds),
    snapshots,
    ydsComputable: snapshots.length > 0,
  }
}

function gapBetween(rows, idA, idB, field) {
  const a = rows.find((r) => r.id === idA)
  const b = rows.find((r) => r.id === idB)
  if (!a?.[field] || !b?.[field]) return null
  return a[field] - b[field]
}

/**
 * @param {import("./ydsHistoricalEventTypes.js").EventDetailData[]} events
 */
export function buildVixSensitivityLabReport(events) {
  const rows = events
    .filter((e) => PANIC_PEAK_RANKING_IDS.includes(e.id))
    .map(buildVixSensitivityEventRow)
    .filter((r) => r.ydsComputable)
    .sort((a, b) => (b.experimentalMaxYds ?? 0) - (a.experimentalMaxYds ?? 0))
    .map((row, idx) => ({ ...row, rankExperimental: idx + 1 }))

  const lehman = rows.find((r) => r.id === "panic-2008-lehman")
  const covid = rows.find((r) => r.id === "panic-2020-covid")
  const yen = rows.find((r) => r.id === "panic-2024-yen-carry")

  const gapAnalysis = {
    lehmanMinusCovid: {
      current: gapBetween(rows, "panic-2008-lehman", "panic-2020-covid", "currentMaxYds"),
      experimental: gapBetween(rows, "panic-2008-lehman", "panic-2020-covid", "experimentalMaxYds"),
    },
    covidMinusYen: {
      current: gapBetween(rows, "panic-2020-covid", "panic-2024-yen-carry", "currentMaxYds"),
      experimental: gapBetween(rows, "panic-2020-covid", "panic-2024-yen-carry", "experimentalMaxYds"),
    },
    lehmanMinusYen: {
      current: gapBetween(rows, "panic-2008-lehman", "panic-2024-yen-carry", "currentMaxYds"),
      experimental: gapBetween(rows, "panic-2008-lehman", "panic-2024-yen-carry", "experimentalMaxYds"),
    },
    orderPreserved:
      (lehman?.experimentalMaxYds ?? 0) > (covid?.experimentalMaxYds ?? 0) &&
      (covid?.experimentalMaxYds ?? 0) > (yen?.experimentalMaxYds ?? 0),
    lehmanCovidGapWidened:
      gapBetween(rows, "panic-2008-lehman", "panic-2020-covid", "experimentalMaxYds") >
      gapBetween(rows, "panic-2008-lehman", "panic-2020-covid", "currentMaxYds"),
    covidYenGapWidened:
      gapBetween(rows, "panic-2020-covid", "panic-2024-yen-carry", "experimentalMaxYds") >
      gapBetween(rows, "panic-2020-covid", "panic-2024-yen-carry", "currentMaxYds"),
    spanWidened:
      gapBetween(rows, "panic-2008-lehman", "panic-2024-yen-carry", "experimentalMaxYds") >
      gapBetween(rows, "panic-2008-lehman", "panic-2024-yen-carry", "currentMaxYds"),
  }
  gapAnalysis.gapsWidened =
    gapAnalysis.lehmanCovidGapWidened && gapAnalysis.covidYenGapWidened

  const historicPanicEvents = rows.filter((r) => (r.experimentalMaxYds ?? 0) >= HISTORIC_PANIC_MIN)
  const panicBuyEvents = rows.filter((r) => (r.experimentalMaxYds ?? 0) >= CURRENT_PANIC_BUY_MIN)

  const validationGoals = {
    orderPreserved: gapAnalysis.orderPreserved,
    gapsWidened: gapAnalysis.gapsWidened,
    spanWidened: gapAnalysis.spanWidened,
    covidYenGapWidened: gapAnalysis.covidYenGapWidened,
    gapAnalysis,
    historicPanic: {
      threshold: HISTORIC_PANIC_MIN,
      exists: historicPanicEvents.length > 0,
      count: historicPanicEvents.length,
      events: historicPanicEvents.map((e) => ({
        name: e.name,
        score: e.experimentalMaxYds,
        stage: e.experimentalHistoricStage?.label ?? null,
      })),
    },
    panicBuy: {
      threshold: CURRENT_PANIC_BUY_MIN,
      exists: panicBuyEvents.length > 0,
      count: panicBuyEvents.length,
      events: panicBuyEvents.map((e) => ({
        name: e.name,
        score: e.experimentalMaxYds,
        stage: e.experimentalStageCurrentBands?.label ?? null,
      })),
    },
  }

  return {
    rows,
    validationGoals,
    notes: [
      VIX_EXPERIMENT_NOTE,
      "실험 B: 리먼·코로나·긴축·SVB·엔캐리·관세 — 이벤트 내 milestone 최고 YDS 비교.",
      "getFinalScore·VIX 캡·HY 가중·현재 구간 체계는 프로덕션 그대로. 실험 점수만 별도 산출.",
    ],
  }
}

export { HISTORIC_PANIC_MIN, CURRENT_PANIC_BUY_MIN }
