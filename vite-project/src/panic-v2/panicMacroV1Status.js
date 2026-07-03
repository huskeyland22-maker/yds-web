/**
 * 거시 V1 — 패닉 강도 구간 (높을수록 매수 기회 · V1.8 패닉 언어)
 */

import { PANIC_STATUS_BANDS } from "../content/ydsStatusLabels.js"
import {
  MACRO_STAGE_BOUNDS,
  MACRO_STAGE_ORDER,
  MACRO_STAGE_TO_PANIC_BAND,
} from "../content/ydsLanguage.js"

/** @typedef {import("../content/ydsLanguage.js").MacroV1StatusId} MacroV1StatusId */

/**
 * @typedef {{
 *   id: MacroV1StatusId
 *   label: string
 *   emoji: string
 *   min: number
 *   max: number
 *   color: string
 * }} MacroV1Status
 */

/** @type {MacroV1Status[]} */
export const MACRO_V1_STATUS_BANDS = MACRO_STAGE_ORDER.map((id) => {
  const panicId = MACRO_STAGE_TO_PANIC_BAND[id]
  const panic = PANIC_STATUS_BANDS.find((b) => b.id === panicId)
  const bounds = MACRO_STAGE_BOUNDS[id]
  return {
    id,
    label: panic?.label ?? id,
    emoji: panic?.emoji ?? "—",
    min: bounds.min,
    max: bounds.max,
    color: panic?.color ?? "#94a3b8",
  }
})

/** @param {number | null | undefined} score @returns {MacroV1Status | null} */
export function resolveMacroV1Status(score) {
  if (score == null || !Number.isFinite(score)) return null
  const s = Math.max(0, Math.min(100, Math.round(Number(score))))
  if (s <= 20) return MACRO_V1_STATUS_BANDS[0]
  if (s <= 40) return MACRO_V1_STATUS_BANDS[1]
  if (s <= 60) return MACRO_V1_STATUS_BANDS[2]
  if (s <= 80) return MACRO_V1_STATUS_BANDS[3]
  return MACRO_V1_STATUS_BANDS[4]
}

/** @returns {{ y1: number; y2: number; label: string; color: string; area: boolean }[]} */
export function macroV1ZoneBands() {
  return MACRO_V1_STATUS_BANDS.map((b) => ({
    y1: b.min,
    y2: b.id === "panicBuy" ? 100 : b.max + 1,
    label: b.label,
    color: b.color,
    area: true,
  }))
}
