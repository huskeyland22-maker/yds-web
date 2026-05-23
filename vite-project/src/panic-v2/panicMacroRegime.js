/**
 * 거시 V1 — 시장 국면 (패닉지수 조합 0~100, 높을수록 공포·역발상 매수 국면)
 */

/** @typedef {"crisis" | "danger" | "caution" | "neutral" | "easing"} MacroRegimeId */

/**
 * @typedef {{
 *   id: MacroRegimeId
 *   label: string
 *   min: number
 *   max: number
 *   color: string
 * }} MacroRegimeBand
 */

/** @type {MacroRegimeBand[]} */
export const MACRO_REGIME_BANDS = [
  { id: "crisis", label: "위기", min: 0, max: 20, color: "#dc2626" },
  { id: "danger", label: "위험", min: 20, max: 40, color: "#ef4444" },
  { id: "caution", label: "경계", min: 40, max: 60, color: "#f97316" },
  { id: "neutral", label: "중립", min: 60, max: 80, color: "#94a3b8" },
  { id: "easing", label: "완화", min: 80, max: 100, color: "#22d3ee" },
]

/** @param {number | null | undefined} score */
export function resolveMacroRegime(score) {
  const s = Number(score)
  if (!Number.isFinite(s)) return null
  if (s < 20) return MACRO_REGIME_BANDS[0]
  if (s < 40) return MACRO_REGIME_BANDS[1]
  if (s < 60) return MACRO_REGIME_BANDS[2]
  if (s < 80) return MACRO_REGIME_BANDS[3]
  return MACRO_REGIME_BANDS[4]
}

/** @returns {{ y1: number; y2: number; label: string; color: string; area: boolean }[]} */
export function macroRegimeZoneBands() {
  return MACRO_REGIME_BANDS.map((b) => ({
    y1: b.min,
    y2: b.max,
    label: b.label,
    color: b.color,
    area: true,
  }))
}
