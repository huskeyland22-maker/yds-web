/**
 * V5/V6 — 추격금지 이유 · 현재 위치 · 타이밍 감점 · 시장적합 등급
 */

/** @typedef {'dip' | 'earlyRise' | 'overheat'} PricePositionId */

/**
 * @typedef {{
 *   id: PricePositionId
 *   emoji: string
 *   label: string
 * }} PricePositionView
 */

export const PRICE_POSITION_VIEWS = {
  dip: { id: "dip", emoji: "🟢", label: "눌림구간" },
  earlyRise: { id: "earlyRise", emoji: "🟡", label: "상승초기" },
  overheat: { id: "overheat", emoji: "🔴", label: "과열구간" },
}

/** @param {unknown} v */
function toNum(v) {
  const n = typeof v === "number" ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

/** @param {import("./ydsStockPickModel.js").StockPickView} stock */
function readPriceInputs(stock) {
  const snap = stock.snapshot ?? {}
  const diag = stock.statusDiag?.inputs ?? {}
  return {
    close: toNum(snap.price ?? snap.close ?? diag.close),
    ma20: toNum(snap.ma20 ?? diag.ma20),
    ma60: toNum(snap.ma60 ?? diag.ma60),
    ma120: toNum(snap.ma120),
    high52w: toNum(snap.high52w ?? diag.high52w),
    recentHigh: toNum(snap.recentHigh ?? diag.recentHigh),
    rsi14: toNum(diag.rsi14),
    drawdownPct: toNum(diag.drawdownPct),
    position52w: toNum(diag.position52w),
  }
}

/** @param {import("./ydsStockPickModel.js").StockPickView} stock @returns {PricePositionView} */
export function resolvePricePosition(stock) {
  const { close, ma20, ma60, rsi14, drawdownPct, position52w } = readPriceInputs(stock)
  const statusId = stock.stockStatus?.id ?? stock.statusDiag?.statusId

  if (
    statusId === "overheat" ||
    (rsi14 != null && rsi14 > 70) ||
    (position52w != null && position52w >= 97)
  ) {
    return PRICE_POSITION_VIEWS.overheat
  }

  if (
    statusId === "dip" ||
    (drawdownPct != null && drawdownPct >= 5 && drawdownPct <= 15)
  ) {
    return PRICE_POSITION_VIEWS.dip
  }

  if (close != null && ma20 != null && ma60 != null && close > ma20 && ma20 > ma60) {
    return PRICE_POSITION_VIEWS.earlyRise
  }

  if (close != null && ma60 != null && close > ma60) {
    return PRICE_POSITION_VIEWS.earlyRise
  }

  return PRICE_POSITION_VIEWS.dip
}

/** @param {import("./ydsStockPickModel.js").StockPickView} stock @returns {string[]} */
export function buildNoChaseReasons(stock) {
  if (stock.v4Score?.recommendStatusId !== "noChase") return []

  /** @type {string[]} */
  const reasons = []
  const { close, ma20, ma60, ma120, rsi14, drawdownPct, position52w } = readPriceInputs(stock)
  const checks = stock.timingScore?.checks ?? []

  if (ma120 != null && close != null) {
    const ratio = close / ma120
    if (ratio >= 1.12) reasons.push("120일선 이격 과다")
    else if (close < ma120) reasons.push("120일선 미회복")
  } else {
    const ma120Check = checks.find((c) => c.id === "ma120")
    if (ma120Check && !ma120Check.pass) reasons.push("120일선 미회복")
  }

  if (rsi14 != null && rsi14 > 70) {
    reasons.push("RSI 과열")
  } else {
    const rsiCheck = checks.find((c) => c.id === "rsi")
    if (rsiCheck && !rsiCheck.pass) reasons.push("RSI 과열")
  }

  const highBreak = checks.find((c) => c.id === "highBreak")
  if (
    (highBreak?.pass && drawdownPct != null && drawdownPct <= 3) ||
    (position52w != null && position52w >= 97 && drawdownPct != null && drawdownPct <= 4)
  ) {
    reasons.push("신고가 돌파 후 급등")
  }

  if (close != null && ma20 != null && close < ma20) {
    reasons.push("20일선 미회복")
  }

  if (close != null && ma60 != null && close < ma60) {
    reasons.push("60일선 이탈")
  }

  return [...new Set(reasons)].slice(0, 3)
}

/** @param {import("./ydsStockPickModel.js").StockPickView} stock @returns {string[]} */
export function buildTimingPenaltyReasons(stock) {
  /** @type {string[]} */
  const reasons = []
  const checks = stock.timingScore?.checks ?? []

  for (const check of checks) {
    if (check.pass) continue
    if (check.id === "ma20") reasons.push("20일선 미회복")
    else if (check.id === "ma60") reasons.push("60일선 미회복")
    else if (check.id === "ma120") reasons.push("120일선 미회복")
    else if (check.id === "highBreak") reasons.push("신고가 돌파 실패")
    else if (check.id === "volume") reasons.push("거래량 부족")
    else if (check.id === "pullback") reasons.push("눌림 미형성")
    else if (check.id === "rsi") reasons.push("RSI 과열")
  }

  if (stock.timingScore?.rsiPenalty > 0) {
    reasons.push(`RSI 과열 감점 −${stock.timingScore.rsiPenalty}`)
  }

  return [...new Set(reasons)].slice(0, 5)
}

/** @param {number} marketEnv @param {number} [max] */
export function marketEnvToGrade(marketEnv, max = 15) {
  const pct = max > 0 ? marketEnv / max : 0
  if (pct >= 0.8) return "A"
  if (pct >= 0.6) return "B"
  if (pct >= 0.4) return "C"
  if (pct >= 0.2) return "D"
  return "F"
}

export const LONG_HOLD_QUALITY_MIN = 65
