/**
 * 가격·이평·고점 기반 상태 자동 산출 (JSON status 미사용)
 */

import { buildStockActionResult } from "./ydsStockActionEngine.js"

/** @typedef {'trend' | 'dip' | 'interest' | 'overheat'} StockPickStatusId */

/** @param {unknown} v */
function toNum(v) {
  const n = typeof v === "number" ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * @param {import("./ydsStockScoreEngine.js").StockPriceSnapshot} snapshot
 * @param {{ rsi14?: number | null; position52w?: number | null; volumeChangePct?: number | null }} [extras]
 * @returns {StockPickStatusId}
 */
export function deriveStatusFromSnapshot(snapshot, extras = {}) {
  const close = toNum(snapshot.close)
  const ma20 = toNum(snapshot.ma20)
  const ma60 = toNum(snapshot.ma60)
  const high52w = toNum(snapshot.high52w)
  const recentHigh = toNum(snapshot.recentHigh)

  if (close == null || ma20 == null || ma60 == null) return "interest"

  const drawdownPct =
    recentHigh != null && recentHigh > 0 ? ((recentHigh - close) / recentHigh) * 100 : 0
  const high52Ratio = high52w != null && high52w > 0 ? close / high52w : null
  const pos52 = toNum(extras.position52w)
  const rsi14 = toNum(extras.rsi14)
  const volRatio =
    snapshot.volumeAvg20 > 0 ? snapshot.volumeToday / snapshot.volumeAvg20 : null

  const near52High =
    (high52Ratio != null && high52Ratio >= 0.97) || (pos52 != null && pos52 >= 97)
  const overheated =
    (rsi14 != null && rsi14 > 70) ||
    (volRatio != null && volRatio >= 1.4 && drawdownPct <= 3) ||
    drawdownPct <= 2

  if (near52High && overheated) return "overheat"

  if (close < ma60) return "interest"

  if (close > ma20 && ma20 > ma60) return "trend"

  if (close > ma60 && drawdownPct >= 5 && drawdownPct <= 15) return "dip"

  if (close > ma60) return "dip"

  return "interest"
}

/**
 * @param {StockPickStatusId} statusId
 * @param {import("./ydsStockRecommendReasons.js").RecommendReason[]} [reasons]
 */
export function actionFromStatus(statusId, reasons = []) {
  const actionReason =
    reasons.length > 0
      ? reasons
          .slice(0, 1)
          .map((r) => r.text)
          .join(" · ")
      : ""
  return buildStockActionResult(statusId, actionReason)
}
