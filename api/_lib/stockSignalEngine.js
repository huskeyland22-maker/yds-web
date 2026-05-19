/**
 * 실시간 종목 상태 엔진 — 규칙 기반 시그널
 * @typedef {{
 *   price?: number | null
 *   ma10?: number | null
 *   ma20?: number | null
 *   position52w?: number | null
 *   rsi14?: number | null
 *   volumeChangePct?: number | null
 *   volumeRatio?: number | null
 *   sectorScore?: number | null
 *   panicIndex?: number | null
 * }} StockSignalInputs
 *
 * @typedef {{
 *   signal: 'overheat'|'pullback'|'watch'|'trend'
 *   signalLabel: string
 *   badge: string
 *   reasons: string[]
 * }} StockSignalResult
 */

export const STOCK_SIGNAL_META = {
  overheat: { signal: "overheat", signalLabel: "과열", badge: "과열" },
  pullback: { signal: "pullback", signalLabel: "눌림", badge: "주의" },
  watch: { signal: "watch", signalLabel: "관망", badge: "관망" },
  trend: { signal: "trend", signalLabel: "추천", badge: "추천유지" },
}

function toNum(v) {
  const n = typeof v === "number" ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

/** @param {number | null} price @param {number | null} ma @param {number} [pct] */
export function isNearMovingAverage(price, ma, pct = 0.02) {
  if (price == null || ma == null || ma === 0) return false
  return Math.abs(price - ma) / Math.abs(ma) <= pct
}

/** @param {number[]} closes @param {number} [lookback] */
export function computePosition52w(closes, lookback = 252) {
  if (!Array.isArray(closes) || closes.length < 10) return null
  const slice = closes.slice(-Math.min(lookback, closes.length))
  const last = slice[slice.length - 1]
  let min = Infinity
  let max = -Infinity
  for (const c of slice) {
    if (!Number.isFinite(c)) continue
    if (c < min) min = c
    if (c > max) max = c
  }
  if (!Number.isFinite(last) || !Number.isFinite(min) || !Number.isFinite(max) || max <= min) return null
  return ((last - min) / (max - min)) * 100
}

/** @param {number | null} volumeChangePct — 20일 평균 대비 % */
export function volumeRatioFromChangePct(volumeChangePct) {
  const pct = toNum(volumeChangePct)
  if (pct == null) return null
  return 1 + pct / 100
}

/**
 * @param {StockSignalInputs} inputs
 * @returns {StockSignalResult}
 */
export function computeStockSignal(inputs) {
  const price = toNum(inputs.price)
  const ma20 = toNum(inputs.ma20)
  const ma10 = toNum(inputs.ma10)
  const rsi = toNum(inputs.rsi14)
  const pos = toNum(inputs.position52w)
  const volRatio =
    toNum(inputs.volumeRatio) ?? volumeRatioFromChangePct(inputs.volumeChangePct)
  const reasons = []

  if (ma10 != null) reasons.push(`MA10 ${Math.round(ma10)}`)

  // RSI>70 && 52주>85% → 과열
  if (rsi != null && rsi > 70 && pos != null && pos > 85) {
    return { ...STOCK_SIGNAL_META.overheat, reasons: ["RSI>70", "52주>85%", ...reasons] }
  }

  // 20일선 돌파 && 거래량 1.5배 → 추천
  if (price != null && ma20 != null && price > ma20 && volRatio != null && volRatio >= 1.5) {
    return { ...STOCK_SIGNAL_META.trend, reasons: ["20일선 상회", "거래량≥1.5배", ...reasons] }
  }

  // 20일선 근처 && RSI 35~50 → 눌림
  if (
    price != null &&
    ma20 != null &&
    isNearMovingAverage(price, ma20) &&
    rsi != null &&
    rsi >= 35 &&
    rsi <= 50
  ) {
    return { ...STOCK_SIGNAL_META.pullback, reasons: ["20일선 근처", "RSI 35~50", ...reasons] }
  }

  // 20일선 하회 && 거래량 감소 → 관망
  if (price != null && ma20 != null && price < ma20 && volRatio != null && volRatio < 1) {
    return { ...STOCK_SIGNAL_META.watch, reasons: ["20일선 하회", "거래량 감소", ...reasons] }
  }

  return { ...STOCK_SIGNAL_META.watch, reasons: ["기본 관망", ...reasons] }
}
