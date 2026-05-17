/**
 * 03 글로벌 메가트렌드 (예정) — 미국 종목·ETF·글로벌 기업
 * 코리아 밸류체인(v1)과 분리. 추후 GlobalMegatrendPage에서 사용.
 *
 * @typedef {{ name: string; ticker: string; tip?: string; market?: string }} GlobalStockRef
 * @typedef {{
 *   id: string
 *   name: string
 *   region: "US" | "EU" | "GLOBAL"
 *   stocks: GlobalStockRef[]
 * }} GlobalMegatrendSector
 */

/** @type {GlobalMegatrendSector[]} */
export const GLOBAL_MEGATREND_MAP = []

export const GLOBAL_MEGATREND_ENABLED = false
