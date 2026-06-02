import { resolveMacroV1Status } from "../panic-v2/panicMacroV1Status.js"
import { YDS_MILESTONE_ORDER } from "./ydsHistoricalEventTypes.js"
import { computeYdsScore } from "./ydsHistoricalEventTypes.js"
import { FEAR_CLIMAX_ANALYSIS_IDS } from "./ydsPanicFearClimaxAnalysis.js"

/**
 * YDS 구간 시뮬레이션 (getFinalScore 미변경 · 단계 매핑만 실험)
 * @typedef {"overheated" | "neutral" | "interest" | "dca" | "strongFear" | "panicBuy" | "historicPanic"} ExperimentalStageId
 */

/**
 * @typedef {{
 *   id: ExperimentalStageId
 *   label: string
 *   emoji: string
 *   min: number
 *   max: number
 * }} ExperimentalStageBand
 */

/** 0~59: 기존과 동일 · 60+: 세분화 실험안 */
/** @type {ExperimentalStageBand[]} */
export const EXPERIMENTAL_YDS_STAGE_BANDS = [
  { id: "overheated", label: "과열구간", emoji: "🔵", min: 0, max: 19 },
  { id: "neutral", label: "중립구간", emoji: "🟢", min: 20, max: 39 },
  { id: "interest", label: "관심구간", emoji: "🟡", min: 40, max: 59 },
  { id: "dca", label: "분할매수", emoji: "🟠", min: 60, max: 64 },
  { id: "strongFear", label: "강한공포", emoji: "🟣", min: 65, max: 74 },
  { id: "panicBuy", label: "패닉매수", emoji: "🔴", min: 75, max: 84 },
  { id: "historicPanic", label: "역사적패닉", emoji: "⚫", min: 85, max: 100 },
]

export const CURRENT_HIGH_FEAR_BANDS_NOTE =
  "현재(60~79 분할매수 · 80+ 패닉매수) vs 실험(60~64 분할 · 65~74 강한공포 · 75~84 패닉 · 85+ 역사적패닉)"

/** @param {number | null | undefined} score @returns {ExperimentalStageBand | null} */
export function resolveExperimentalYdsStage(score) {
  if (score == null || !Number.isFinite(score)) return null
  const s = Math.max(0, Math.min(100, Math.round(Number(score))))
  return EXPERIMENTAL_YDS_STAGE_BANDS.find((band) => s >= band.min && s <= band.max) ?? null
}

/** @param {ExperimentalStageBand | import("../panic-v2/panicMacroV1Status.js").MacroV1Status | null} stage */
export function formatSimulationStage(stage) {
  if (!stage) return "—"
  return `${stage.emoji ?? ""} ${stage.label ?? ""}`.trim()
}

/**
 * @param {import("./ydsHistoricalEventTypes.js").EventDetailData} event
 */
export function buildStageSimulationRow(event) {
  const snapshots = YDS_MILESTONE_ORDER.map((key) => {
    const h = event?.milestones?.[key]?.historyData
    const yds = computeYdsScore(h)
    return {
      key,
      date: event?.milestones?.[key]?.date ?? null,
      yds,
    }
  }).filter((s) => s.yds != null)

  const peak =
    snapshots.length > 0
      ? snapshots.reduce((best, cur) => (cur.yds > best.yds ? cur : best), snapshots[0])
      : null

  const maxYds = peak?.yds ?? null
  const currentStage = resolveMacroV1Status(maxYds)
  const experimentalStage = resolveExperimentalYdsStage(maxYds)
  const stageChanged =
    currentStage && experimentalStage ? currentStage.label !== experimentalStage.label : false

  return {
    id: event.id,
    name: event.name,
    maxYds,
    peakMilestone: peak?.key ?? null,
    peakDate: peak?.date ?? null,
    currentStage,
    experimentalStage,
    stageChanged,
    currentLabel: currentStage?.label ?? "—",
    experimentalLabel: experimentalStage?.label ?? "—",
  }
}

/**
 * @param {import("./ydsHistoricalEventTypes.js").EventDetailData[]} events
 */
export function buildStageSimulationReport(events) {
  const rows = events
    .filter((e) => FEAR_CLIMAX_ANALYSIS_IDS.includes(e.id))
    .map(buildStageSimulationRow)
    .filter((r) => r.maxYds != null)
    .sort((a, b) => (b.maxYds ?? 0) - (a.maxYds ?? 0))

  const changedCount = rows.filter((r) => r.stageChanged).length

  return {
    rows,
    summary: {
      compared: rows.length,
      changedCount,
      unchangedCount: rows.length - changedCount,
    },
    notes: [
      CURRENT_HIGH_FEAR_BANDS_NOTE,
      "최고 YDS = 이벤트 내 5개 milestone 중 계산 가능한 최대값(기존 getFinalScore 결과).",
      "엔진·가중치는 변경하지 않으며, 단계 라벨 매핑만 실험합니다.",
    ],
  }
}
