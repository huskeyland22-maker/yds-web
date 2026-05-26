import { MACRO_V1_STATUS_BANDS } from "../panic-v2/panicMacroV1Status.js"

/** @typedef {import("../panic-v2/panicMacroV1Status.js").MacroV1StatusId} HomeV5RegimeId */

/** @param {object | null | undefined} panicData @param {string} key */
function pickNum(panicData, key) {
  const n = Number(panicData?.[key])
  return Number.isFinite(n) ? n : null
}

/** @param {HomeV5RegimeId} id */
function bandById(id) {
  return MACRO_V1_STATUS_BANDS.find((b) => b.id === id) ?? null
}

/**
 * 홈 v5 전략 레짐 — CNN·VIX·BofA 규칙 (V1 점수 밴드 미사용)
 * 우선순위: 패닉 → 분할 → 관심 → 과열 → 중립
 *
 * @param {object | null | undefined} panicData
 * @returns {import("../panic-v2/panicMacroV1Status.js").MacroV1Status | null}
 */
export function resolveHomeV5StrategyRegime(panicData) {
  if (!panicData) return null

  const fg = pickNum(panicData, "fearGreed")
  const vix = pickNum(panicData, "vix")
  const bofa = pickNum(panicData, "bofa")

  if (fg == null && vix == null && bofa == null) return null

  if (fg != null && vix != null && fg < 10 && vix >= 35) {
    return bandById("panicBuy")
  }
  if (fg != null && vix != null && fg < 25 && vix >= 25) {
    return bandById("dca")
  }
  if (fg != null && fg < 30) {
    return bandById("interest")
  }
  if (fg != null && bofa != null && fg >= 70 && bofa >= 7) {
    return bandById("overheated")
  }

  return bandById("neutral")
}
