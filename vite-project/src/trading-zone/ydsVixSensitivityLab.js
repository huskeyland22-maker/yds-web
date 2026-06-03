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

/** @typedef {{ vix: number; score: number }} VixScoreAnchor */

/** 실험 V1: VIX 극단 구간 (기존) */
/** @type {VixScoreAnchor[]} */
export const VIX_EXPERIMENT_V1_ANCHORS = [
  { vix: 12, score: 0 },
  { vix: 40, score: 100 },
  { vix: 50, score: 110 },
  { vix: 60, score: 120 },
  { vix: 70, score: 135 },
  { vix: 80, score: 150 },
]

/** 실험 V2: 가파른 비선형 (앵커 선형 보간) */
/** @type {VixScoreAnchor[]} */
export const VIX_EXPERIMENT_V2_ANCHORS = [
  { vix: 12, score: 0 },
  { vix: 40, score: 100 },
  { vix: 50, score: 115 },
  { vix: 60, score: 135 },
  { vix: 70, score: 155 },
  { vix: 80, score: 180 },
]

/** @deprecated V1 별칭 */
export const VIX_EXPERIMENT_ANCHORS = VIX_EXPERIMENT_V1_ANCHORS

export const VIX_EXPERIMENT_V1_NOTE =
  "V1: 40→100 · 50→110 · 60→120 · 70→135 · 80→150 (선형 보간 · 40+ 캡 해제)"

export const VIX_EXPERIMENT_V2_NOTE =
  "V2: 40→100 · 50→115 · 60→135 · 70→155 · 80→180 (가파른 비선형 · 선형 보간)"

export const VIX_EXPERIMENT_NOTE = VIX_EXPERIMENT_V1_NOTE

const HISTORIC_PANIC_MIN = 85
const CURRENT_PANIC_BUY_MIN = 80

const NATURAL_ORDER_IDS = [
  "panic-2008-lehman",
  "panic-2020-covid",
  "panic-2025-tariff-shock",
  "panic-2024-yen-carry",
]

const FINAL_REPORT_IDS = [
  "panic-2008-lehman",
  "panic-2020-covid",
  "panic-2025-tariff-shock",
  "panic-2024-yen-carry",
]

function toNum(x) {
  if (x === null || x === undefined || x === "") return NaN
  const n = Number(x)
  return Number.isFinite(n) ? n : NaN
}

/**
 * @param {number | null | undefined} vix
 * @param {VixScoreAnchor[]} anchors
 */
export function scoreVIXFromAnchors(vix, anchors) {
  const v = toNum(vix)
  if (!Number.isFinite(v)) return 50
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

/** @param {number | null | undefined} vix */
export function scoreVIXExperimentalV1(vix) {
  return scoreVIXFromAnchors(vix, VIX_EXPERIMENT_V1_ANCHORS)
}

/** @param {number | null | undefined} vix */
export function scoreVIXExperimentalV2(vix) {
  return scoreVIXFromAnchors(vix, VIX_EXPERIMENT_V2_ANCHORS)
}

/** @deprecated V1 별칭 */
export function scoreVIXExperimental(vix) {
  return scoreVIXExperimentalV1(vix)
}

/**
 * @param {number | null | undefined} vix
 * @param {number | null | undefined} putCall
 * @param {VixScoreAnchor[]} anchors
 */
function getVixVariantShortScore(vix, putCall, anchors) {
  const raw = scoreVIXFromAnchors(vix, anchors) * 0.6 + scorePutCall(putCall) * 0.4
  return Math.round(raw)
}

/**
 * @param {{ vix?: number; putCall?: number; fearGreed?: number; bofa?: number; highYield?: number }} data
 * @param {VixScoreAnchor[]} anchors
 */
export function getVixVariantFinalScore(data, anchors) {
  const short = getVixVariantShortScore(data.vix, data.putCall, anchors)
  const mid = getMidScore(data.fearGreed, data.bofa, data.highYield)
  const { wShort, wMid } = getDynamicWeights(data.vix, data.highYield)
  const raw = short * wShort + mid * wMid
  return Math.round(Math.max(0, raw))
}

/** @deprecated V1 별칭 */
export function getExperimentalFinalScore(data) {
  return getVixVariantFinalScore(data, VIX_EXPERIMENT_V1_ANCHORS)
}

/**
 * @param {import("./ydsHistoricalEventTypes.js").MilestoneIndicatorData | Record<string, unknown>} historyData
 * @param {VixScoreAnchor[]} anchors
 */
function buildVixVariantSnapshot(historyData, anchors) {
  if (!canComputeYds(historyData)) {
    return { computable: false, yds: null }
  }
  const payload = historyDataToPanicPayload(historyData)
  return {
    computable: true,
    yds: getVixVariantFinalScore(payload, anchors),
    vix: toNum(payload.vix),
    scoreVix: scoreVIXFromAnchors(payload.vix, anchors),
  }
}

/**
 * @param {import("./ydsHistoricalEventTypes.js").EventDetailData} event
 */
export function buildVixSensitivityEventRow(event) {
  const snapshots = YDS_MILESTONE_ORDER.map((key) => {
    const milestone = event?.milestones?.[key]
    const h = milestone?.historyData ?? {}
    const currentYds = canComputeYds(h) ? computeYdsScore(h) : null
    const v1 = buildVixVariantSnapshot(h, VIX_EXPERIMENT_V1_ANCHORS)
    const v2 = buildVixVariantSnapshot(h, VIX_EXPERIMENT_V2_ANCHORS)
    return {
      key,
      label: YDS_MILESTONE_STEP_LABEL[key],
      date: milestone?.date ?? null,
      currentYds,
      v1Yds: v1.yds,
      v2Yds: v2.yds,
      computable: currentYds != null,
    }
  }).filter((s) => s.computable)

  const pickPeak = (field) =>
    snapshots.length > 0
      ? snapshots.reduce((best, cur) => ((cur[field] ?? 0) > (best[field] ?? 0) ? cur : best), snapshots[0])
      : null

  const peakCurrent = pickPeak("currentYds")
  const peakV1 = pickPeak("v1Yds")
  const peakV2 = pickPeak("v2Yds")

  const currentMaxYds = peakCurrent?.currentYds ?? null
  const v1MaxYds = peakV1?.v1Yds ?? null
  const v2MaxYds = peakV2?.v2Yds ?? null

  return {
    id: event.id,
    name: event.name,
    currentMaxYds,
    v1MaxYds,
    v2MaxYds,
    /** @deprecated */ experimentalMaxYds: v1MaxYds,
    deltaV1: currentMaxYds != null && v1MaxYds != null ? v1MaxYds - currentMaxYds : null,
    deltaV2: currentMaxYds != null && v2MaxYds != null ? v2MaxYds - currentMaxYds : null,
    /** @deprecated */ delta: currentMaxYds != null && v1MaxYds != null ? v1MaxYds - currentMaxYds : null,
    peakMilestone: peakV2?.label ?? peakV1?.label ?? peakCurrent?.label ?? null,
    peakDate: peakV2?.date ?? peakV1?.date ?? peakCurrent?.date ?? null,
    currentStage: resolveMacroV1Status(currentMaxYds),
    v1Stage: resolveMacroV1Status(v1MaxYds),
    v2Stage: resolveMacroV1Status(v2MaxYds),
    v1HistoricStage: resolveExperimentalYdsStage(v1MaxYds),
    v2HistoricStage: resolveExperimentalYdsStage(v2MaxYds),
    /** @deprecated */ experimentalStageCurrentBands: resolveMacroV1Status(v1MaxYds),
    /** @deprecated */ experimentalHistoricStage: resolveExperimentalYdsStage(v1MaxYds),
    ydsComputable: snapshots.length > 0,
  }
}

function gapBetween(rows, idA, idB, field) {
  const a = rows.find((r) => r.id === idA)
  const b = rows.find((r) => r.id === idB)
  if (a?.[field] == null || b?.[field] == null) return null
  return a[field] - b[field]
}

function checkStrictOrder(rows, ids, field) {
  const scores = ids.map((id) => rows.find((r) => r.id === id)?.[field]).filter((s) => s != null)
  if (scores.length !== ids.length) return false
  for (let i = 0; i < scores.length - 1; i += 1) {
    if (scores[i] <= scores[i + 1]) return false
  }
  return true
}

function buildVersionValidation(rows, field) {
  const historic = rows.filter((r) => (r[field] ?? 0) >= HISTORIC_PANIC_MIN)
  const panicBuy = rows.filter((r) => (r[field] ?? 0) >= CURRENT_PANIC_BUY_MIN)
  const lehmanMinusTariff = gapBetween(rows, "panic-2008-lehman", "panic-2025-tariff-shock", field)
  const covidMinusTariff = gapBetween(rows, "panic-2020-covid", "panic-2025-tariff-shock", field)

  return {
    naturalOrder: checkStrictOrder(rows, NATURAL_ORDER_IDS, field),
    lehmanMinusTariff,
    covidMinusTariff,
    historicPanic: {
      exists: historic.length > 0,
      count: historic.length,
      events: historic.map((e) => ({ name: e.name, score: e[field] })),
    },
    panicBuy: {
      exists: panicBuy.length > 0,
      count: panicBuy.length,
      events: panicBuy.map((e) => ({ name: e.name, score: e[field] })),
    },
  }
}

/**
 * @param {import("./ydsHistoricalEventTypes.js").EventDetailData[]} events
 */
export function buildVixSensitivityLabReport(events) {
  const rows = events
    .filter((e) => PANIC_PEAK_RANKING_IDS.includes(e.id))
    .map(buildVixSensitivityEventRow)
    .filter((r) => r.ydsComputable)
    .sort((a, b) => (b.v2MaxYds ?? 0) - (a.v2MaxYds ?? 0))

  const currentVal = buildVersionValidation(rows, "currentMaxYds")
  const v1Val = buildVersionValidation(rows, "v1MaxYds")
  const v2Val = buildVersionValidation(rows, "v2MaxYds")

  const lehmanTariffWidenedV1 =
    (v1Val.lehmanMinusTariff ?? 0) > (currentVal.lehmanMinusTariff ?? 0) &&
    (v1Val.covidMinusTariff ?? 0) > (currentVal.covidMinusTariff ?? 0)
  const lehmanTariffWidenedV2 =
    (v2Val.lehmanMinusTariff ?? 0) > (currentVal.lehmanMinusTariff ?? 0) &&
    (v2Val.covidMinusTariff ?? 0) > (currentVal.covidMinusTariff ?? 0)

  const finalReport = FINAL_REPORT_IDS.map((id) => {
    const row = rows.find((r) => r.id === id)
    if (!row) return null
    return {
      id,
      name: row.name,
      current: row.currentMaxYds,
      v1: row.v1MaxYds,
      v2: row.v2MaxYds,
      deltaV1: row.deltaV1,
      deltaV2: row.deltaV2,
    }
  }).filter(Boolean)

  const validationGoals = {
    naturalOrder: {
      target: "리먼 > 코로나 > 관세 > 엔캐리",
      current: currentVal.naturalOrder,
      v1: v1Val.naturalOrder,
      v2: v2Val.naturalOrder,
    },
    lehmanCovidVsTariffGap: {
      current: {
        lehmanMinusTariff: currentVal.lehmanMinusTariff,
        covidMinusTariff: currentVal.covidMinusTariff,
      },
      v1: {
        lehmanMinusTariff: v1Val.lehmanMinusTariff,
        covidMinusTariff: v1Val.covidMinusTariff,
        widened: lehmanTariffWidenedV1,
      },
      v2: {
        lehmanMinusTariff: v2Val.lehmanMinusTariff,
        covidMinusTariff: v2Val.covidMinusTariff,
        widened: lehmanTariffWidenedV2,
      },
    },
    historicPanic: {
      threshold: HISTORIC_PANIC_MIN,
      v1: v1Val.historicPanic,
      v2: v2Val.historicPanic,
    },
    panicBuy: {
      threshold: CURRENT_PANIC_BUY_MIN,
      v1: v1Val.panicBuy,
      v2: v2Val.panicBuy,
    },
  }

  return {
    rows,
    validationGoals,
    finalReport,
    notes: [
      VIX_EXPERIMENT_V1_NOTE,
      VIX_EXPERIMENT_V2_NOTE,
      "패닉 6건 milestone 최고 YDS · getFinalScore·HY 가중·프로덕션 미변경.",
    ],
  }
}

export { HISTORIC_PANIC_MIN, CURRENT_PANIC_BUY_MIN, NATURAL_ORDER_IDS }
