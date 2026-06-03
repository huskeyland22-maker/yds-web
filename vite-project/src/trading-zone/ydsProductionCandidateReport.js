import { resolveMacroV1Status } from "../panic-v2/panicMacroV1Status.js"
import { describeEngineFeatureFlagState } from "./ydsEngineFeatureFlag.js"
import { YDS_VALIDATION_EVENT_CATEGORY_LABEL } from "./ydsHistoricalValidationEvents.js"
import {
  buildProductionCandidateEventRow,
  PRODUCTION_CANDIDATE_PANIC_IDS,
  PRODUCTION_CANDIDATE_V3_LABEL,
  PRODUCTION_CANDIDATE_V3_NOTE,
  PRODUCTION_CANDIDATE_V3_STAGE_BANDS,
  resolveProductionCandidateStage,
} from "./ydsProductionCandidateV3.js"
import {
  buildV3ProductionCurrentMarketRow,
  formatCurrentMarketInputs,
} from "./ydsV3ProductionSimulation.js"

const NATURAL_ORDER_IDS = [
  "panic-2008-lehman",
  "panic-2020-covid",
  "panic-2025-tariff-shock",
  "panic-2024-yen-carry",
]

const HISTORIC_PANIC_MIN = 100
const PANIC_BUY_MIN = 80
const CURRENT_V3_MAX = 79
const CURRENT_DELTA_MAX = 18

/** @typedef {"A" | "B" | "C"} ProductionCandidateVerdictId */

/**
 * @param {ReturnType<typeof buildProductionCandidateEventRow>[]} rows
 */
function groupRowsByCategory(rows) {
  /** @type {Record<string, ReturnType<typeof buildProductionCandidateEventRow>[]>} */
  const groups = {}
  for (const row of rows) {
    if (!groups[row.category]) groups[row.category] = []
    groups[row.category].push(row)
  }
  for (const key of Object.keys(groups)) {
    groups[key].sort((a, b) => (b.v3Yds ?? 0) - (a.v3Yds ?? 0))
  }
  return groups
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
 * @param {ReturnType<typeof buildProductionCandidateEventRow>[]} rows
 * @param {ReturnType<typeof buildV3ProductionCurrentMarketRow>} currentMarket
 */
function buildFinalJudgments(rows, currentMarket) {
  const lehman = rows.find((r) => r.id === "panic-2008-lehman")
  const covid = rows.find((r) => r.id === "panic-2020-covid")
  const tariff = rows.find((r) => r.id === "panic-2025-tariff-shock")
  const yen = rows.find((r) => r.id === "panic-2024-yen-carry")
  const tightening = rows.find((r) => r.id === "panic-2022-tightening")
  const svb = rows.find((r) => r.id === "panic-2023-svb")

  const panicRows = rows.filter((r) => r.category === "panic" && r.ydsComputable)
  const overheatedRows = rows.filter((r) => r.category === "overheated" && r.ydsComputable)
  const dcaRows = rows.filter((r) => r.category === "dca" && r.ydsComputable)

  const stageChangedCount = rows.filter((r) => r.stageChanged).length
  const historicStageCount = panicRows.filter((r) => r.v3Stage?.id === "historicPanic").length
  const explainabilityIncreased =
    stageChangedCount >= Math.ceil(rows.length * 0.3) &&
    historicStageCount >= 2 &&
    panicRows.filter((r) => r.stageChanged).length >= 3

  const historicPanicSeparated =
    (lehman?.v3Yds ?? 0) >= HISTORIC_PANIC_MIN &&
    (covid?.v3Yds ?? 0) >= HISTORIC_PANIC_MIN &&
    (tariff?.v3Yds ?? 0) >= PANIC_BUY_MIN &&
    (tariff?.v3Yds ?? 0) < HISTORIC_PANIC_MIN &&
    lehman?.v3Stage?.id === "historicPanic" &&
    covid?.v3Stage?.id === "historicPanic" &&
    tariff?.v3Stage?.id === "panicBuy"

  const currentMarketOk =
    currentMarket.ydsComputable &&
    (currentMarket.v3Yds ?? 0) <= CURRENT_V3_MAX &&
    Math.abs(currentMarket.delta ?? 0) <= CURRENT_DELTA_MAX &&
    resolveProductionCandidateStage(currentMarket.v3Yds)?.id !== "panicBuy" &&
    resolveProductionCandidateStage(currentMarket.v3Yds)?.id !== "historicPanic"

  const overheatedLow = overheatedRows.filter(
    (r) => (r.v3Yds ?? 100) <= 49 && ["overheated", "neutral"].includes(r.v3Stage?.id ?? ""),
  )
  const moderateOk =
    (yen?.v3Yds ?? 0) < PANIC_BUY_MIN &&
    (tightening?.v3Yds ?? 0) < PANIC_BUY_MIN &&
    (svb?.v3Yds ?? 0) < PANIC_BUY_MIN
  const dcaInBand = dcaRows.filter((r) => ["interest", "dca"].includes(r.v3Stage?.id ?? ""))
  const naturalOrder = checkNaturalOrder(rows)

  const overheatedOk =
    overheatedRows.length === 0 ||
    overheatedLow.length >= Math.min(2, overheatedRows.length)
  const dcaOk =
    dcaRows.length === 0 || dcaInBand.length >= Math.min(2, dcaRows.length)

  const philosophyAligned = naturalOrder && moderateOk && overheatedOk && dcaOk

  return {
    explainabilityIncreased: {
      pass: explainabilityIncreased,
      detail: `단계 변경 ${stageChangedCount}/${rows.length}건 · V3 역사적패닉 ${historicStageCount}건 · 패닉 이벤트 세분화`,
    },
    historicPanicSeparated: {
      pass: historicPanicSeparated,
      detail: `리먼 ${lehman?.v3Yds}(${lehman?.v3StageLabel}) · 코로나 ${covid?.v3Yds}(${covid?.v3StageLabel}) · 관세 ${tariff?.v3Yds}(${tariff?.v3StageLabel})`,
    },
    currentMarketOk: {
      pass: currentMarketOk,
      detail: currentMarket.ydsComputable
        ? `현재 ${currentMarket.currentYds}→V3 ${currentMarket.v3Yds} (Δ${currentMarket.delta >= 0 ? "+" : ""}${currentMarket.delta})`
        : "최신 스냅샷 없음",
    },
    philosophyAligned: {
      pass: philosophyAligned,
      detail: `자연순서 ${naturalOrder ? "✓" : "✗"} · 저VIX/중간 ${moderateOk ? "✓" : "✗"} · 과열 저점 ${overheatedLow.length}/${overheatedRows.length} · DCA 적합 ${dcaInBand.length}/${dcaRows.length}`,
    },
  }
}

/**
 * @param {ReturnType<typeof buildFinalJudgments>} judgments
 * @returns {{ id: ProductionCandidateVerdictId; label: string; emoji: string; summary: string; passCount: number; totalChecks: number }}
 */
function buildProductionVerdict(judgments) {
  const checks = Object.values(judgments)
  const passCount = checks.filter((c) => c.pass).length
  const totalChecks = checks.length

  if (passCount === totalChecks) {
    return {
      id: "A",
      label: "A. 프로덕션 반영 추천",
      emoji: "✅",
      summary:
        "V3 Production Candidate가 단계 설명력·역사적 패닉 분리·현재 시장 안정·철학 정렬 목표를 충족합니다. Feature Flag(VITE_USE_VIX_V3_ENGINE)로 단계적 롤아웃 가능.",
      passCount,
      totalChecks,
    }
  }
  if (passCount <= 1) {
    return {
      id: "C",
      label: "C. 기각",
      emoji: "❌",
      summary: `Production Candidate가 핵심 검증 ${passCount}/${totalChecks}만 통과 — legacy getFinalScore 유지 권장.`,
      passCount,
      totalChecks,
    }
  }
  return {
    id: "B",
    label: "B. 추가 보정 필요",
    emoji: "⚠️",
    summary: `Production Candidate ${passCount}/${totalChecks} 통과 — 앵커·구간·표본 추가 검증 후 Feature Flag 활성화 검토.`,
    passCount,
    totalChecks,
  }
}

/**
 * @param {import("./ydsHistoricalEventTypes.js").EventDetailData[]} events
 * @param {{ latestSnapshot?: Record<string, unknown> | null }} [options]
 */
export function buildProductionCandidateReport(events, options = {}) {
  const allRows = events.map(buildProductionCandidateEventRow)
  const rows = allRows.filter((r) => r.ydsComputable)
  const panicRows = rows.filter((r) => PRODUCTION_CANDIDATE_PANIC_IDS.includes(r.id))
  const currentMarket = buildV3ProductionCurrentMarketRow(options.latestSnapshot ?? null)
  const categoryGroups = groupRowsByCategory(allRows)
  const judgments = buildFinalJudgments(rows, currentMarket)
  const verdict = buildProductionVerdict(judgments)
  const featureFlag = describeEngineFeatureFlagState()

  return {
    label: PRODUCTION_CANDIDATE_V3_LABEL,
    allRows,
    panicRows,
    categoryGroups,
    categoryLabels: YDS_VALIDATION_EVENT_CATEGORY_LABEL,
    currentMarket,
    currentMarketInputs: formatCurrentMarketInputs(currentMarket),
    stageBands: PRODUCTION_CANDIDATE_V3_STAGE_BANDS,
    judgments,
    verdict,
    featureFlag,
    summary: {
      totalEvents: allRows.length,
      computableEvents: rows.length,
      stageChangedCount: rows.filter((r) => r.stageChanged).length,
      panicCompared: panicRows.length,
      currentEngineBands: "MACRO_V1_STATUS_BANDS (5단계)",
      v3EngineBands: "PRODUCTION_CANDIDATE_V3 (6단계, 100+ 역사적패닉)",
    },
    notes: [
      PRODUCTION_CANDIDATE_V3_NOTE,
      "getFinalScore(legacy) 기본 유지 · VITE_USE_VIX_V3_ENGINE=true 시 getActiveYdsScore가 V3 사용.",
      "검증 페이지는 항상 legacy vs V3 dual 비교.",
      "최종 승인 전 Feature Flag OFF = 프로덕션 legacy.",
    ],
  }
}

export { resolveMacroV1Status }
