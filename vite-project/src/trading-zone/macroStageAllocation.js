/**
 * 거시 V1 구간 → 권장 주식·현금 비중
 */

/** @typedef {import("../panic-v2/panicMacroV1Status.js").MacroV1StatusId} MacroV1StatusId */

/**
 * @typedef {{
 *   stockPct: number
 *   cashPct: number
 *   stockLabel: string
 *   cashLabel: string
 *   note?: string
 * }} MacroStageAllocation
 */

/** @type {Record<MacroV1StatusId, MacroStageAllocation>} */
export const MACRO_STAGE_ALLOCATION = {
  overheated: {
    stockPct: 40,
    cashPct: 60,
    stockLabel: "주식 40%",
    cashLabel: "현금 60%",
    note: "과열 — 비중 축소·현금 확보",
  },
  neutral: {
    stockPct: 70,
    cashPct: 30,
    stockLabel: "주식 70%",
    cashLabel: "현금 30%",
  },
  interest: {
    stockPct: 80,
    cashPct: 20,
    stockLabel: "주식 80%",
    cashLabel: "현금 20%",
  },
  dca: {
    stockPct: 90,
    cashPct: 10,
    stockLabel: "주식 90%",
    cashLabel: "현금 10%",
    note: "분할매수 구간",
  },
  panicBuy: {
    stockPct: 100,
    cashPct: 0,
    stockLabel: "주식 100%",
    cashLabel: "현금 0%",
    note: "패닉매수 — 현금 투입",
  },
}

/** @param {MacroV1StatusId | string | null | undefined} regimeId */
export function resolveMacroStageAllocation(regimeId) {
  if (!regimeId || typeof regimeId !== "string") return null
  return MACRO_STAGE_ALLOCATION[/** @type {MacroV1StatusId} */ (regimeId)] ?? null
}
