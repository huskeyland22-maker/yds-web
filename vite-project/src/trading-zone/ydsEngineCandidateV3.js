import { resolveYdsStage } from "./ydsHistoricalEventTypes.js"
import { PANIC_PEAK_RANKING_IDS } from "./ydsPanicPeakRankingReport.js"
import {
  buildVixSensitivityEventRow,
  VIX_EXPERIMENT_V3_ANCHORS,
} from "./ydsVixSensitivityLab.js"

/** Engine Candidate #1 = VIX V3 + 후보 단계 체계 (검증 전용 · 프로덕션 미반영) */
export const ENGINE_CANDIDATE_V3_ID = "engine-candidate-v3-vix"

export const ENGINE_CANDIDATE_V3_LABEL = "Engine Candidate #1 (V3)"

export const ENGINE_CANDIDATE_V3_NOTE =
  "VIX V3 scoreVIX(40→100 · 50→125 · 70→195 · 80→250) + 7단계 후보 구간 · getFinalScore 프로덕션 미변경"

/**
 * @typedef {"overheated" | "neutral" | "interest" | "dca" | "strongFear" | "panicBuy" | "historicPanic"} CandidateV3StageId
 */

/**
 * @typedef {{
 *   id: CandidateV3StageId
 *   label: string
 *   emoji: string
 *   min: number
 *   max: number | null
 * }} CandidateV3StageBand
 */

/** @type {CandidateV3StageBand[]} */
export const ENGINE_CANDIDATE_V3_STAGE_BANDS = [
  { id: "overheated", label: "과열", emoji: "🔵", min: 0, max: 19 },
  { id: "neutral", label: "중립", emoji: "🟢", min: 20, max: 39 },
  { id: "interest", label: "관심", emoji: "🟡", min: 40, max: 59 },
  { id: "dca", label: "분할매수", emoji: "🟠", min: 60, max: 69 },
  { id: "strongFear", label: "강한 공포", emoji: "🔴", min: 70, max: 84 },
  { id: "panicBuy", label: "패닉매수", emoji: "🚨", min: 85, max: 99 },
  { id: "historicPanic", label: "역사적 패닉", emoji: "💀", min: 100, max: null },
]

const NATURAL_ORDER_IDS = [
  "panic-2008-lehman",
  "panic-2020-covid",
  "panic-2025-tariff-shock",
  "panic-2024-yen-carry",
]

const COVID_TARIFF_GAP_MIN = 10
const HISTORIC_PANIC_MIN = 100
const PANIC_BUY_MIN = 85

/** @param {number | null | undefined} score @returns {CandidateV3StageBand | null} */
export function resolveCandidateV3Stage(score) {
  if (score == null || !Number.isFinite(score)) return null
  const s = Math.max(0, Math.round(Number(score)))
  return (
    ENGINE_CANDIDATE_V3_STAGE_BANDS.find((band) => {
      if (band.max == null) return s >= band.min
      return s >= band.min && s <= band.max
    }) ?? null
  )
}

/** @param {CandidateV3StageBand | import("../panic-v2/panicMacroV1Status.js").MacroV1Status | null} stage */
export function formatCandidateStage(stage) {
  if (!stage) return "—"
  return `${stage.emoji ?? ""} ${stage.label ?? ""}`.trim()
}

/**
 * @param {import("./ydsHistoricalEventTypes.js").EventDetailData} event
 */
export function buildEngineCandidateV3EventRow(event) {
  const vixRow = buildVixSensitivityEventRow(event)
  const currentYds = vixRow.currentMaxYds
  const candidateYds = vixRow.v3MaxYds
  const currentStage = resolveYdsStage(currentYds)
  const candidateStage = resolveCandidateV3Stage(candidateYds)
  const stageChanged = currentStage?.label !== candidateStage?.label

  return {
    id: event.id,
    name: event.name,
    currentYds,
    candidateYds,
    delta: candidateYds != null && currentYds != null ? candidateYds - currentYds : null,
    peakMilestone: vixRow.peakMilestone,
    peakDate: vixRow.peakDate,
    currentStage,
    candidateStage,
    currentStageLabel: formatCandidateStage(currentStage),
    candidateStageLabel: formatCandidateStage(candidateStage),
    stageChanged,
    ydsComputable: vixRow.ydsComputable,
  }
}

function checkNaturalOrder(rows) {
  const scores = NATURAL_ORDER_IDS.map((id) => rows.find((r) => r.id === id)?.candidateYds).filter(
    (s) => s != null,
  )
  if (scores.length !== NATURAL_ORDER_IDS.length) return false
  for (let i = 0; i < scores.length - 1; i += 1) {
    if (scores[i] <= scores[i + 1]) return false
  }
  return true
}

/**
 * @param {ReturnType<typeof buildEngineCandidateV3EventRow>[]} rows
 */
function buildFinalValidation(rows) {
  const lehman = rows.find((r) => r.id === "panic-2008-lehman")
  const covid = rows.find((r) => r.id === "panic-2020-covid")
  const tariff = rows.find((r) => r.id === "panic-2025-tariff-shock")
  const yen = rows.find((r) => r.id === "panic-2024-yen-carry")
  const tightening = rows.find((r) => r.id === "panic-2022-tightening")
  const svb = rows.find((r) => r.id === "panic-2023-svb")

  const covidTariffGap = (covid?.candidateYds ?? 0) - (tariff?.candidateYds ?? 0)

  const historicPanicSeparated =
    (lehman?.candidateYds ?? 0) >= HISTORIC_PANIC_MIN &&
    (covid?.candidateYds ?? 0) >= HISTORIC_PANIC_MIN &&
    (tariff?.candidateYds ?? 0) < HISTORIC_PANIC_MIN

  const yenAppropriate =
    (yen?.candidateYds ?? 0) < PANIC_BUY_MIN &&
    yen?.candidateStage?.id !== "historicPanic"

  const moderateEventsOk =
    (tightening?.candidateYds ?? 0) < PANIC_BUY_MIN &&
    (svb?.candidateYds ?? 0) < PANIC_BUY_MIN

  const naturalOrder = checkNaturalOrder(rows)

  return {
    historicPanicSeparated: {
      pass: historicPanicSeparated,
      detail: `리먼 ${lehman?.candidateYds}(${lehman?.candidateStageLabel}) · 코로나 ${covid?.candidateYds}(${covid?.candidateStageLabel}) · 관세 ${tariff?.candidateYds}(${tariff?.candidateStageLabel})`,
    },
    covidTariffGap: {
      pass: covidTariffGap >= COVID_TARIFF_GAP_MIN,
      gap: covidTariffGap,
      detail: `코로나−관세 ${covidTariffGap}p (기준 ≥${COVID_TARIFF_GAP_MIN}p)`,
    },
    yenPosition: {
      pass: yenAppropriate,
      detail: `엔캐리 YDS ${yen?.candidateYds} → ${yen?.candidateStageLabel} (패닉매수·역사적패닉 미진입)`,
    },
    moderateEvents: {
      pass: moderateEventsOk,
      detail: `긴축 ${tightening?.candidateYds}(${tightening?.candidateStageLabel}) · SVB ${svb?.candidateYds}(${svb?.candidateStageLabel}) — 85 미만`,
    },
    naturalOrder: {
      pass: naturalOrder,
      detail: "리먼 > 코로나 > 관세 > 엔캐리 (V3 YDS)",
    },
  }
}

/**
 * @param {ReturnType<typeof buildFinalValidation>} validation
 */
function buildVerdict(validation) {
  const checks = [
    validation.historicPanicSeparated.pass,
    validation.covidTariffGap.pass,
    validation.yenPosition.pass,
    validation.moderateEvents.pass,
    validation.naturalOrder.pass,
  ]
  const passCount = checks.filter(Boolean).length

  if (passCount === checks.length) {
    return {
      id: "adopt",
      label: "채택 추천",
      emoji: "✅",
      summary:
        "V3 후보 엔진·7단계 체계가 역사 검증 목표(역사적패닉 분리·관세−코로나 격차·저VIX 왜곡 없음·자연스러운 순서)를 충족합니다. 프로덕션 반영 전 실시간 지표·백테스트 추가 검증 권장.",
    }
  }
  if (passCount <= 2) {
    return {
      id: "reject",
      label: "기각",
      emoji: "❌",
      summary: `V3 후보가 핵심 검증 ${passCount}/${checks.length}만 통과 — 현재 프로덕션 엔진 유지 권장.`,
    }
  }
  return {
    id: "needs_validation",
    label: "추가 검증 필요",
    emoji: "⚠️",
    summary: `V3 후보 ${passCount}/${checks.length} 통과 — 일부 목표 미달, 실시간·추가 표본 검증 후 재판정.`,
  }
}

/**
 * @param {import("./ydsHistoricalEventTypes.js").EventDetailData[]} events
 */
export function buildEngineCandidateV3Report(events) {
  const rows = events
    .filter((e) => PANIC_PEAK_RANKING_IDS.includes(e.id))
    .map(buildEngineCandidateV3EventRow)
    .filter((r) => r.ydsComputable)
    .sort((a, b) => (b.candidateYds ?? 0) - (a.candidateYds ?? 0))

  const finalValidation = buildFinalValidation(rows)
  const verdict = buildVerdict(finalValidation)
  const stageChangedCount = rows.filter((r) => r.stageChanged).length

  return {
    rows,
    stageBands: ENGINE_CANDIDATE_V3_STAGE_BANDS,
    finalValidation,
    verdict,
    summary: {
      compared: rows.length,
      stageChangedCount,
      candidateAnchors: VIX_EXPERIMENT_V3_ANCHORS.filter((a) => a.vix >= 40),
    },
    notes: [
      ENGINE_CANDIDATE_V3_NOTE,
      "최종 승인 전까지 프로덕션 getFinalScore·MACRO_V1_STATUS_BANDS 유지.",
      "후보 YDS = VIX V3 실험 경로 milestone 최고값.",
    ],
  }
}

export { VIX_EXPERIMENT_V3_ANCHORS, NATURAL_ORDER_IDS }
