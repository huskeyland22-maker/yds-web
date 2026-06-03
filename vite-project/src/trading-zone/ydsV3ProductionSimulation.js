import { resolveMacroV1Status } from "../panic-v2/panicMacroV1Status.js"
import { getFinalScore } from "../utils/tradingScores.js"
import {
  formatProductionCandidateStage,
  resolveProductionCandidateStage,
} from "./ydsProductionCandidateV3.js"
import {
  canComputeYds,
  computeYdsScore,
  formatMetric,
  resolveYdsStage,
} from "./ydsHistoricalEventTypes.js"
import { PANIC_VALIDATION_EXTENDED_HISTORY } from "./panicValidationExtendedHistory.js"
import { historyDataToPanicPayload } from "./ydsScoreBreakdown.js"
import { buildVixSensitivityEventRow } from "./ydsVixSensitivityLab.js"
import { getVixV3FinalScore } from "./ydsVixV3Engine.js"

/** V3 프로덕션 영향도 시뮬레이션 대상 (검증 전용 · getFinalScore 미변경) */
export const V3_PRODUCTION_SIMULATION_IDS = [
  "panic-2008-lehman",
  "panic-2020-covid",
  "panic-2025-tariff-shock",
  "panic-2024-yen-carry",
  "panic-2022-tightening",
  "panic-2023-svb",
]

export const V3_PRODUCTION_SIMULATION_NOTE =
  "VIX V3(scoreVIX 40→100·50→125·70→195·80→250) 전체 엔진 영향도 · getFinalScore 프로덕션 미변경"

export const CURRENT_LATEST_ROW_ID = "current-latest"

const HISTORIC_PANIC_MIN = 85
const TARIFF_V3_MIN = 80
const TARIFF_V3_MAX = 90
const YEN_V3_MIN = 65
const YEN_V3_MAX = 75
const MODERATE_V3_MIN = 55
const MODERATE_V3_MAX = 65
const CURRENT_V3_MAX = 79
const CURRENT_DELTA_MAX = 18

const NATURAL_ORDER_IDS = [
  "panic-2008-lehman",
  "panic-2020-covid",
  "panic-2025-tariff-shock",
  "panic-2024-yen-carry",
]

/**
 * @param {Record<string, unknown>} row
 * @returns {import("./ydsHistoricalEventTypes.js").MilestoneIndicatorData | null}
 */
function rowToHistoryData(row) {
  if (!row || typeof row !== "object") return null
  const pick = (...keys) => {
    for (const key of keys) {
      const n = Number(row[key])
      if (Number.isFinite(n)) return n
    }
    return null
  }
  const historyData = {
    vix: pick("vix"),
    cnn: pick("cnn", "fearGreed"),
    bofa: pick("bofa"),
    putCall: pick("putCall"),
    highYield: pick("highYield"),
  }
  return canComputeYds(historyData) ? historyData : null
}

/**
 * @param {import("./ydsHistoricalEventTypes.js").MilestoneIndicatorData} historyData
 */
function scoreBothEngines(historyData) {
  const payload = historyDataToPanicPayload(historyData)
  const currentYds = getFinalScore(payload)
  const v3Yds = getVixV3FinalScore(payload)
  const currentStage = resolveYdsStage(currentYds)
  const v3Stage = resolveProductionCandidateStage(v3Yds)
  return {
    currentYds,
    v3Yds,
    delta: v3Yds - currentYds,
    currentStage,
    v3Stage,
    currentStageLabel: currentStage ? `${currentStage.emoji} ${currentStage.label}` : "—",
    v3StageLabel: formatProductionCandidateStage(v3Stage),
    stageChanged: currentStage?.label !== v3Stage?.label,
    inputs: {
      vix: historyData.vix,
      cnn: historyData.cnn,
      bofa: historyData.bofa,
      highYield: historyData.highYield,
      putCall: historyData.putCall,
    },
  }
}

/**
 * @param {import("./ydsHistoricalEventTypes.js").EventDetailData} event
 */
export function buildV3ProductionHistoricalRow(event) {
  const vixRow = buildVixSensitivityEventRow(event)
  const currentYds = vixRow.currentMaxYds
  const v3Yds = vixRow.v3MaxYds
  const currentStage = resolveYdsStage(currentYds)
  const v3Stage = resolveProductionCandidateStage(v3Yds)

  return {
    id: event.id,
    name: event.name,
    kind: "historical",
    currentYds,
    v3Yds,
    delta: currentYds != null && v3Yds != null ? v3Yds - currentYds : null,
    currentStage,
    v3Stage,
    currentStageLabel: currentStage ? `${currentStage.emoji} ${currentStage.label}` : "—",
    v3StageLabel: formatProductionCandidateStage(v3Stage),
    stageChanged: currentStage?.label !== v3Stage?.label,
    peakMilestone: vixRow.peakMilestone,
    peakDate: vixRow.peakDate,
    inputs: null,
    ydsComputable: vixRow.ydsComputable,
  }
}

/**
 * @param {Record<string, unknown> | null | undefined} latestSnapshot
 * @param {{ fallbackDate?: string }} [options]
 */
export function buildV3ProductionCurrentMarketRow(latestSnapshot, options = {}) {
  let historyData = rowToHistoryData(latestSnapshot)
  let source = "live"
  let asOfDate =
    typeof latestSnapshot?.date === "string"
      ? latestSnapshot.date.slice(0, 10)
      : typeof latestSnapshot?.asOf === "string"
        ? latestSnapshot.asOf.slice(0, 10)
        : null

  if (!historyData) {
    const fallbackRows = PANIC_VALIDATION_EXTENDED_HISTORY.filter((row) =>
      options.fallbackDate ? row.date === options.fallbackDate : true,
    )
    const fallback = fallbackRows[fallbackRows.length - 1] ?? null
    historyData = rowToHistoryData(fallback)
    source = "extended-fallback"
    asOfDate = fallback?.date ?? null
  }

  if (!historyData) {
    return {
      id: CURRENT_LATEST_ROW_ID,
      name: "현재 시장 (최신)",
      kind: "current",
      currentYds: null,
      v3Yds: null,
      delta: null,
      currentStage: null,
      v3Stage: null,
      currentStageLabel: "—",
      v3StageLabel: "—",
      stageChanged: false,
      peakMilestone: null,
      peakDate: asOfDate,
      inputs: null,
      ydsComputable: false,
      source,
      asOfDate,
    }
  }

  const scored = scoreBothEngines(historyData)
  return {
    id: CURRENT_LATEST_ROW_ID,
    name: "현재 시장 (최신)",
    kind: "current",
    ...scored,
    peakMilestone: "snapshot",
    peakDate: asOfDate,
    ydsComputable: true,
    source,
    asOfDate,
  }
}

function inRange(value, min, max) {
  return value != null && Number.isFinite(value) && value >= min && value <= max
}

function checkNaturalOrder(rows) {
  const scores = NATURAL_ORDER_IDS.map((id) => rows.find((r) => r.id === id)?.v3Yds).filter(
    (s) => s != null,
  )
  if (scores.length !== NATURAL_ORDER_IDS.length) return false
  for (let i = 0; i < scores.length - 1; i += 1) {
    if (scores[i] <= scores[i + 1]) return false
  }
  return true
}

/**
 * @param {ReturnType<typeof buildV3ProductionHistoricalRow>[]} historicalRows
 * @param {ReturnType<typeof buildV3ProductionCurrentMarketRow>} currentRow
 */
function buildGoalValidation(historicalRows, currentRow) {
  const lehman = historicalRows.find((r) => r.id === "panic-2008-lehman")
  const covid = historicalRows.find((r) => r.id === "panic-2020-covid")
  const tariff = historicalRows.find((r) => r.id === "panic-2025-tariff-shock")
  const yen = historicalRows.find((r) => r.id === "panic-2024-yen-carry")
  const tightening = historicalRows.find((r) => r.id === "panic-2022-tightening")
  const svb = historicalRows.find((r) => r.id === "panic-2023-svb")

  const lehmanCovidHistoric =
    (lehman?.v3Yds ?? 0) >= HISTORIC_PANIC_MIN && (covid?.v3Yds ?? 0) >= HISTORIC_PANIC_MIN

  const tariffPanicBuy = inRange(tariff?.v3Yds, TARIFF_V3_MIN, TARIFF_V3_MAX)
  const yenPosition = inRange(yen?.v3Yds, YEN_V3_MIN, YEN_V3_MAX)
  const tighteningOk = inRange(tightening?.v3Yds, MODERATE_V3_MIN, MODERATE_V3_MAX)
  const svbOk = inRange(svb?.v3Yds, MODERATE_V3_MIN, MODERATE_V3_MAX)
  const moderateEvents = tighteningOk && svbOk

  const currentStable =
    currentRow.ydsComputable &&
    (currentRow.v3Yds ?? 0) <= CURRENT_V3_MAX &&
    Math.abs(currentRow.delta ?? 0) <= CURRENT_DELTA_MAX &&
    resolveMacroV1Status(currentRow.v3Yds)?.id !== "panicBuy"

  const naturalOrder = checkNaturalOrder(historicalRows)

  return {
    lehmanCovidHistoric: {
      pass: lehmanCovidHistoric,
      detail: `리먼 V3 ${lehman?.v3Yds ?? "—"} · 코로나 V3 ${covid?.v3Yds ?? "—"} (목표 ≥${HISTORIC_PANIC_MIN})`,
    },
    tariffPanicBuy: {
      pass: tariffPanicBuy,
      detail: `관세 V3 ${tariff?.v3Yds ?? "—"} (목표 ${TARIFF_V3_MIN}~${TARIFF_V3_MAX})`,
      range: [TARIFF_V3_MIN, TARIFF_V3_MAX],
    },
    yenPosition: {
      pass: yenPosition,
      detail: `엔캐리 V3 ${yen?.v3Yds ?? "—"} (목표 ${YEN_V3_MIN}~${YEN_V3_MAX})`,
      range: [YEN_V3_MIN, YEN_V3_MAX],
    },
    moderateEvents: {
      pass: moderateEvents,
      detail: `긴축 ${tightening?.v3Yds ?? "—"} · SVB ${svb?.v3Yds ?? "—"} (목표 ${MODERATE_V3_MIN}~${MODERATE_V3_MAX})`,
      range: [MODERATE_V3_MIN, MODERATE_V3_MAX],
    },
    currentMarketStable: {
      pass: currentStable,
      detail: currentRow.ydsComputable
        ? `현재 ${currentRow.currentYds} → V3 ${currentRow.v3Yds} (Δ ${currentRow.delta >= 0 ? "+" : ""}${currentRow.delta}, V3≤${CURRENT_V3_MAX} · |Δ|≤${CURRENT_DELTA_MAX})`
        : "최신 5지표 스냅샷 없음",
    },
    naturalOrder: {
      pass: naturalOrder,
      detail: "리먼 > 코로나 > 관세 > 엔캐리 (V3 peak YDS)",
    },
  }
}

/**
 * @param {ReturnType<typeof buildGoalValidation>} validation
 */
function buildProductionVerdict(validation) {
  const checks = Object.values(validation)
  const passCount = checks.filter((c) => c.pass).length
  const totalChecks = checks.length
  const allPass = passCount === totalChecks

  if (allPass) {
    return {
      id: "production_ready",
      label: "프로덕션 반영 가능",
      emoji: "✅",
      summary:
        "역사 6건 + 현재 시장 기준 V3 영향도가 목표 구간을 충족합니다. getFinalScore 교체 전 실시간 허브·PWA 배포 smoke test만 추가 권장.",
      passCount,
      totalChecks,
    }
  }

  const failed = checks.filter((c) => !c.pass).map((c) => c.detail)
  return {
    id: "needs_tuning",
    label: "추가 보정 필요",
    emoji: "⚠️",
    summary: `V3 프로덕션 반영 전 ${totalChecks - passCount}개 목표 미달 — 앵커·구간·HY 가중 교차 검토 필요. 미달: ${failed.slice(0, 3).join(" · ")}`,
    passCount,
    totalChecks,
  }
}

/**
 * @param {import("./ydsHistoricalEventTypes.js").EventDetailData[]} events
 * @param {{ latestSnapshot?: Record<string, unknown> | null; fallbackDate?: string }} [options]
 */
export function buildV3ProductionSimulationReport(events, options = {}) {
  const historicalRows = events
    .filter((e) => V3_PRODUCTION_SIMULATION_IDS.includes(e.id))
    .map(buildV3ProductionHistoricalRow)
    .filter((r) => r.ydsComputable)

  const currentRow = buildV3ProductionCurrentMarketRow(options.latestSnapshot ?? null, {
    fallbackDate: options.fallbackDate,
  })

  const comparisonRows = [...historicalRows, ...(currentRow.ydsComputable ? [currentRow] : [])]
  const goalValidation = buildGoalValidation(historicalRows, currentRow)
  const verdict = buildProductionVerdict(goalValidation)

  return {
    comparisonRows,
    historicalRows,
    currentMarket: currentRow,
    goalValidation,
    verdict,
    thresholds: {
      historicPanicMin: HISTORIC_PANIC_MIN,
      tariffRange: [TARIFF_V3_MIN, TARIFF_V3_MAX],
      yenRange: [YEN_V3_MIN, YEN_V3_MAX],
      moderateRange: [MODERATE_V3_MIN, MODERATE_V3_MAX],
      currentV3Max: CURRENT_V3_MAX,
      currentDeltaMax: CURRENT_DELTA_MAX,
    },
    notes: [
      V3_PRODUCTION_SIMULATION_NOTE,
      "역사 이벤트 YDS = milestone 5구간 중 peak (현재·V3 각각).",
      "현재 시장 = live 5지표 스냅샷 우선, 없으면 panicValidationExtendedHistory 최신 행.",
      "getFinalScore·MACRO_V1_STATUS_BANDS 프로덕션 코드 변경 없음.",
    ],
  }
}

/** @param {ReturnType<typeof buildV3ProductionSimulationReport>["currentMarket"]} row */
export function formatCurrentMarketInputs(row) {
  if (!row?.inputs) return []
  const { vix, cnn, bofa, highYield, putCall } = row.inputs
  return [
    { key: "vix", label: "VIX", value: formatMetric(vix, 1) },
    { key: "cnn", label: "CNN F&G", value: formatMetric(cnn, 0) },
    { key: "bofa", label: "BofA", value: formatMetric(bofa, 1) },
    { key: "highYield", label: "HY", value: formatMetric(highYield, 2) },
    { key: "putCall", label: "Put/Call", value: formatMetric(putCall, 2) },
  ]
}

export const __testing__ = {
  V3_PRODUCTION_SIMULATION_IDS,
  HISTORIC_PANIC_MIN,
  TARIFF_V3_MIN,
  TARIFF_V3_MAX,
  YEN_V3_MIN,
  YEN_V3_MAX,
  MODERATE_V3_MIN,
  MODERATE_V3_MAX,
  CURRENT_V3_MAX,
  CURRENT_DELTA_MAX,
  rowToHistoryData,
  scoreBothEngines,
}
