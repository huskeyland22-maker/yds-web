import { resolveMacroV1Status } from "../panic-v2/panicMacroV1Status.js"
import { getFinalScore } from "../utils/tradingScores.js"
import {
  canComputeYds,
  resolveYdsStage,
  YDS_MILESTONE_ORDER,
} from "./ydsHistoricalEventTypes.js"
import { historyDataToPanicPayload } from "./ydsScoreBreakdown.js"
import { getVixV3FinalScore, VIX_V3_ENGINE_NOTE } from "./ydsVixV3Engine.js"

/** Production Candidate — Engine Candidate #1 승격 · V3 엔진 + 6단계 후보 구간 */
export const PRODUCTION_CANDIDATE_V3_ID = "production-candidate-v3"
export const PRODUCTION_CANDIDATE_V3_LABEL = "Production Candidate (VIX V3)"
export const PRODUCTION_CANDIDATE_V3_NOTE = `${VIX_V3_ENGINE_NOTE} · Feature Flag OFF 시 legacy 유지`

/**
 * @typedef {"overheated" | "neutral" | "interest" | "dca" | "panicBuy" | "historicPanic"} ProductionCandidateStageId
 */

/**
 * @typedef {{
 *   id: ProductionCandidateStageId
 *   label: string
 *   emoji: string
 *   min: number
 *   max: number | null
 * }} ProductionCandidateStageBand
 */

/** @type {ProductionCandidateStageBand[]} */
export const PRODUCTION_CANDIDATE_V3_STAGE_BANDS = [
  { id: "overheated", label: "공포 없음", emoji: "🔵", min: 0, max: 24 },
  { id: "neutral", label: "공포 부족", emoji: "🟢", min: 25, max: 49 },
  { id: "interest", label: "관심", emoji: "🟡", min: 50, max: 64 },
  { id: "dca", label: "분할매수", emoji: "🟠", min: 65, max: 79 },
  { id: "panicBuy", label: "인생 타점", emoji: "🔴", min: 80, max: 99 },
  { id: "historicPanic", label: "역사적 패닉", emoji: "🟥", min: 100, max: null },
]

/** 검증 대상 패닉 6건 */
export const PRODUCTION_CANDIDATE_PANIC_IDS = [
  "panic-2008-lehman",
  "panic-2020-covid",
  "panic-2025-tariff-shock",
  "panic-2024-yen-carry",
  "panic-2022-tightening",
  "panic-2023-svb",
]

/** @param {number | null | undefined} score @returns {ProductionCandidateStageBand | null} */
export function resolveProductionCandidateStage(score) {
  if (score == null || !Number.isFinite(score)) return null
  const s = Math.max(0, Math.round(Number(score)))
  return (
    PRODUCTION_CANDIDATE_V3_STAGE_BANDS.find((band) => {
      if (band.max == null) return s >= band.min
      return s >= band.min && s <= band.max
    }) ?? null
  )
}

/** @param {ProductionCandidateStageBand | import("../panic-v2/panicMacroV1Status.js").MacroV1Status | null} stage */
export function formatProductionCandidateStage(stage) {
  if (!stage) return "—"
  return `${stage.emoji ?? ""} ${stage.label ?? ""}`.trim()
}

function scoreMilestonePair(historyData) {
  if (!canComputeYds(historyData)) return null
  const payload = historyDataToPanicPayload(historyData)
  const currentYds = getFinalScore(payload)
  const v3Yds = getVixV3FinalScore(payload)
  return { currentYds, v3Yds }
}

/**
 * @param {import("./ydsHistoricalEventTypes.js").EventDetailData} event
 */
export function buildProductionCandidateEventRow(event) {
  const snapshots = YDS_MILESTONE_ORDER.map((key) => {
    const milestone = event?.milestones?.[key]
    const scored = scoreMilestonePair(milestone?.historyData ?? {})
    return {
      key,
      label: milestone?.label ?? key,
      date: milestone?.date ?? null,
      ...scored,
      computable: scored != null,
    }
  }).filter((s) => s.computable)

  const pickPeak = (field) =>
    snapshots.length > 0
      ? snapshots.reduce(
          (best, cur) => ((cur[field] ?? 0) > (best[field] ?? 0) ? cur : best),
          snapshots[0],
        )
      : null

  const peakCurrent = pickPeak("currentYds")
  const peakV3 = pickPeak("v3Yds")
  const currentYds = peakCurrent?.currentYds ?? null
  const v3Yds = peakV3?.v3Yds ?? null
  const currentStage = resolveYdsStage(currentYds)
  const v3Stage = resolveProductionCandidateStage(v3Yds)

  return {
    id: event.id,
    name: event.name,
    category: event.category,
    currentYds,
    v3Yds,
    delta: currentYds != null && v3Yds != null ? v3Yds - currentYds : null,
    currentStage,
    v3Stage,
    currentStageLabel: currentStage ? `${currentStage.emoji} ${currentStage.label}` : "—",
    v3StageLabel: formatProductionCandidateStage(v3Stage),
    stageChanged: currentStage?.label !== v3Stage?.label,
    peakMilestone: peakV3?.key ?? peakCurrent?.key ?? null,
    peakDate: peakV3?.date ?? peakCurrent?.date ?? null,
    ydsComputable: snapshots.length > 0,
  }
}

/** @deprecated Engine Candidate #1 alias */
export const ENGINE_CANDIDATE_V3_STAGE_BANDS = PRODUCTION_CANDIDATE_V3_STAGE_BANDS
/** @deprecated */
export const resolveCandidateV3Stage = resolveProductionCandidateStage
/** @deprecated */
export const formatCandidateStage = formatProductionCandidateStage
