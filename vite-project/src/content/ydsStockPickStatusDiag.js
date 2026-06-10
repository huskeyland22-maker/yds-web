/**
 * 종목 상태 산출 검증 — deriveStatusFromSnapshot 입력·근거 로그
 */

import { deriveStatusFromSnapshot } from "./ydsStockPickStatusEngine.js"
import { STOCK_STATUS_VIEWS } from "./ydsStockActionEngine.js"

/** @param {unknown} v */
function toNum(v) {
  const n = typeof v === "number" ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * @param {import("./ydsStockScoreEngine.js").StockPriceSnapshot} snapshot
 * @param {{ rsi14?: number | null; position52w?: number | null; volumeChangePct?: number | null }} [extras]
 */
export function explainStatusFromSnapshot(snapshot, extras = {}) {
  const close = toNum(snapshot?.close)
  const ma20 = toNum(snapshot?.ma20)
  const ma60 = toNum(snapshot?.ma60)
  const high52w = toNum(snapshot?.high52w)
  const recentHigh = toNum(snapshot?.recentHigh)
  const rsi14 = toNum(extras.rsi14)
  const pos52 = toNum(extras.position52w)

  const drawdownPct =
    recentHigh != null && recentHigh > 0 ? ((recentHigh - close) / recentHigh) * 100 : null
  const high52Ratio = high52w != null && high52w > 0 && close != null ? close / high52w : null
  const volRatio =
    snapshot?.volumeAvg20 > 0 ? snapshot.volumeToday / snapshot.volumeAvg20 : null

  const statusId = deriveStatusFromSnapshot(snapshot, extras)
  /** @type {string[]} */
  const reasons = []

  if (close == null || ma20 == null || ma60 == null) {
    reasons.push("현재가·20일선·60일선 중 누락 → 관심(interest) 기본값")
  } else {
    const near52High =
      (high52Ratio != null && high52Ratio >= 0.97) || (pos52 != null && pos52 >= 97)
    const overheated =
      (rsi14 != null && rsi14 > 70) ||
      (volRatio != null && volRatio >= 1.4 && drawdownPct != null && drawdownPct <= 3) ||
      (drawdownPct != null && drawdownPct <= 2)

    if (near52High && overheated) {
      reasons.push("52주 고점 근접 + 과열 신호(RSI·거래량·고점 대비 조정) → 과열")
    } else if (close < ma60) {
      reasons.push(`현재가(${close}) < 60일선(${ma60}) → 관심`)
    } else if (close > ma20 && ma20 > ma60) {
      reasons.push(`현재가 > 20일선 > 60일선 정배열 → 추세`)
    } else if (close > ma60 && drawdownPct != null && drawdownPct >= 5 && drawdownPct <= 15) {
      reasons.push(
        `60일선 위 + 고점 대비 ${drawdownPct.toFixed(1)}% 조정(5~15%) → 눌림`,
      )
    } else if (close > ma60) {
      reasons.push(`60일선 위이나 정배열 아님(현재가 vs 20일선) → 눌림/관망`)
    } else {
      reasons.push("기본 조건 미충족 → 관심")
    }
  }

  return {
    statusId,
    statusLabel: STOCK_STATUS_VIEWS[statusId]?.label ?? statusId,
    inputs: {
      close,
      ma20,
      ma60,
      high52w,
      recentHigh,
      drawdownPct,
      position52w: pos52,
      rsi14,
      volumeRatio: volRatio,
    },
    reasons,
  }
}

/**
 * @param {{ name: string; ticker: string; dataSource?: string; statusDiag?: ReturnType<typeof explainStatusFromSnapshot> | null }} stock
 */
export function logStockPickStatusVerification(stock) {
  if (stock.dataSource !== "live" || !stock.statusDiag) return

  const { inputs, statusId, statusLabel, reasons } = stock.statusDiag
  const lines = [
    `[stock-pick-status] ${stock.name} (${stock.ticker})`,
    `현재가 ${inputs.close ?? "—"}`,
    `20일선 ${inputs.ma20 ?? "—"}`,
    `60일선 ${inputs.ma60 ?? "—"}`,
    `52주위치 ${inputs.position52w != null ? `${inputs.position52w}%` : "—"}`,
    `=> ${statusId.toUpperCase()} (${statusLabel})`,
    `근거: ${reasons.join(" · ")}`,
  ]
  console.info(lines.join("\n"))
}
