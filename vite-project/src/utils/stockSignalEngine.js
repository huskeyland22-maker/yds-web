/**
 * 클라이언트 — 종목 시그널 엔진 (서버 api/_lib/stockSignalEngine.js 와 동일 규칙)
 */

export const STOCK_SIGNAL_META = {
  overheat: { id: "overheat", status: "과열", badge: "과열", shortBadge: "과열" },
  pullback: { id: "pullback", status: "눌림", badge: "눌림대기", shortBadge: "주의" },
  watch: { id: "watch", status: "관망", badge: "관망", shortBadge: "관망" },
  trend: { id: "trend", status: "추세", badge: "추천유지", shortBadge: "추천유지" },
}

function toNum(v) {
  const n = typeof v === "number" ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

function isNearMa(price, ma, pct = 0.02) {
  if (price == null || ma == null || ma === 0) return false
  return Math.abs(price - ma) / Math.abs(ma) <= pct
}

function volumeRatioFromChangePct(volumeChangePct) {
  const pct = toNum(volumeChangePct)
  if (pct == null) return null
  return 1 + pct / 100
}

/**
 * @param {{
 *   price?: number | null
 *   ma10?: number | null
 *   ma20?: number | null
 *   position52w?: number | null
 *   rsi14?: number | null
 *   volumeChangePct?: number | null
 *   volumeRatio?: number | null
 * }} inputs
 */
export function computeStockSignal(inputs) {
  const price = toNum(inputs.price)
  const ma20 = toNum(inputs.ma20)
  const rsi = toNum(inputs.rsi14)
  const pos = toNum(inputs.position52w)
  const volRatio =
    toNum(inputs.volumeRatio) ?? volumeRatioFromChangePct(inputs.volumeChangePct)

  if (rsi != null && rsi > 70 && pos != null && pos > 85) {
    return { ...STOCK_SIGNAL_META.overheat }
  }
  if (price != null && ma20 != null && price > ma20 && volRatio != null && volRatio >= 1.5) {
    return { ...STOCK_SIGNAL_META.trend }
  }
  if (
    price != null &&
    ma20 != null &&
    isNearMa(price, ma20) &&
    rsi != null &&
    rsi >= 35 &&
    rsi <= 50
  ) {
    return { ...STOCK_SIGNAL_META.pullback }
  }
  if (price != null && ma20 != null && price < ma20 && volRatio != null && volRatio < 1) {
    return { ...STOCK_SIGNAL_META.watch }
  }
  return { ...STOCK_SIGNAL_META.watch }
}

/** @param {object | null | undefined} apiSignal — /api/stock stockSignal */
export function rowFromApiStockSignal(apiSignal) {
  if (!apiSignal?.signal) return null
  const meta = STOCK_SIGNAL_META[apiSignal.signal] ?? STOCK_SIGNAL_META.watch
  return {
    statusId: meta.id,
    status: meta.status,
    badge: apiSignal.badge ?? meta.badge,
    shortBadge: apiSignal.badge ?? meta.shortBadge,
    marketTemp: apiSignal.position52w != null && apiSignal.position52w > 70 ? "HOT" : "WARM",
    aux: {
      ma10: apiSignal.ma10 != null ? (apiSignal.price > apiSignal.ma10 ? "상회" : "하회") : "—",
      ma20: apiSignal.ma20 != null ? (apiSignal.price > apiSignal.ma20 ? "상회" : "하회") : "—",
      w52:
        apiSignal.position52w != null
          ? apiSignal.position52w > 66
            ? "상단"
            : apiSignal.position52w < 33
              ? "하단"
              : "중단"
          : "—",
    },
    live: true,
    rsi14: apiSignal.rsi14,
    position52w: apiSignal.position52w,
    price: apiSignal.price,
  }
}
