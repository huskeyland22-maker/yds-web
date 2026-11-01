/**
 * YDS Phase 3-4 / 4-x — 미국·한국·현금 자산 배분
 */

/** @typedef {import("./ydsMarketAdapter.js").YdsMarketAdapterContext} YdsMarketAdapterContext */

/**
 * @typedef {{
 *   usPct: number
 *   krPct: number
 *   cashPct: number
 *   stockPct: number
 *   note: string
 *   available?: boolean
 * }} AssetAllocation
 */

/** @typedef {{ usPct: number; krPct: number; cashPct: number }} AssetHoldings */

/** Official 점수 결측 시 — 중립/공포 부족 배분으로 위장하지 않음 */
const UNAVAILABLE_ASSET_ALLOCATION = /** @type {AssetAllocation} */ ({
  usPct: 0,
  krPct: 0,
  cashPct: 0,
  stockPct: 0,
  note: "데이터 부족 · 배분 산출 불가",
  available: false,
})

/** @type {Record<string, { us: number; kr: number; cash: number; note: string }>} */
const BASE_ASSET = {
  overheated: { us: 20, kr: 10, cash: 70, note: "공포 없음 · 현금 확보" },
  neutral: { us: 25, kr: 15, cash: 60, note: "공포 부족 · 방어적 배분" },
  interest: { us: 45, kr: 25, cash: 30, note: "관심 구간 · 분할 진입" },
  dca: { us: 55, kr: 30, cash: 15, note: "분할매수 · 비중 확대" },
  panicBuy: { us: 65, kr: 30, cash: 5, note: "인생 타점 · 공격적 배분" },
}

/**
 * 어댑터 Official 결측·미준비 컨텍스트 여부.
 * `{}`·부분 객체(레거시 호출)는 false — 기존 neutral 폴백 유지.
 * @param {YdsMarketAdapterContext | Record<string, unknown> | null | undefined} context
 */
export function isMarketContextScoreInsufficient(context) {
  if (!context || typeof context !== "object") return false
  if (context.scoreStatus === "dataInsufficient") return true
  if (context.ready === false) return true
  if (context.macroId === "unknown") return true
  return false
}

/** @type {Record<string, { us: number; kr: number; cash: number }>} */
const CYCLE_ASSET_ADJUST = {
  normal: { us: 0, kr: 0, cash: 0 },
  warning: { us: -2, kr: -1, cash: 3 },
  cashPrep: { us: -3, kr: -2, cash: 5 },
  partialCash: { us: -5, kr: -3, cash: 8 },
}

/** @param {number} n */
function clampPct(n) {
  return Math.max(0, Math.min(100, Math.round(n)))
}

/**
 * @param {YdsMarketAdapterContext} context
 * @returns {AssetAllocation}
 */
export function computeRecommendedAssetAllocation(context) {
  const ctx = context && typeof context === "object" ? context : {}
  if (isMarketContextScoreInsufficient(ctx)) {
    return { ...UNAVAILABLE_ASSET_ALLOCATION }
  }

  const macroId = ctx.macroId ?? "neutral"
  const base = BASE_ASSET[macroId] ?? BASE_ASSET.neutral

  let usPct = base.us
  let krPct = base.kr
  let cashPct = base.cash

  const adj = CYCLE_ASSET_ADJUST[ctx.cycleStageId] ?? CYCLE_ASSET_ADJUST.normal
  usPct += adj.us
  krPct += adj.kr
  cashPct += adj.cash

  if (ctx.isDefensive && macroId === "neutral") {
    cashPct = Math.max(cashPct, 55)
    const stockTotal = 100 - cashPct
    usPct = Math.round(stockTotal * 0.625)
    krPct = stockTotal - usPct
  }

  usPct = clampPct(usPct)
  krPct = clampPct(krPct)
  cashPct = clampPct(100 - usPct - krPct)

  return {
    usPct,
    krPct,
    cashPct,
    stockPct: usPct + krPct,
    note: base.note,
    available: true,
  }
}

/**
 * @param {AssetAllocation} recommended
 * @param {AssetHoldings} current
 */
export function deriveAssetRebalance(recommended, current) {
  const usDiff = current.usPct - recommended.usPct
  const krDiff = current.krPct - recommended.krPct
  const cashDiff = current.cashPct - recommended.cashPct

  /** @type {string[]} */
  const issues = []
  if (usDiff >= 8) issues.push("미국 비중 과다")
  if (krDiff >= 8) issues.push("한국 비중 과다")
  if (cashDiff <= -8) issues.push("현금 확보 필요")

  const conclusion =
    issues.length > 0 ? `${issues.join(" · ")}` : "권장 배분 근접 · 유지"

  return { usDiff, krDiff, cashDiff, conclusion, issues }
}
