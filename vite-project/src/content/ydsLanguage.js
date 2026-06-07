/**
 * YDS V1.8 — 사이트 전역 언어 (UI·카피 전용 · 엔진 ID 유지)
 * 사이클 = 시장 위치 · 패닉 = 매수 기회
 */

import { PANIC_STATUS_BANDS } from "./ydsStatusLabels.js"

/** @typedef {"overheated" | "neutral" | "interest" | "dca" | "panicBuy"} MacroV1StatusId */
/** @typedef {"noFear" | "lowFear" | "interest" | "dca" | "lifePoint"} PanicBandId */

export const YDS_LABEL_PANIC_SCORE = "패닉 강도"
export const YDS_LABEL_PANIC_HISTORY = "패닉 강도 히스토리"
export const YDS_LABEL_CYCLE_POSITION = "사이클 위치"
export const YDS_LABEL_PANIC_BREAKDOWN = "패닉 강도 산출 근거"

export const YDS_PANIC_RAIL_LABELS =
  "🔵 공포 없음 · 🟢 공포 부족 · 🟡 관심 · 🟠 분할매수 · 🔴 인생 타점"

export const YDS_CYCLE_RAIL_LABELS =
  "🔵 침체 · 🟢 회복 · 🟡 성장 · 🟠 사이클 후반 · 🔴 현금 준비 · 🔴 최고 과열"

export const YDS_CYCLE_TAGLINE_V18 =
  "관심에서 쌓고, 분할매수에서 실행한다. 인생 타점은 보너스다."

export const YDS_CYCLE_TAGLINE_SUB_V18 =
  "인생 타점을 기다리지 않습니다. 관심·분할매수가 실전 매수 기회의 중심입니다."

export const YDS_DUAL_LAYER_DISCOVERY =
  "패닉 강도(장기) → Momentum(변화율) → Event(구간 이탈) · 3계층"

/** @type {Record<MacroV1StatusId, import("./ydsStatusLabels.js").PanicBandId>} */
export const MACRO_STAGE_TO_PANIC_BAND = {
  overheated: "noFear",
  neutral: "lowFear",
  interest: "interest",
  dca: "dca",
  panicBuy: "lifePoint",
}

/**
 * @param {string | null | undefined} stageId
 */
export function resolvePanicBandForMacroStage(stageId) {
  const panicId = MACRO_STAGE_TO_PANIC_BAND[/** @type {MacroV1StatusId} */ (stageId)]
  if (!panicId) return null
  return PANIC_STATUS_BANDS.find((b) => b.id === panicId) ?? null
}

/**
 * @param {string | null | undefined} stageId
 */
export function macroStageDisplayLabel(stageId) {
  return resolvePanicBandForMacroStage(stageId)?.label ?? "공포 부족"
}

/**
 * @param {string | null | undefined} stageId
 */
export function macroStageDisplayEmoji(stageId) {
  return resolvePanicBandForMacroStage(stageId)?.emoji ?? "🟢"
}

/** @type {Record<MacroV1StatusId, { min: number; max: number }>} */
export const MACRO_STAGE_BOUNDS = {
  overheated: { min: 0, max: 19 },
  neutral: { min: 20, max: 39 },
  interest: { min: 40, max: 59 },
  dca: { min: 60, max: 79 },
  panicBuy: { min: 80, max: 100 },
}

/** @type {MacroV1StatusId[]} */
export const MACRO_STAGE_ORDER = ["overheated", "neutral", "interest", "dca", "panicBuy"]
