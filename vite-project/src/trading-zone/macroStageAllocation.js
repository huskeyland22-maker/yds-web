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
    stockPct: 30,
    cashPct: 70,
    stockLabel: "주식 30%",
    cashLabel: "현금 70%",
    note: "과열 구간 · 현금 확보 우선",
  },
  neutral: {
    stockPct: 60,
    cashPct: 40,
    stockLabel: "주식 60%",
    cashLabel: "현금 40%",
    note: "기본 포지션 유지 · 추가 기회를 위한 현금 확보",
  },
  interest: {
    stockPct: 75,
    cashPct: 25,
    stockLabel: "주식 75%",
    cashLabel: "현금 25%",
    note: "1차 기회 · 좋은 기업 탐색 · 분할 준비",
  },
  dca: {
    stockPct: 90,
    cashPct: 10,
    stockLabel: "주식 90%",
    cashLabel: "현금 10%",
    note: "핵심 매집 · 비중 확대 · 주력 투자 구간",
  },
  panicBuy: {
    stockPct: 100,
    cashPct: 0,
    stockLabel: "주식 100%",
    cashLabel: "현금 0%",
    note: "보너스 구간 · 극단 공포 · 드문 기회",
  },
}

/** @param {MacroV1StatusId | string | null | undefined} regimeId */
export function resolveMacroStageAllocation(regimeId) {
  if (!regimeId || typeof regimeId !== "string") return null
  return MACRO_STAGE_ALLOCATION[/** @type {MacroV1StatusId} */ (regimeId)] ?? null
}
