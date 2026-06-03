import { resolveMacroV1Status } from "../panic-v2/panicMacroV1Status.js"
import {
  getDynamicWeights,
  getMidScore,
  scorePutCall,
} from "../utils/tradingScores.js"
import { canComputeYds, computeYdsScore } from "./ydsHistoricalEventTypes.js"
import { YDS_MILESTONE_ORDER, YDS_MILESTONE_STEP_LABEL } from "./ydsHistoricalEventTypes.js"
import { historyDataToPanicPayload } from "./ydsScoreBreakdown.js"
import { PANIC_PEAK_RANKING_IDS } from "./ydsPanicPeakRankingReport.js"
import { resolveExperimentalYdsStage } from "./ydsScoreStageSimulation.js"

/** @typedef {{ vix: number; score: number }} VixScoreAnchor */
/** @typedef {{ id: string; label: string; anchors: VixScoreAnchor[]; note: string }} VixVariantDef */

/** 실험 V1 */
/** @type {VixScoreAnchor[]} */
export const VIX_EXPERIMENT_V1_ANCHORS = [
  { vix: 12, score: 0 },
  { vix: 40, score: 100 },
  { vix: 50, score: 110 },
  { vix: 60, score: 120 },
  { vix: 70, score: 135 },
  { vix: 80, score: 150 },
]

/** 실험 V2 */
/** @type {VixScoreAnchor[]} */
export const VIX_EXPERIMENT_V2_ANCHORS = [
  { vix: 12, score: 0 },
  { vix: 40, score: 100 },
  { vix: 50, score: 115 },
  { vix: 60, score: 135 },
  { vix: 70, score: 155 },
  { vix: 80, score: 180 },
]

/** 실험 V3 — 초가파른 비선형 */
/** @type {VixScoreAnchor[]} */
export const VIX_EXPERIMENT_V3_ANCHORS = [
  { vix: 12, score: 0 },
  { vix: 40, score: 100 },
  { vix: 50, score: 125 },
  { vix: 60, score: 155 },
  { vix: 70, score: 195 },
  { vix: 80, score: 250 },
]

/** @deprecated V1 별칭 */
export const VIX_EXPERIMENT_ANCHORS = VIX_EXPERIMENT_V1_ANCHORS

export const VIX_EXPERIMENT_V1_NOTE =
  "V1: 40→100 · 50→110 · 60→120 · 70→135 · 80→150"

export const VIX_EXPERIMENT_V2_NOTE =
  "V2: 40→100 · 50→115 · 60→135 · 70→155 · 80→180"

export const VIX_EXPERIMENT_V3_NOTE =
  "V3: 40→100 · 50→125 · 60→155 · 70→195 · 80→250 (초가파른 비선형 · 선형 보간)"

export const VIX_EXPERIMENT_NOTE = VIX_EXPERIMENT_V1_NOTE

/** @type {VixVariantDef[]} */
export const VIX_EXPERIMENT_VARIANTS = [
  { id: "v1", label: "V1", anchors: VIX_EXPERIMENT_V1_ANCHORS, note: VIX_EXPERIMENT_V1_NOTE },
  { id: "v2", label: "V2", anchors: VIX_EXPERIMENT_V2_ANCHORS, note: VIX_EXPERIMENT_V2_NOTE },
  { id: "v3", label: "V3", anchors: VIX_EXPERIMENT_V3_ANCHORS, note: VIX_EXPERIMENT_V3_NOTE },
]

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

const LOW_VIX_CONTROL_IDS = [
  "panic-2024-yen-carry",
  "panic-2022-tightening",
  "panic-2023-svb",
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

export function scoreVIXExperimentalV1(vix) {
  return scoreVIXFromAnchors(vix, VIX_EXPERIMENT_V1_ANCHORS)
}

export function scoreVIXExperimentalV2(vix) {
  return scoreVIXFromAnchors(vix, VIX_EXPERIMENT_V2_ANCHORS)
}

export function scoreVIXExperimentalV3(vix) {
  return scoreVIXFromAnchors(vix, VIX_EXPERIMENT_V3_ANCHORS)
}

/** @deprecated V1 별칭 */
export function scoreVIXExperimental(vix) {
  return scoreVIXExperimentalV1(vix)
}

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

function buildVixVariantSnapshot(historyData, anchors) {
  if (!canComputeYds(historyData)) return { computable: false, yds: null }
  const payload = historyDataToPanicPayload(historyData)
  return {
    computable: true,
    yds: getVixVariantFinalScore(payload, anchors),
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
    const variantYds = Object.fromEntries(
      VIX_EXPERIMENT_VARIANTS.map((v) => [v.id, buildVixVariantSnapshot(h, v.anchors).yds]),
    )
    return {
      key,
      label: YDS_MILESTONE_STEP_LABEL[key],
      date: milestone?.date ?? null,
      currentYds,
      v1Yds: variantYds.v1,
      v2Yds: variantYds.v2,
      v3Yds: variantYds.v3,
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
  const peakV3 = pickPeak("v3Yds")

  const currentMaxYds = peakCurrent?.currentYds ?? null
  const v1MaxYds = peakV1?.v1Yds ?? null
  const v2MaxYds = peakV2?.v2Yds ?? null
  const v3MaxYds = peakV3?.v3Yds ?? null

  return {
    id: event.id,
    name: event.name,
    currentMaxYds,
    v1MaxYds,
    v2MaxYds,
    v3MaxYds,
    /** @deprecated */ experimentalMaxYds: v1MaxYds,
    deltaV1: delta(currentMaxYds, v1MaxYds),
    deltaV2: delta(currentMaxYds, v2MaxYds),
    deltaV3: delta(currentMaxYds, v3MaxYds),
    /** @deprecated */ delta: delta(currentMaxYds, v1MaxYds),
    peakMilestone: peakV3?.label ?? peakV2?.label ?? peakV1?.label ?? peakCurrent?.label ?? null,
    peakDate: peakV3?.date ?? peakV2?.date ?? peakV1?.date ?? peakCurrent?.date ?? null,
    v3Stage: resolveMacroV1Status(v3MaxYds),
    v3HistoricStage: resolveExperimentalYdsStage(v3MaxYds),
    /** @deprecated */ experimentalStageCurrentBands: resolveMacroV1Status(v1MaxYds),
    ydsComputable: snapshots.length > 0,
  }
}

function delta(current, variant) {
  return current != null && variant != null ? variant - current : null
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

function assignRanks(rows, field) {
  const sorted = [...rows].sort((a, b) => (b[field] ?? 0) - (a[field] ?? 0))
  const rankMap = new Map()
  sorted.forEach((row, idx) => rankMap.set(row.id, idx + 1))
  return rankMap
}

/**
 * @param {ReturnType<typeof buildVixSensitivityEventRow>[]} rows
 * @param {string} field
 */
function buildVersionValidation(rows, field) {
  const lehman = rows.find((r) => r.id === "panic-2008-lehman")
  const covid = rows.find((r) => r.id === "panic-2020-covid")
  const tariff = rows.find((r) => r.id === "panic-2025-tariff-shock")

  return {
    naturalOrder: checkStrictOrder(rows, NATURAL_ORDER_IDS, field),
    lehmanMinusTariff: gapBetween(rows, "panic-2008-lehman", "panic-2025-tariff-shock", field),
    covidMinusTariff: gapBetween(rows, "panic-2020-covid", "panic-2025-tariff-shock", field),
    lehmanHistoric: (lehman?.[field] ?? 0) >= HISTORIC_PANIC_MIN,
    covidHistoric: (covid?.[field] ?? 0) >= HISTORIC_PANIC_MIN,
    tariffPanicBuy: (tariff?.[field] ?? 0) >= CURRENT_PANIC_BUY_MIN,
    historicEvents: rows
      .filter((r) => (r[field] ?? 0) >= HISTORIC_PANIC_MIN)
      .map((r) => ({ name: r.name, score: r[field] })),
    panicBuyEvents: rows
      .filter((r) => (r[field] ?? 0) >= CURRENT_PANIC_BUY_MIN)
      .map((r) => ({ name: r.name, score: r[field] })),
  }
}

function buildRankingChanges(rows) {
  const fields = [
    { key: "currentMaxYds", label: "현재" },
    { key: "v1MaxYds", label: "V1" },
    { key: "v2MaxYds", label: "V2" },
    { key: "v3MaxYds", label: "V3" },
  ]
  const rankMaps = fields.map((f) => ({ ...f, ranks: assignRanks(rows, f.key) }))

  return rows.map((row) => {
    const ranks = rankMaps.map((m) => ({ label: m.label, rank: m.ranks.get(row.id) ?? null }))
    const currentRank = ranks[0].rank
    const v3Rank = ranks[3].rank
    return {
      id: row.id,
      name: row.name,
      ranks,
      rankShiftV3: currentRank != null && v3Rank != null ? currentRank - v3Rank : null,
    }
  })
}

function buildV3Interpretation(rows, currentVal, v3Val, rankingChanges) {
  const lines = []
  const tariff = rows.find((r) => r.id === "panic-2025-tariff-shock")
  const lehman = rows.find((r) => r.id === "panic-2008-lehman")
  const covid = rows.find((r) => r.id === "panic-2020-covid")

  lines.push(
    `V3는 VIX 40+ 구간을 50→125 · 70→195 · 80→250으로 가파르게 확장. 고VIX(리먼·코로나)는 +${lehman?.deltaV3 ?? "?"}p · +${covid?.deltaV3 ?? "?"}p, 저VIX(엔캐리·긴축·SVB)는 변화 없음.`,
  )

  if (v3Val.naturalOrder) {
    lines.push(
      `순서: 리먼(${lehman?.v3MaxYds}) > 코로나(${covid?.v3MaxYds}) > 관세(${tariff?.v3MaxYds}) > 엔캐리 — V3에서 자연스러운 위계 달성.`,
    )
  } else {
    lines.push("순서: V3에서도 리먼>코로나>관세>엔캐리 미달성.")
  }

  lines.push(
    `코로나−관세 격차: 현재 ${currentVal.covidMinusTariff}p → V3 ${v3Val.covidMinusTariff}p (${(v3Val.covidMinusTariff ?? 0) > (currentVal.covidMinusTariff ?? 0) ? "확대" : "축소"}).`,
  )

  if (v3Val.lehmanHistoric && v3Val.covidHistoric) {
    lines.push(`역사적패닉(85+): 리먼 ${lehman?.v3MaxYds} · 코로나 ${covid?.v3MaxYds} — 둘 다 분리 구간 진입.`)
  }

  if (v3Val.tariffPanicBuy) {
    lines.push(`관세 ${tariff?.v3MaxYds}: 패닉매수(80+) 유지 — V3에서도 실전 매수 신호 수준 보존.`)
  } else {
    lines.push(`관세 ${tariff?.v3MaxYds}: 패닉매수(80+) 미달 — VIX 46 수준 한계.`)
  }

  const controlOk = LOW_VIX_CONTROL_IDS.every((id) => {
    const row = rows.find((r) => r.id === id)
    return row?.deltaV3 === 0
  })
  lines.push(
    controlOk
      ? "저VIX 대조군(엔캐리·긴축·SVB): V3 점수 변화 0 — 왜곡 없음."
      : "저VIX 대조군: 일부 이벤트에서 V3 점수 변화 발생 — VIX 40 미만 구간 확인 필요.",
  )

  const tariffShift = rankingChanges.find((r) => r.id === "panic-2025-tariff-shock")
  if (tariffShift?.rankShiftV3 != null && tariffShift.rankShiftV3 > 0) {
    lines.push(
      `관세 순위: ${tariffShift.ranks[0].rank}위(현재) → ${tariffShift.ranks[3].rank}위(V3) — ${tariffShift.rankShiftV3}계단 하락.`,
    )
  }

  return lines
}

/**
 * @param {import("./ydsHistoricalEventTypes.js").EventDetailData[]} events
 */
export function buildVixSensitivityLabReport(events) {
  const rows = events
    .filter((e) => PANIC_PEAK_RANKING_IDS.includes(e.id))
    .map(buildVixSensitivityEventRow)
    .filter((r) => r.ydsComputable)

  const currentVal = buildVersionValidation(rows, "currentMaxYds")
  const v1Val = buildVersionValidation(rows, "v1MaxYds")
  const v2Val = buildVersionValidation(rows, "v2MaxYds")
  const v3Val = buildVersionValidation(rows, "v3MaxYds")

  const rankingChanges = buildRankingChanges(rows)

  const finalReport = FINAL_REPORT_IDS.map((id) => {
    const row = rows.find((r) => r.id === id)
    if (!row) return null
    return {
      id,
      name: row.name,
      current: row.currentMaxYds,
      v1: row.v1MaxYds,
      v2: row.v2MaxYds,
      v3: row.v3MaxYds,
      deltaV1: row.deltaV1,
      deltaV2: row.deltaV2,
      deltaV3: row.deltaV3,
    }
  }).filter(Boolean)

  const lowVixControl = LOW_VIX_CONTROL_IDS.map((id) => {
    const row = rows.find((r) => r.id === id)
    return {
      id,
      name: row?.name ?? id,
      current: row?.currentMaxYds,
      v3: row?.v3MaxYds,
      deltaV3: row?.deltaV3 ?? null,
      undistorted: row?.deltaV3 === 0,
    }
  })

  const validationGoals = {
    naturalOrder: {
      target: "리먼 > 코로나 > 관세 > 엔캐리",
      current: currentVal.naturalOrder,
      v1: v1Val.naturalOrder,
      v2: v2Val.naturalOrder,
      v3: v3Val.naturalOrder,
    },
    covidTariffGap: {
      current: currentVal.covidMinusTariff,
      v1: v1Val.covidMinusTariff,
      v2: v2Val.covidMinusTariff,
      v3: v3Val.covidMinusTariff,
      v3Widened: (v3Val.covidMinusTariff ?? 0) > (currentVal.covidMinusTariff ?? 0),
    },
    historicPanic: {
      threshold: HISTORIC_PANIC_MIN,
      v1: v1Val.historicEvents,
      v2: v2Val.historicEvents,
      v3: v3Val.historicEvents,
      v3LehmanCovid:
        v3Val.lehmanHistoric && v3Val.covidHistoric,
    },
    tariffPanicBuy: {
      threshold: CURRENT_PANIC_BUY_MIN,
      v3: v3Val.tariffPanicBuy,
      v3Score: rows.find((r) => r.id === "panic-2025-tariff-shock")?.v3MaxYds,
    },
    lowVixControl: {
      allUndistorted: lowVixControl.every((c) => c.undistorted),
      items: lowVixControl,
    },
    /** @deprecated */ lehmanCovidVsTariffGap: {
      current: {
        lehmanMinusTariff: currentVal.lehmanMinusTariff,
        covidMinusTariff: currentVal.covidMinusTariff,
      },
      v1: {
        lehmanMinusTariff: v1Val.lehmanMinusTariff,
        covidMinusTariff: v1Val.covidMinusTariff,
        widened:
          (v1Val.lehmanMinusTariff ?? 0) > (currentVal.lehmanMinusTariff ?? 0) &&
          (v1Val.covidMinusTariff ?? 0) > (currentVal.covidMinusTariff ?? 0),
      },
      v2: {
        lehmanMinusTariff: v2Val.lehmanMinusTariff,
        covidMinusTariff: v2Val.covidMinusTariff,
        widened:
          (v2Val.lehmanMinusTariff ?? 0) > (currentVal.lehmanMinusTariff ?? 0) &&
          (v2Val.covidMinusTariff ?? 0) > (currentVal.covidMinusTariff ?? 0),
      },
    },
    /** @deprecated */ panicBuy: {
      threshold: CURRENT_PANIC_BUY_MIN,
      v1: { exists: v1Val.panicBuyEvents.length > 0, count: v1Val.panicBuyEvents.length, events: v1Val.panicBuyEvents },
      v2: { exists: v2Val.panicBuyEvents.length > 0, count: v2Val.panicBuyEvents.length, events: v2Val.panicBuyEvents },
    },
  }

  const v3Interpretation = buildV3Interpretation(rows, currentVal, v3Val, rankingChanges)

  return {
    rows: [...rows].sort((a, b) => (b.v3MaxYds ?? 0) - (a.v3MaxYds ?? 0)),
    rankingChanges,
    validationGoals,
    finalReport,
    v3Interpretation,
    notes: [
      VIX_EXPERIMENT_V1_NOTE,
      VIX_EXPERIMENT_V2_NOTE,
      VIX_EXPERIMENT_V3_NOTE,
      "패닉 6건 milestone 최고 YDS · getFinalScore·HY 가중·프로덕션 미변경.",
    ],
  }
}

export { HISTORIC_PANIC_MIN, CURRENT_PANIC_BUY_MIN, NATURAL_ORDER_IDS, LOW_VIX_CONTROL_IDS }
