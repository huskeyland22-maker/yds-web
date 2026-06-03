import { resolveMacroV1Status } from "../panic-v2/panicMacroV1Status.js"
import { getMidScore, getShortScore } from "../utils/tradingScores.js"
import { canComputeYds, computeYdsScore } from "./ydsHistoricalEventTypes.js"
import { YDS_MILESTONE_ORDER, YDS_MILESTONE_STEP_LABEL } from "./ydsHistoricalEventTypes.js"
import { historyDataToPanicPayload } from "./ydsScoreBreakdown.js"
import { PANIC_PEAK_RANKING_IDS } from "./ydsPanicPeakRankingReport.js"

/** HY 가중 민감도 실험 — 비교 이벤트 6건 */
export const HY_WEIGHT_LAB_EVENT_IDS = PANIC_PEAK_RANKING_IDS

export const HY_WEIGHT_CURRENT_RULES_NOTE =
  "실험 A(현재): HY>6 → 단기40·중기60(우선) · HY≤6且VIX>25 → 단기70·중기30 · 그 외 50/50 · getFinalScore 그대로"

/** 실험 B: HY 계단형 단기 가중 (VIX 분기 대체 · 검증 전용) */
export const HY_WEIGHT_STEPPED_BANDS = [
  { maxHy: 4.5, wShort: 0.7, wMid: 0.3, label: "HY ≤ 4.5" },
  { maxHy: 6, wShort: 0.6, wMid: 0.4, label: "4.5 < HY ≤ 6" },
  { maxHy: 8, wShort: 0.5, wMid: 0.5, label: "6 < HY ≤ 8" },
  { maxHy: Infinity, wShort: 0.4, wMid: 0.6, label: "HY > 8" },
]

const NATURAL_ORDER_IDS = [
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
 * 실험 B — HY만으로 단기·중기 가중 결정
 * @param {number | null | undefined} highYield
 */
export function getSteppedHyWeights(highYield) {
  const h = toNum(highYield)
  if (!Number.isFinite(h)) {
    return { wShort: 0.5, wMid: 0.5, reason: "hy-unknown", bandLabel: "—" }
  }
  for (const band of HY_WEIGHT_STEPPED_BANDS) {
    if (h <= band.maxHy) {
      return {
        wShort: band.wShort,
        wMid: band.wMid,
        reason: `hy-step-${band.maxHy}`,
        bandLabel: band.label,
      }
    }
  }
  const last = HY_WEIGHT_STEPPED_BANDS[HY_WEIGHT_STEPPED_BANDS.length - 1]
  return { wShort: last.wShort, wMid: last.wMid, reason: "hy-step-fallback", bandLabel: last.label }
}

/**
 * getFinalScore와 동일 · getDynamicWeights만 실험 B 계단형 HY 규칙으로 대체
 * @param {{ vix?: number; putCall?: number; fearGreed?: number; bofa?: number; highYield?: number }} data
 */
export function getHyWeightExperimentalFinalScore(data) {
  const short = getShortScore(data.vix, data.putCall)
  const mid = getMidScore(data.fearGreed, data.bofa, data.highYield)
  const { wShort, wMid } = getSteppedHyWeights(data.highYield)
  const raw = short * wShort + mid * wMid
  return Math.round(Math.max(0, Math.min(100, raw)))
}

/**
 * @param {import("./ydsHistoricalEventTypes.js").MilestoneIndicatorData | Record<string, unknown>} historyData
 */
export function computeHyWeightExperimentalYds(historyData) {
  if (!canComputeYds(historyData)) return null
  return getHyWeightExperimentalFinalScore(historyDataToPanicPayload(historyData))
}

/**
 * @param {import("./ydsHistoricalEventTypes.js").EventDetailData} event
 */
export function buildHyWeightSensitivityEventRow(event) {
  const snapshots = YDS_MILESTONE_ORDER.map((key) => {
    const milestone = event?.milestones?.[key]
    const h = milestone?.historyData ?? {}
    const payload = historyDataToPanicPayload(h)
    const currentYds = computeYdsScore(h)
    const experimentalYds = canComputeYds(h) ? getHyWeightExperimentalFinalScore(payload) : null
    const hy = toNum(payload.highYield)
    const weights = canComputeYds(h) ? getSteppedHyWeights(payload.highYield) : null
    return {
      key,
      label: YDS_MILESTONE_STEP_LABEL[key],
      date: milestone?.date ?? null,
      currentYds,
      experimentalYds,
      delta:
        currentYds != null && experimentalYds != null ? experimentalYds - currentYds : null,
      highYield: Number.isFinite(hy) ? hy : null,
      experimentalBand: weights?.bandLabel ?? null,
      computable: currentYds != null,
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

  return {
    id: event.id,
    name: event.name,
    currentMaxYds,
    experimentalMaxYds,
    delta:
      currentMaxYds != null && experimentalMaxYds != null ? experimentalMaxYds - currentMaxYds : null,
    peakMilestone: peakExperimental?.label ?? peakCurrent?.label ?? null,
    peakDate: peakExperimental?.date ?? peakCurrent?.date ?? null,
    peakHy: peakExperimental?.highYield ?? peakCurrent?.highYield ?? null,
    experimentalBand: peakExperimental?.experimentalBand ?? null,
    currentStage: resolveMacroV1Status(currentMaxYds),
    experimentalStage: resolveMacroV1Status(experimentalMaxYds),
    ydsComputable: snapshots.length > 0,
  }
}

function checkStrictOrder(rows, ids, field) {
  const scores = ids.map((id) => rows.find((r) => r.id === id)?.[field]).filter((s) => s != null)
  if (scores.length !== ids.length) return false
  for (let i = 0; i < scores.length - 1; i += 1) {
    if (scores[i] <= scores[i + 1]) return false
  }
  return true
}

/**
 * @param {import("./ydsHistoricalEventTypes.js").EventDetailData[]} events
 */
export function buildHyWeightSensitivityLabReport(events) {
  const rows = events
    .filter((e) => HY_WEIGHT_LAB_EVENT_IDS.includes(e.id))
    .map(buildHyWeightSensitivityEventRow)
    .filter((r) => r.ydsComputable)
    .sort((a, b) => (b.experimentalMaxYds ?? 0) - (a.experimentalMaxYds ?? 0))
    .map((row, idx) => ({ ...row, rankExperimental: idx + 1 }))

  const tariff = rows.find((r) => r.id === "panic-2025-tariff-shock")
  const covid = rows.find((r) => r.id === "panic-2020-covid")
  const lehman = rows.find((r) => r.id === "panic-2008-lehman")
  const yen = rows.find((r) => r.id === "panic-2024-yen-carry")

  const tariffBeatsCovidCurrent =
    (tariff?.currentMaxYds ?? 0) > (covid?.currentMaxYds ?? 0)
  const tariffBeatsCovidExperimental =
    (tariff?.experimentalMaxYds ?? 0) > (covid?.experimentalMaxYds ?? 0)

  const naturalOrderCurrent = checkStrictOrder(rows, NATURAL_ORDER_IDS, "currentMaxYds")
  const naturalOrderExperimental = checkStrictOrder(rows, NATURAL_ORDER_IDS, "experimentalMaxYds")

  const validationGoals = {
    tariffBeatsCovid: {
      current: tariffBeatsCovidCurrent,
      experimental: tariffBeatsCovidExperimental,
      maintained: tariffBeatsCovidCurrent && tariffBeatsCovidExperimental,
      currentGap: (tariff?.currentMaxYds ?? 0) - (covid?.currentMaxYds ?? 0),
      experimentalGap: (tariff?.experimentalMaxYds ?? 0) - (covid?.experimentalMaxYds ?? 0),
    },
    naturalOrder: {
      target: "리먼 > 코로나 > 관세 > 엔캐리",
      current: naturalOrderCurrent,
      experimental: naturalOrderExperimental,
      improved: !naturalOrderCurrent && naturalOrderExperimental,
      currentScores: {
        lehman: lehman?.currentMaxYds,
        covid: covid?.currentMaxYds,
        tariff: tariff?.currentMaxYds,
        yen: yen?.currentMaxYds,
      },
      experimentalScores: {
        lehman: lehman?.experimentalMaxYds,
        covid: covid?.experimentalMaxYds,
        tariff: tariff?.experimentalMaxYds,
        yen: yen?.experimentalMaxYds,
      },
    },
  }

  return {
    rows,
    validationGoals,
    notes: [
      HY_WEIGHT_CURRENT_RULES_NOTE,
      "실험 B: HY 계단형만 적용(VIX>25 분기 미사용) · 단기·중기 점수(getShortScore/getMidScore)는 동일.",
      "getFinalScore·프로덕션 미변경 · 검증 페이지 전용.",
    ],
  }
}

export { NATURAL_ORDER_IDS }
